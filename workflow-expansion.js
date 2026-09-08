(() => {
  'use strict';

  const QUALITY_STATUS = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });
  const WORKFLOW_STATES = Object.freeze(['intake', 'collecting-evidence', 'risk-review', 'human-review', 'deliverable-ready', 'blocked', 'not-applicable']);
  const TRANSITIONS = Object.freeze({
    intake: Object.freeze(['collecting-evidence', 'blocked']),
    'collecting-evidence': Object.freeze(['risk-review', 'human-review', 'blocked']),
    'risk-review': Object.freeze(['human-review', 'blocked']),
    'human-review': Object.freeze(['deliverable-ready', 'collecting-evidence', 'blocked']),
    'deliverable-ready': Object.freeze([]),
    blocked: Object.freeze([]),
    'not-applicable': Object.freeze([])
  });

  const HIGH_RISK_CATEGORIES = Object.freeze(new Set([
    'กฎหมาย', 'การเงิน', 'การคลัง', 'พัสดุ', 'บุคคล', 'งบประมาณ', 'สภาท้องถิ่น',
    'legal', 'finance', 'procurement', 'personnel', 'budget', 'council'
  ]));
  const AUTHORITY_GATE_ID = 'global-high-risk-authority-transition';

  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: 'tor-procurement',
      gpIds: Object.freeze(['GP009', 'GP010', 'GP011', 'GP012']),
      requiredEvidence: Object.freeze(['requirement-specification', 'market-information', 'budget-basis']),
      riskGates: Object.freeze(['competition-and-specification-review', 'acceptance-and-contract-review']),
      deliverable: 'procurement-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'financial-disbursement',
      gpIds: Object.freeze(['GP019']),
      requiredEvidence: Object.freeze(['payment-request', 'supporting-documents', 'approval-reference']),
      riskGates: Object.freeze(['supporting-document-review', 'authority-and-budget-review']),
      deliverable: 'financial-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'legal-analysis',
      gpIds: Object.freeze(['GP005', 'GP006', 'GP007', 'GP008']),
      requiredEvidence: Object.freeze(['facts', 'authority-or-source-provided', 'question-for-review']),
      riskGates: Object.freeze(['source-verification', 'human-legal-review']),
      deliverable: 'legal-review-brief',
      handoffTargets: Object.freeze(['official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'official-letter-follow-up',
      gpIds: Object.freeze(['GP001', 'GP002', 'GP003', 'GP004']),
      requiredEvidence: Object.freeze(['facts', 'recipient-or-destination', 'reference-documents']),
      riskGates: Object.freeze(['authority-and-fact-review', 'human-final-review']),
      deliverable: 'official-letter-draft',
      handoffTargets: Object.freeze(['legal-analysis'])
    })
  ]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }
  function definitionFor(gpId) { return DEFINITIONS.find(definition => definition.gpIds.includes(gpId)) || null; }
  function statusFor(qualityStatus) {
    if (qualityStatus === QUALITY_STATUS.PASS) return 'READY_FOR_REVIEW';
    if (qualityStatus === QUALITY_STATUS.NEEDS_INFO) return 'NEEDS_INFO';
    if (qualityStatus === QUALITY_STATUS.REVIEW_REQUIRED) return 'REVIEW_REQUIRED';
    return 'BLOCKED';
  }
  function stateFor(status) {
    return { READY_FOR_REVIEW: 'human-review', NEEDS_INFO: 'collecting-evidence', REVIEW_REQUIRED: 'risk-review', BLOCKED: 'blocked' }[status] || 'blocked';
  }

  function text(value) { return String(value ?? '').trim(); }
  function dateValue(value) { const s = text(value); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
  function localTransitionEvaluate(input = {}) {
    if (input.precedentReliedOn !== true) return freeze({ pass: true, status: 'NOT_APPLICABLE', decisionLock: false, blockers: [] });
    const precedentFactDate = dateValue(input.precedentFactDate);
    const currentFactDate = dateValue(input.currentFactDate);
    const laterAuthorities = Array.isArray(input.laterAuthorities) ? input.laterAuthorities : [];
    const unresolved = laterAuthorities.filter(a => a?.relevant !== false && a?.transitionResolved !== true);
    const blockers = [];
    if (!precedentFactDate) blockers.push('missing-precedent-fact-date');
    if (!currentFactDate) blockers.push('missing-current-fact-date');
    if (input.laterAuthoritySearchCompleted !== true) blockers.push('later-authority-search-not-completed');
    if (input.ruleVersionCheckCompleted !== true) blockers.push('rule-version-check-not-completed');
    if (input.contraryEvidenceCheckCompleted !== true) blockers.push('contrary-evidence-check-not-completed');
    if (precedentFactDate && currentFactDate && currentFactDate < precedentFactDate) blockers.push('timeline-not-resolved');
    if (unresolved.length) blockers.push('later-authority-effect-unresolved');
    return freeze({ pass: blockers.length === 0, status: blockers.length ? 'BLOCKED_LATER_AUTHORITY_CHECK' : 'PASS', decisionLock: blockers.length > 0, blockers });
  }
  function authorityTransitionInput(envelope = {}) { return envelope.authorityTransition || envelope.transitionGateInput || envelope.transition || {}; }
  function categoryOf(envelope = {}) { return text(envelope?.task?.category || envelope?.category || envelope?.domain); }
  function isHighRiskAuthorityCase(envelope = {}) {
    const input = authorityTransitionInput(envelope);
    return input.precedentReliedOn === true && HIGH_RISK_CATEGORIES.has(categoryOf(envelope));
  }
  function evaluateAuthorityTransition(envelope = {}) {
    if (!isHighRiskAuthorityCase(envelope)) return freeze({ applicable: false, pass: true, status: 'NOT_APPLICABLE', blockers: [] });
    const evaluator = typeof window !== 'undefined' && window.GOVPROMPT_LEGAL_TRANSITION_GATE?.evaluate;
    const result = typeof evaluator === 'function' ? evaluator(authorityTransitionInput(envelope)) : localTransitionEvaluate(authorityTransitionInput(envelope));
    return freeze({ applicable: true, ...result });
  }
  function authorityBlockedPlan(envelope, result, definition) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    const blockers = [...(result.blockers || [])];
    return freeze({
      workflowId: definition?.id || null,
      selectedGpId,
      status: 'BLOCKED',
      currentState: 'blocked',
      states: [...WORKFLOW_STATES],
      availableTransitions: [],
      requiredEvidence: [],
      missingInformation: blockers.map(item => `authority-transition:${item}`),
      riskGates: [{ gate: AUTHORITY_GATE_ID, triggered: true, blockers }],
      riskFlags: [AUTHORITY_GATE_ID],
      requiresHumanReview: true,
      decisionLock: true,
      qualityStatus: 'UNVERIFIED',
      workflowStatus: 'BLOCKED_LATER_AUTHORITY_CHECK',
      nextAction: 'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK',
      authorityTransition: result,
      deliverable: { type: definition?.deliverable || null, state: 'BLOCKED' },
      handoff: { allowedTargets: definition ? [...definition.handoffTargets] : [], requiresHumanDecision: true }
    });
  }

  function plan(envelope, qualityResult) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    const definition = definitionFor(selectedGpId);
    const authorityTransition = evaluateAuthorityTransition(envelope || {});
    if (authorityTransition.applicable && !authorityTransition.pass) return authorityBlockedPlan(envelope || {}, authorityTransition, definition);

    if (!definition) {
      return freeze({
        workflowId: null,
        selectedGpId,
        status: 'NOT_APPLICABLE',
        currentState: 'not-applicable',
        states: [...WORKFLOW_STATES],
        requiredEvidence: [],
        missingInformation: [],
        riskGates: authorityTransition.applicable ? [{ gate: AUTHORITY_GATE_ID, triggered: false, blockers: [] }] : [],
        requiresHumanReview: true,
        decisionLock: false,
        authorityTransition,
        deliverable: { type: null, state: 'NOT_READY' },
        handoff: { allowedTargets: [], requiresHumanDecision: true }
      });
    }

    const qualityChecks = qualityResult?.checks || {};
    const riskFlags = [...new Set([...(envelope?.riskFlags || []), ...(qualityChecks.riskFlags || []), ...(qualityChecks.pdpaSecurity?.concerns || [])].map(String))];
    const evidenceTypes = new Set((envelope?.evidence?.types || []).map(String));
    const requiredEvidence = definition.requiredEvidence.map(type => ({ type, provided: evidenceTypes.has(type) }));
    const missingWorkflowEvidence = requiredEvidence.filter(evidence => !evidence.provided).map(evidence => `workflow-evidence:${evidence.type}`);
    const missingInformation = [...new Set([...clone(qualityChecks.missingInformation || []), ...missingWorkflowEvidence])];
    const qualityStatus = qualityResult?.status || QUALITY_STATUS.BLOCKED;
    const status = qualityStatus === QUALITY_STATUS.PASS && missingWorkflowEvidence.length ? 'NEEDS_INFO' : statusFor(qualityStatus);
    const deliverableState = status === 'READY_FOR_REVIEW' ? 'READY_FOR_HUMAN_REVIEW' : status === 'BLOCKED' ? 'BLOCKED' : 'NOT_READY';
    const currentState = stateFor(status);
    const riskGates = definition.riskGates.map(gate => ({ gate, triggered: riskFlags.includes(gate) }));
    if (authorityTransition.applicable) riskGates.unshift({ gate: AUTHORITY_GATE_ID, triggered: false, blockers: [] });

    return freeze({
      workflowId: definition.id,
      selectedGpId,
      status,
      currentState,
      states: [...WORKFLOW_STATES],
      availableTransitions: [...TRANSITIONS[currentState]],
      requiredEvidence,
      missingInformation,
      riskGates,
      riskFlags,
      requiresHumanReview: true,
      decisionLock: false,
      authorityTransition,
      deliverable: { type: definition.deliverable, state: deliverableState },
      handoff: { allowedTargets: [...definition.handoffTargets], requiresHumanDecision: true }
    });
  }

  const api = Object.freeze({ plan, definitions: DEFINITIONS, states: WORKFLOW_STATES, transitions: TRANSITIONS, highRiskCategories: HIGH_RISK_CATEGORIES, evaluateAuthorityTransition, authorityGateId: AUTHORITY_GATE_ID });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_WORKFLOW_EXPANSION = api;
})();