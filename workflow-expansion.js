(() => {
  'use strict';

  const QUALITY_STATUS = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });
  const WORKFLOW_STATES = Object.freeze(['intake', 'collecting-evidence', 'risk-review', 'human-review', 'deliverable-ready', 'blocked', 'not-applicable']);

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
      // GP019 remains an executive-summary prompt. This workflow only structures a review brief; it never approves a payment.
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function definitionFor(gpId) {
    return DEFINITIONS.find(definition => definition.gpIds.includes(gpId)) || null;
  }

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
        riskGates: [],
        requiresHumanReview: true,
        deliverable: { type: null, state: 'NOT_READY' },
        handoff: { allowedTargets: [], requiresHumanDecision: true }
      });
    }

    const qualityStatus = qualityResult?.status || QUALITY_STATUS.BLOCKED;
    const status = statusFor(qualityStatus);
    const qualityChecks = qualityResult?.checks || {};
    const missingInformation = clone(qualityChecks.missingInformation || []);
    const riskFlags = [...new Set([...(envelope?.riskFlags || []), ...(qualityChecks.riskFlags || []), ...(qualityChecks.pdpaSecurity?.concerns || [])].map(String))];
    const evidenceTypes = new Set((envelope?.evidence?.types || []).map(String));
    const requiredEvidence = definition.requiredEvidence.map(type => ({ type, provided: evidenceTypes.has(type) }));
    const deliverableState = status === 'READY_FOR_REVIEW' ? 'READY_FOR_HUMAN_REVIEW' : status === 'BLOCKED' ? 'BLOCKED' : 'NOT_READY';

    return freeze({
      workflowId: definition.id,
      selectedGpId,
      status,
      currentState: stateFor(status),
      states: [...WORKFLOW_STATES],
      requiredEvidence,
      missingInformation,
      riskGates: definition.riskGates.map(gate => ({ gate, triggered: riskFlags.includes(gate) })),
      riskFlags,
      requiresHumanReview: true,
      deliverable: { type: definition.deliverable, state: deliverableState },
      handoff: { allowedTargets: [...definition.handoffTargets], requiresHumanDecision: true }
    });
  }

  window.GOVPROMPT_WORKFLOW_EXPANSION = Object.freeze({ plan, definitions: DEFINITIONS, states: WORKFLOW_STATES });
})();
