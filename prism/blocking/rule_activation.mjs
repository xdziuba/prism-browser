// Replaces one component extension's dynamic DNR rule set in a serialized step.
import {isCompiledRuleSet} from './rule_compiler.mjs';

function normalized(rules) {
  return rules.map(rule => ({
    id: rule.id,
    priority: rule.priority,
    action: rule.action.type,
    requestDomain: rule.condition.requestDomains[0],
    resourceTypes: [...rule.condition.resourceTypes].sort(),
    excludedTopDomains: [...(rule.condition.excludedTopDomains ?? [])].sort(),
  })).sort((left, right) => left.id - right.id);
}

export function sameCompiledRules(left, right) {
  return isCompiledRuleSet(left) && isCompiledRuleSet(right) &&
      JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

export function createDynamicRuleActivator(api) {
  if (!api || typeof api.getDynamicRules !== 'function' ||
      typeof api.updateDynamicRules !== 'function') {
    throw new TypeError('DNR API required');
  }
  let pending = Promise.resolve();
  return candidate => {
    const run = async () => {
      if (!isCompiledRuleSet(candidate?.rules)) {
        return {ok: false, error: 'invalid_candidate', installedRules: null};
      }
      let before;
      try {
        before = await api.getDynamicRules();
      } catch {
        return {ok: false, error: 'read_failed', installedRules: null};
      }
      if (!isCompiledRuleSet(before)) {
        return {ok: false, error: 'unexpected_existing_rules',
          installedRules: null};
      }
      if (sameCompiledRules(before, candidate.rules)) {
        return {ok: true, error: null, installedRules: before};
      }
      try {
        await api.updateDynamicRules({
          removeRuleIds: before.map(rule => rule.id),
          addRules: candidate.rules,
        });
      } catch {
        return {ok: false, error: 'update_failed', installedRules: before};
      }
      let after;
      try {
        after = await api.getDynamicRules();
      } catch {
        after = null;
      }
      if (after && sameCompiledRules(after, candidate.rules)) {
        return {ok: true, error: null, installedRules: after};
      }
      try {
        const removeRuleIds = [...new Set([
          ...before.map(rule => rule.id),
          ...candidate.rules.map(rule => rule.id),
          ...(Array.isArray(after) ? after.map(rule => rule.id) : []),
        ])];
        await api.updateDynamicRules({removeRuleIds, addRules: before});
        const restored = await api.getDynamicRules();
        if (sameCompiledRules(restored, before)) {
          return {ok: false, error: 'readback_mismatch',
            installedRules: restored};
        }
      } catch {
        // The caller must treat the installed state as unknown.
      }
      return {ok: false, error: 'rollback_failed', installedRules: null};
    };
    const result = pending.then(run);
    pending = result.then(() => {}, () => {});
    return result;
  };
}
