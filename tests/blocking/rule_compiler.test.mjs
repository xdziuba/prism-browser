import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compileAdblockRules} from '../../prism/blocking/rule_compiler.mjs';

const bundle = {
  sourceId: 'prism.synthetic',
  version: '1.0.0',
  rules: [{id: 1, destinationHost: 'ads.prism.test',
    resourceTypes: ['script', 'image']}],
};

test('blocking defaults off and emits no rules without opt-in', () => {
  assert.deepEqual(compileAdblockRules({bundle}),
    {rules: [], provenance: null});
  assert.deepEqual(compileAdblockRules({bundle,
    settings: {enabled: false}}), {rules: [], provenance: null});
});

test('compiles scoped DNR rules with provenance and site exclusions', () => {
  const result = compileAdblockRules({bundle, settings: {
    enabled: true, disabledSites: ['news.prism.test'],
  }});
  assert.deepEqual(result.provenance,
    {sourceId: 'prism.synthetic', version: '1.0.0', ruleCount: 1});
  assert.deepEqual(result.rules, [{
    id: 1,
    priority: 1,
    action: {type: 'block'},
    condition: {
      requestDomains: ['ads.prism.test'],
      resourceTypes: ['script', 'image'],
      excludedTopDomains: ['news.prism.test'],
    },
  }]);
});

test('invalid bundle rejects entirely instead of widening a rule', () => {
  const invalidRules = [
    {...bundle.rules[0], destinationHost: 'ads.prism.test/'},
    {...bundle.rules[0], destinationHost: '*.prism.test'},
    {...bundle.rules[0], destinationHost: 'localhost'},
    {...bundle.rules[0], destinationHost: '127.0.0.1'},
    {...bundle.rules[0], destinationHost: 'ADS.PRISM.TEST'},
    {...bundle.rules[0], resourceTypes: ['main_frame']},
    {...bundle.rules[0], resourceTypes: ['media']},
    {...bundle.rules[0], resourceTypes: ['script', 'script']},
    {...bundle.rules[0], urlFilter: 'ads'},
    {...bundle.rules[0], id: 0},
  ];
  for (const rule of invalidRules) {
    assert.throws(() => compileAdblockRules({
      bundle: {...bundle, rules: [rule]}, settings: {enabled: true},
    }), TypeError);
  }
  assert.throws(() => compileAdblockRules({
    bundle: {...bundle, rules: [bundle.rules[0], bundle.rules[0]]},
    settings: {enabled: true},
  }), TypeError);
  assert.throws(() => compileAdblockRules({
    bundle: {...bundle, updateUrl: 'https://example.com'},
    settings: {enabled: true},
  }), TypeError);
});

test('malformed site exclusions and excessive input reject', () => {
  for (const disabledSites of [
    ['news.prism.test', 'news.prism.test'],
    ['news.prism.test/'],
    ['localhost'],
    Array.from({length: 257}, (_, index) => `s${index}.prism.test`),
  ]) {
    assert.throws(() => compileAdblockRules({bundle,
      settings: {enabled: true, disabledSites}}), TypeError);
  }
  const tooManyRules = Array.from({length: 1001}, (_, index) => ({
    id: index + 1, destinationHost: 'ads.prism.test',
    resourceTypes: ['script'],
  }));
  assert.throws(() => compileAdblockRules({
    bundle: {...bundle, rules: tooManyRules}, settings: {enabled: true},
  }), TypeError);
});
