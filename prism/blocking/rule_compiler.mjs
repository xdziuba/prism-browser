// Prism-owned, deliberately limited compiler for local DNR block rules.
const RESOURCE_TYPES = new Set([
  'script', 'image', 'xmlhttprequest', 'sub_frame',
]);
const MAX_RULES = 1000;
const MAX_DISABLED_SITES = 256;

function isRecord(value) {
  return value !== null && typeof value === 'object' &&
      !Array.isArray(value);
}

function hasExactKeys(value, required, optional = []) {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) &&
      keys.every(key => required.includes(key) || optional.includes(key));
}

function isDomain(value) {
  if (typeof value !== 'string' || value.length > 253) {
    return false;
  }
  const labels = value.split('.');
  return labels.length >= 2 && /^[a-z][a-z0-9-]*$/.test(labels.at(-1)) &&
      labels.every(label => label.length >= 1 && label.length <= 63 &&
        /^[a-z0-9-]+$/.test(label) && !label.startsWith('-') &&
        !label.endsWith('-'));
}

export function isValidDisabledSites(sites) {
  return Array.isArray(sites) && sites.length <= MAX_DISABLED_SITES &&
      Array.from(sites).every(isDomain) &&
      new Set(sites).size === sites.length;
}

export function isCompiledRuleSet(rules) {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) {
    return false;
  }
  const ids = new Set();
  for (const rule of rules) {
    const condition = rule?.condition;
    const types = condition?.resourceTypes;
    const excluded = condition?.excludedTopDomains;
    if (!hasExactKeys(rule, ['id', 'priority', 'action', 'condition']) ||
        !Number.isSafeInteger(rule.id) || rule.id < 1 ||
        rule.id > 1_000_000 || ids.has(rule.id) || rule.priority !== 1 ||
        !hasExactKeys(rule.action, ['type']) ||
        rule.action.type !== 'block' ||
        !hasExactKeys(condition, ['requestDomains', 'resourceTypes'],
          ['excludedTopDomains']) ||
        !Array.isArray(condition.requestDomains) ||
        condition.requestDomains.length !== 1 ||
        !isDomain(condition.requestDomains[0]) ||
        !Array.isArray(types) || types.length < 1 ||
        types.length > RESOURCE_TYPES.size ||
        types.some(type => !RESOURCE_TYPES.has(type)) ||
        new Set(types).size !== types.length ||
        (excluded !== undefined && !isValidDisabledSites(excluded))) {
      return false;
    }
    ids.add(rule.id);
  }
  return true;
}

export function compileAdblockRules({bundle, settings} = {}) {
  if (!isRecord(settings) || settings.enabled !== true) {
    return {rules: [], provenance: null};
  }
  const disabledSites = settings.disabledSites ?? [];
  if (!isValidDisabledSites(disabledSites)) {
    throw new TypeError('invalid disabled sites');
  }
  if (!hasExactKeys(bundle, ['sourceId', 'version', 'rules']) ||
      typeof bundle.sourceId !== 'string' ||
      !/^[a-z][a-z0-9._-]{0,63}$/.test(bundle.sourceId) ||
      typeof bundle.version !== 'string' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(
        bundle.version) ||
      !Array.isArray(bundle.rules) || bundle.rules.length > MAX_RULES) {
    throw new TypeError('invalid rule bundle');
  }
  const ids = new Set();
  const rules = bundle.rules.map(rule => {
    if (!hasExactKeys(rule, ['id', 'destinationHost', 'resourceTypes']) ||
        !Number.isSafeInteger(rule.id) || rule.id < 1 ||
        rule.id > 1_000_000 || ids.has(rule.id) ||
        !isDomain(rule.destinationHost) ||
        !Array.isArray(rule.resourceTypes) ||
        rule.resourceTypes.length < 1 ||
        rule.resourceTypes.length > RESOURCE_TYPES.size ||
        rule.resourceTypes.some(type => !RESOURCE_TYPES.has(type)) ||
        new Set(rule.resourceTypes).size !== rule.resourceTypes.length) {
      throw new TypeError('invalid rule');
    }
    ids.add(rule.id);
    const condition = {
      requestDomains: [rule.destinationHost],
      resourceTypes: [...rule.resourceTypes],
    };
    if (disabledSites.length) {
      condition.excludedTopDomains = [...disabledSites];
    }
    return {id: rule.id, priority: 1, action: {type: 'block'}, condition};
  });
  return {
    rules,
    provenance: {sourceId: bundle.sourceId, version: bundle.version,
      ruleCount: rules.length},
  };
}
