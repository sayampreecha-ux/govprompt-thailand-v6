(() => {
  'use strict';

  const STATUSES = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });
  const MINIMUM_CONFIDENCE = 0.3;
  const PDPA_FIELD_PATTERN = /บัตร|เลขประจำตัว|บัญชี|สุขภาพ|biometric/i;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function evaluate(envelope) {
    const source = envelope || {};
    const inputs = source.userInputs || {};
    const entries = Object.entries(inputs);
    const missingFields = entries.filter(([, value]) => !String(value || '').trim()).map(([field]) => field);
    const providedFields = entries.filter(([, value]) => String(value || '').trim()).map(([field]) => field);
    const riskFlags = [...new Set((source.riskFlags || []).map(String))];
    const confidence = Number(source.routing?.confidence) || 0;
    const fallback = source.routing?.fallback !== false;
    const hasSelection = Boolean(source.task?.selectedGpId);
    const evidenceRequired = riskFlags.includes('evidence-required');
    const evidenceProvided = source.evidence?.provided === true || (Number(source.evidence?.count) || 0) > 0;
    const pdpaFields = entries.map(([field]) => field).filter(field => PDPA_FIELD_PATTERN.test(field));
    const pdpaConcerns = pdpaFields.length ? ['personal-data-field-present'] : [];
    const missingInformation = [];
    if (!providedFields.length) missingInformation.push('user-inputs');
    if (evidenceRequired && !evidenceProvided) missingInformation.push('required-evidence');

    let status = STATUSES.PASS;
    if (!hasSelection || fallback) status = STATUSES.BLOCKED;
    else if (missingInformation.length) status = STATUSES.NEEDS_INFO;
    else if (riskFlags.length || pdpaConcerns.length || confidence < MINIMUM_CONFIDENCE) status = STATUSES.REVIEW_REQUIRED;

    return freeze({
      status,
      checks: {
        completeness: { passed: providedFields.length > 0 && missingFields.length === 0, providedFields, missingFields },
        requiredEvidence: { required: evidenceRequired, provided: evidenceProvided, passed: !evidenceRequired || evidenceProvided },
        missingInformation,
        riskFlags,
        confidence: { value: confidence, minimum: MINIMUM_CONFIDENCE, passed: confidence >= MINIMUM_CONFIDENCE },
        sourceReadiness: { ready: evidenceProvided || !evidenceRequired, evidenceTypes: clone(source.evidence?.types || []) },
        pdpaSecurity: { concerns: pdpaConcerns, requiresReview: pdpaConcerns.length > 0 },
        workflowReadiness: { ready: status === STATUSES.PASS }
      }
    });
  }

  window.GOVPROMPT_QUALITY_GATE = Object.freeze({ evaluate, statuses: STATUSES });
})();
