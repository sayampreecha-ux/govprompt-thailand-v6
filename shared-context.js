(() => {
  'use strict';

  const WORKFLOW_STATES = new Set(['idle', 'searching', 'selected', 'collecting-input', 'generated']);
  const PRECEDENT_PATTERN = /คำพิพากษา|คำวินิจฉัย|หนังสือหารือ|ข้อหารือ|แนววินิจฉัย|แนวปฏิบัติ|บรรทัดฐาน|precedent|ศาลปกครอง|\bอ\.\s*\d+\/\d+/i;
  const HIGH_RISK_PATTERN = /กฎหมาย|การเงิน|คลัง|พัสดุ|งบประมาณ|บุคคล|สิทธิ|อำนาจ|สภา|เบิกจ่าย|เดินทาง/i;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function decisionIntegrityDefaults(enabled = false) {
    return {
      enabled,
      factsChecked: !enabled,
      applicableAuthorityChecked: !enabled,
      legalVersionChecked: !enabled,
      ruleChainChecked: !enabled,
      counterCheckCompleted: !enabled,
      primarySourceChecked: !enabled,
      unresolvedPotentialReversals: [],
      conclusionLevel: enabled ? null : 'ยืนยันได้'
    };
  }

  function initialState() {
    return freeze({
      version: 7,
      query: '',
      selectedGpId: null,
      category: null,
      userInputs: {},
      routing: { score: 0, confidence: 0, matchedReason: '', fallback: true },
      evidence: { provided: false, types: [], count: 0 },
      legalTransition: {
        precedentReliedOn: false,
        precedentFactDate: null,
        currentFactDate: null,
        laterAuthoritySearchCompleted: false,
        ruleVersionCheckCompleted: false,
        contraryEvidenceCheckCompleted: false,
        laterAuthorities: []
      },
      decisionIntegrity: decisionIntegrityDefaults(false),
      riskFlags: [],
      workflowState: 'idle'
    });
  }

  let state = initialState();
  function get() { return freeze(clone(state)); }

  function update(partial = {}) {
    const next = clone(state);
    if ('query' in partial) next.query = String(partial.query ?? '');
    if ('selectedGpId' in partial) next.selectedGpId = partial.selectedGpId || null;
    if ('category' in partial) next.category = partial.category || null;
    if ('userInputs' in partial) next.userInputs = clone(partial.userInputs || {});
    if ('routing' in partial) next.routing = { ...next.routing, ...clone(partial.routing || {}) };
    if ('evidence' in partial) next.evidence = { ...next.evidence, ...clone(partial.evidence || {}) };
    if ('legalTransition' in partial) next.legalTransition = { ...next.legalTransition, ...clone(partial.legalTransition || {}) };
    if ('decisionIntegrity' in partial) next.decisionIntegrity = { ...next.decisionIntegrity, ...clone(partial.decisionIntegrity || {}) };
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
    const category = tool?.category || null;
    const highRisk = HIGH_RISK_PATTERN.test(String(category || '')) || HIGH_RISK_PATTERN.test(String(tool?.name || ''));
    return update({
      selectedGpId: tool?.id || null,
      category,
      userInputs: {},
      legalTransition: {
        precedentReliedOn: false,
        precedentFactDate: null,
        currentFactDate: null,
        laterAuthoritySearchCompleted: !highRisk,
        ruleVersionCheckCompleted: !highRisk,
        contraryEvidenceCheckCompleted: !highRisk,
        laterAuthorities: []
      },
      decisionIntegrity: decisionIntegrityDefaults(highRisk),
      riskFlags: highRisk ? ['decision-integrity-required'] : [],
      workflowState: tool ? 'selected' : 'idle'
    });
  }

  function setUserInputs(values) {
    const userInputs = clone(values || {});
    const combined = Object.values(userInputs).map(String).join(' ');
    const precedentReliedOn = PRECEDENT_PATTERN.test(combined);
    const legalTransition = precedentReliedOn
      ? {
          precedentReliedOn: true,
          precedentFactDate: null,
          currentFactDate: null,
          laterAuthoritySearchCompleted: false,
          ruleVersionCheckCompleted: false,
          contraryEvidenceCheckCompleted: false,
          laterAuthorities: []
        }
      : state.legalTransition;
    return update({ userInputs, legalTransition, workflowState: 'collecting-input' });
  }

  function setLegalTransition(values) { return update({ legalTransition: values }); }
  function setDecisionIntegrity(values) { return update({ decisionIntegrity: values }); }
  function clearUserInputs() { return update({ userInputs: {}, workflowState: state.selectedGpId ? 'selected' : 'idle' }); }
  function setWorkflowState(workflowState) { return update({ workflowState }); }
  function reset() { state = initialState(); return get(); }

  window.GOVPROMPT_CONTEXT = Object.freeze({
    get,
    update,
    setRouting,
    selectTool,
    setUserInputs,
    setLegalTransition,
    setDecisionIntegrity,
    clearUserInputs,
    setWorkflowState,
    reset
  });
})();
