(() => {
  'use strict';

  const WORKFLOW_STATES = new Set(['idle', 'searching', 'selected', 'collecting-input', 'generated']);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function initialState() {
    return freeze({
      version: 1,
      query: '',
      selectedGpId: null,
      category: null,
      userInputs: {},
      routing: { score: 0, confidence: 0, matchedReason: '', fallback: true },
      evidence: { provided: false, types: [], count: 0 },
      riskFlags: [],
      workflowState: 'idle'
    });
  }

  let state = initialState();

  function get() {
    return freeze(clone(state));
  }

  function update(partial = {}) {
    const next = clone(state);
    if ('query' in partial) next.query = String(partial.query ?? '');
    if ('selectedGpId' in partial) next.selectedGpId = partial.selectedGpId || null;
    if ('category' in partial) next.category = partial.category || null;
    if ('userInputs' in partial) next.userInputs = clone(partial.userInputs || {});
    if ('routing' in partial) next.routing = { ...next.routing, ...clone(partial.routing || {}) };
    if ('evidence' in partial) next.evidence = { ...next.evidence, ...clone(partial.evidence || {}) };
    if ('riskFlags' in partial) next.riskFlags = [...new Set((partial.riskFlags || []).map(String))];
    if ('workflowState' in partial && WORKFLOW_STATES.has(partial.workflowState)) next.workflowState = partial.workflowState;
    state = freeze(next);
    return get();
  }

  function setRouting(routeResult, query) {
    const route = routeResult || {};
    return update({
      query,
      routing: {
        score: Number(route.score) || 0,
        confidence: Number(route.confidence) || 0,
        matchedReason: String(route.matchedReason || ''),
        fallback: route.fallback !== false
      },
      workflowState: query ? 'searching' : 'idle'
    });
  }

  function selectTool(tool) {
    return update({
      selectedGpId: tool?.id || null,
      category: tool?.category || null,
      userInputs: {},
      workflowState: tool ? 'selected' : 'idle'
    });
  }

  function setUserInputs(values) {
    return update({ userInputs: values, workflowState: 'collecting-input' });
  }

  function clearUserInputs() {
    return update({ userInputs: {}, workflowState: state.selectedGpId ? 'selected' : 'idle' });
  }

  function setWorkflowState(workflowState) {
    return update({ workflowState });
  }

  function reset() {
    state = initialState();
    return get();
  }

  window.GOVPROMPT_CONTEXT = Object.freeze({
    get,
    update,
    setRouting,
    selectTool,
    setUserInputs,
    clearUserInputs,
    setWorkflowState,
    reset
  });
})();
