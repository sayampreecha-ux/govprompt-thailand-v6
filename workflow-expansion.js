(() => {
  'use strict';

  const QUALITY_STATUS = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });
  const WORKFLOW_STATES = Object.freeze(['intake', 'collecting-evidence', 'risk-review', 'human-review', 'deliverable-ready', 'blocked', 'not-applicable']);
  const TRANSITIONS = Object.freeze({
    intake: Object.freeze(['collecting-evidence', 'blocked']),
    'collecting-evidence': Object.freeze(['risk-review', 'human-review', 'blocked']),
    'risk-review': Object.freeze(['human-review', 'collecting-evidence', 'blocked']),
    'human-review': Object.freeze(['deliverable-ready', 'collecting-evidence', 'blocked']),
    'deliverable-ready': Object.freeze([]),
    blocked: Object.freeze([]),
    'not-applicable': Object.freeze([])
  });

  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: 'tor-procurement',
      gpIds: Object.freeze(['GP009', 'GP010', 'GP011', 'GP012']),
      requiredEvidence: Object.freeze(['requirement-specification', 'market-information', 'budget-basis']),
      searchableEvidence: Object.freeze([]),
      riskGates: Object.freeze(['competition-and-specification-review', 'acceptance-and-contract-review']),
      deliverable: 'procurement-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'financial-disbursement',
      gpIds: Object.freeze(['GP019']),
      requiredEvidence: Object.freeze(['payment-request', 'supporting-documents', 'approval-reference']),
      searchableEvidence: Object.freeze([]),
      riskGates: Object.freeze(['supporting-document-review', 'authority-and-budget-review']),
      deliverable: 'financial-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'legal-analysis',
      gpIds: Object.freeze(['GP005', 'GP006', 'GP007', 'GP008']),
      requiredEvidence: Object.freeze(['facts', 'authority-or-source-provided', 'question-for-review']),
      // Authority is searchable. Missing it must trigger retrieval, not block the case before retrieval starts.
      searchableEvidence: Object.freeze(['authority-or-source-provided']),
      riskGates: Object.freeze(['source-verification', 'human-legal-review']),
      deliverable: 'legal-review-brief',
      handoffTargets: Object.freeze(['official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'official-letter-follow-up',
      gpIds: Object.freeze(['GP001', 'GP002', 'GP003', 'GP004']),
      requiredEvidence: Object.freeze(['facts', 'recipient-or-destination', 'reference-documents']),
      searchableEvidence: Object.freeze([]),
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
  function text(value) { return String(value ?? '').trim(); }

  function definitionFor(gpId) { return DEFINITIONS.find(definition => definition.gpIds.includes(gpId)) || null; }

  function statusFor(qualityStatus) {
    if (qualityStatus === QUALITY_STATUS.PASS) return 'READY_FOR_REVIEW';
    if (qualityStatus === QUALITY_STATUS.NEEDS_INFO) return 'NEEDS_INFO';
    if (qualityStatus === QUALITY_STATUS.REVIEW_REQUIRED) return 'REVIEW_REQUIRED';
    return 'BLOCKED';
  }

  function stateFor(status) {
    return {
      READY_FOR_REVIEW: 'human-review',
      NEEDS_INFO: 'collecting-evidence',
      REVIEW_REQUIRED: 'risk-review',
      BLOCKED: 'blocked'
    }[status] || 'blocked';
  }

  function valuesByKey(inputs, pattern) {
    return Object.entries(inputs || {})
      .filter(([key]) => pattern.test(String(key)))
      .map(([, value]) => text(value))
      .filter(Boolean);
  }

  function inferEvidence(type, envelope) {
    const inputs = envelope?.userInputs || {};
    const query = text(envelope?.task?.query);
    if (type === 'facts') return valuesByKey(inputs, /ข้อเท็จจริง|รายละเอียด|สภาพ|เหตุการณ์/i).length > 0;
    if (type === 'question-for-review') return valuesByKey(inputs, /ข้อหารือ|คำถาม|เรื่อง|ประเด็น/i).length > 0 || Boolean(query);
    if (type === 'authority-or-source-provided') {
      if (envelope?.evidence?.provided === true || (Number(envelope?.evidence?.count) || 0) > 0) return true;
      return valuesByKey(inputs, /เอกสาร|กฎหมาย|ระเบียบ|หลักฐาน|อ้างอิง/i).length > 0;
    }
    return false;
  }

  function plan(envelope, qualityResult) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    const definition = definitionFor(selectedGpId);
    if (!definition) {
      return freeze({
        workflowId: null,
        selectedGpId,
        status: 'NOT_APPLICABLE',
        currentState: 'not-applicable',
        states: [...WORKFLOW_STATES],
        requiredEvidence: [],
        missingInformation: [],
        searchableMissingEvidence: [],
        riskGates: [],
        requiresHumanReview: true,
        deliverable: { type: null, state: 'NOT_READY' },
        handoff: { allowedTargets: [], requiresHumanDecision: true }
      });
    }

    const qualityChecks = qualityResult?.checks || {};
    const riskFlags = [...new Set([...(envelope?.riskFlags || []), ...(qualityChecks.riskFlags || []), ...(qualityChecks.pdpaSecurity?.concerns || [])].map(String))];
    const evidenceTypes = new Set((envelope?.evidence?.types || []).map(String));
    const requiredEvidence = definition.requiredEvidence.map(type => ({ type, provided: evidenceTypes.has(type) || inferEvidence(type, envelope) }));
    const searchable = new Set(definition.searchableEvidence || []);
    const missingWorkflowEvidence = requiredEvidence.filter(evidence => !evidence.provided && !searchable.has(evidence.type)).map(evidence => `workflow-evidence:${evidence.type}`);
    const searchableMissingEvidence = requiredEvidence.filter(evidence => !evidence.provided && searchable.has(evidence.type)).map(evidence => evidence.type);
    const missingInformation = [...new Set([...clone(qualityChecks.missingInformation || []), ...missingWorkflowEvidence])];
    const qualityStatus = qualityResult?.status || QUALITY_STATUS.BLOCKED;

    let status = statusFor(qualityStatus);
    if (qualityStatus === QUALITY_STATUS.PASS && missingWorkflowEvidence.length) status = 'NEEDS_INFO';
    else if (qualityStatus === QUALITY_STATUS.PASS && searchableMissingEvidence.length) status = 'REVIEW_REQUIRED';

    const deliverableState = status === 'READY_FOR_REVIEW' ? 'READY_FOR_HUMAN_REVIEW' : status === 'BLOCKED' ? 'BLOCKED' : 'NOT_READY';
    const currentState = stateFor(status);

    return freeze({
      workflowId: definition.id,
      selectedGpId,
      status,
      currentState,
      states: [...WORKFLOW_STATES],
      availableTransitions: [...TRANSITIONS[currentState]],
      requiredEvidence,
      missingInformation,
      searchableMissingEvidence,
      nextAction: searchableMissingEvidence.length ? 'RETRIEVE_SEARCHABLE_AUTHORITY' : null,
      riskGates: definition.riskGates.map(gate => ({ gate, triggered: riskFlags.includes(gate) })),
      riskFlags,
      requiresHumanReview: true,
      deliverable: { type: definition.deliverable, state: deliverableState },
      handoff: { allowedTargets: [...definition.handoffTargets], requiresHumanDecision: true }
    });
  }

  window.GOVPROMPT_WORKFLOW_EXPANSION = Object.freeze({ plan, definitions: DEFINITIONS, states: WORKFLOW_STATES, transitions: TRANSITIONS });
})();
