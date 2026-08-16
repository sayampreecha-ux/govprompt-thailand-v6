(() => {
  'use strict';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function valueOr(value, fallback) {
    return value === undefined || value === null ? fallback : value;
  }

  function prepare(context) {
    const source = context || {};
    return freeze({
      version: 1,
      task: {
        query: String(valueOr(source.query, '')),
        selectedGpId: source.selectedGpId || null,
        category: source.category || null
      },
      userInputs: clone(source.userInputs || {}),
      routing: {
        score: Number(source.routing?.score) || 0,
        confidence: Number(source.routing?.confidence) || 0,
        matchedReason: String(source.routing?.matchedReason || ''),
        fallback: source.routing?.fallback !== false
      },
      evidence: {
        provided: source.evidence?.provided === true,
        types: clone(source.evidence?.types || []),
        count: Number(source.evidence?.count) || 0
      },
      riskFlags: clone(source.riskFlags || []),
      workflowState: String(valueOr(source.workflowState, 'idle'))
    });
  }

  window.GOVPROMPT_CORE_ENGINE = Object.freeze({ prepare });
})();
