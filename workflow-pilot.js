(() => {
  'use strict';

  const WORKFLOW_ID = 'official-letter-draft-pilot';
  const PILOT_GP_ID = 'GP001';
  const STEPS = Object.freeze(['review-inputs', 'generate-existing-prompt', 'human-review']);

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function plan(envelope, qualityResult) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    if (selectedGpId !== PILOT_GP_ID) {
      return freeze({ workflowId: WORKFLOW_ID, selectedGpId, status: 'NOT_APPLICABLE', steps: [], requiresHumanReview: true });
    }

    const qualityStatus = qualityResult?.status || 'BLOCKED';
    const status = {
      PASS: 'READY_FOR_REVIEW',
      NEEDS_INFO: 'NEEDS_INFO',
      REVIEW_REQUIRED: 'REVIEW_REQUIRED',
      BLOCKED: 'BLOCKED'
    }[qualityStatus] || 'BLOCKED';

    return freeze({
      workflowId: WORKFLOW_ID,
      selectedGpId,
      status,
      steps: status === 'BLOCKED' ? [] : [...STEPS],
      requiresHumanReview: true
    });
  }

  window.GOVPROMPT_WORKFLOW_PILOT = Object.freeze({ plan, workflowId: WORKFLOW_ID, pilotGpId: PILOT_GP_ID });
})();
