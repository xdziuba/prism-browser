import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDynamicRuleActivator} from
  '../../prism/blocking/rule_activation.mjs';
import {compileAdblockRules} from
  '../../prism/blocking/rule_compiler.mjs';

function candidate(host, id = 1) {
  return compileAdblockRules({bundle: {
    sourceId: 'prism.synthetic', version: '1.0.0', rules: [{
      id, destinationHost: host, resourceTypes: ['script'],
    }],
  }, settings: {enabled: true}});
}

function fakeApi(initial = []) {
  let rules = structuredClone(initial);
  const calls = [];
  return {
    calls,
    getDynamicRules: async () => structuredClone(rules),
    updateDynamicRules: async options => {
      calls.push(structuredClone(options));
      rules = structuredClone(options.addRules);
    },
    get rules() { return rules; },
    set rules(value) { rules = value; },
  };
}

test('replaces the old rules in one call and clears on disable', async () => {
  const old = candidate('old.prism.test');
  const next = candidate('new.prism.test');
  const api = fakeApi(old.rules);
  const replace = createDynamicRuleActivator(api);
  const installed = await replace(next);
  assert.equal(installed.ok, true);
  assert.deepEqual(api.calls[0], {
    removeRuleIds: [1], addRules: next.rules,
  });
  assert.deepEqual(api.rules, next.rules);
  const disabled = await replace({rules: [], provenance: null});
  assert.equal(disabled.ok, true);
  assert.deepEqual(api.rules, []);
});

test('invalid candidates and atomic API rejection preserve previous rules', async () => {
  const old = candidate('old.prism.test');
  const api = fakeApi(old.rules);
  const originalUpdate = api.updateDynamicRules;
  api.updateDynamicRules = async () => { throw new Error('invalid rule'); };
  const replace = createDynamicRuleActivator(api);
  const invalid = await replace({rules: [{id: 9, action: {
    type: 'redirect'}, condition: {requestDomains: ['bad.prism.test']}}]});
  assert.equal(invalid.error, 'invalid_candidate');
  const rejected = await replace(candidate('new.prism.test'));
  assert.equal(rejected.error, 'update_failed');
  assert.deepEqual(api.rules, old.rules);
  api.updateDynamicRules = originalUpdate;
});

test('unexpected readback restores previous rules', async () => {
  const old = candidate('old.prism.test');
  const api = fakeApi(old.rules);
  const update = api.updateDynamicRules;
  let calls = 0;
  api.updateDynamicRules = async options => {
    await update(options);
    if (++calls === 1) {
      api.rules = [];
    }
  };
  const result = await createDynamicRuleActivator(api)(
    candidate('new.prism.test'));
  assert.equal(result.error, 'readback_mismatch');
  assert.deepEqual(api.rules, old.rules);
  assert.equal(calls, 2);
});

test('failed rollback reports unknown installed state', async () => {
  const old = candidate('old.prism.test');
  const api = fakeApi(old.rules);
  const update = api.updateDynamicRules;
  let calls = 0;
  api.updateDynamicRules = async options => {
    if (++calls === 2) {
      throw new Error('rollback failed');
    }
    await update(options);
    api.rules = [];
  };
  const result = await createDynamicRuleActivator(api)(
    candidate('new.prism.test'));
  assert.equal(result.error, 'rollback_failed');
  assert.equal(result.installedRules, null);
});

test('overlapping replacements run in call order', async () => {
  const api = fakeApi();
  const update = api.updateDynamicRules;
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  let enteredFirst;
  const firstEntered = new Promise(resolve => { enteredFirst = resolve; });
  let calls = 0;
  api.updateDynamicRules = async options => {
    if (++calls === 1) {
      enteredFirst();
      await firstGate;
    }
    await update(options);
  };
  const replace = createDynamicRuleActivator(api);
  const first = replace(candidate('first.prism.test'));
  const second = replace(candidate('second.prism.test'));
  await firstEntered;
  assert.equal(calls, 1);
  releaseFirst();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(api.rules[0].condition.requestDomains[0],
    'second.prism.test');
});
