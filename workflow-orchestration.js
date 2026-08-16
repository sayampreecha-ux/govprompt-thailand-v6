(() => {
  'use strict';

  const MISSING_CATALOG_WORKFLOWS = Object.freeze([
    Object.freeze({ id: 'personnel', supportedGpIds: Object.freeze([]) }),
    Object.freeze({ id: 'technical-boq-inspection', supportedGpIds: Object.freeze([]) }),
    Object.freeze({ id: 'local-council', supportedGpIds: Object.freeze([]) }),
    Object.freeze({ id: 'health-rpst-fund', supportedGpIds: Object.freeze([]) }),
    Object.freeze({ id: 'direct-financial-disbursement', supportedGpIds: Object.freeze([]) })
  ]);

  const HANDOFFS = Object.freeze([
    Object.freeze({ from: 'tor-procurement', to: 'legal-analysis' }),
    Object.freeze({ from: 'tor-procurement', to: 'official-letter-follow-up' }),
    Object.freeze({ from: 'legal-analysis', to: 'official-letter-follow-up' }),
    Object.freeze({ from: 'financial-disbursement', to: 'legal-analysis' }),
    Object.freeze({ from: 'financial-disbursement', to: 'official-letter-follow-up' })
  ]);

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function skeleton(workflowId) {
    const definition = MISSING_CATALOG_WORKFLOWS.find(item => item.id === workflowId);
    return freeze({
      workflowId: definition?.id || null,
      supportedGpIds: definition ? [...definition.supportedGpIds] : [],
      status: 'MISSING_CATALOG',
      currentState: 'not-applicable',
      requiredEvidence: [],
      riskGates: [],
      requiresHumanReview: true,
      deliverable: { type: null, state: 'NOT_READY' },
      handoff: { allowedTargets: [], requiresHumanDecision: true }
    });
  }

  function createHandoff(fromPlan, targetWorkflowId, confirmedByHuman) {
    const from = String(fromPlan?.workflowId || '');
    const allowed = HANDOFFS.some(item => item.from === from && item.to === targetWorkflowId);
    const sourceReady = fromPlan?.status === 'READY_FOR_REVIEW' && fromPlan?.deliverable?.state === 'READY_FOR_HUMAN_REVIEW';
    if (!allowed || !sourceReady || confirmedByHuman !== true) {
      return freeze({ status: 'BLOCKED', fromWorkflowId: from || null, targetWorkflowId: targetWorkflowId || null, requiresHumanConfirmation: true, context: {} });
    }
    return freeze({
      status: 'READY_FOR_HUMAN_REVIEW',
      fromWorkflowId: from,
      targetWorkflowId,
      requiresHumanConfirmation: true,
      context: { selectedGpId: fromPlan.selectedGpId || null, category: fromPlan.category || null, evidenceTypes: (fromPlan.requiredEvidence || []).filter(item => item.provided).map(item => item.type), riskFlags: [...(fromPlan.riskFlags || [])] }
    });
  }

  window.GOVPROMPT_WORKFLOW_ORCHESTRATION = Object.freeze({ missingCatalogWorkflows: MISSING_CATALOG_WORKFLOWS, handoffs: HANDOFFS, skeleton, createHandoff });
})();
