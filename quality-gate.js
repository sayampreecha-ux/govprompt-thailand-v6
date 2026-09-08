(() => {
  'use strict';

  const STATUSES = Object.freeze({ PASS:'PASS', NEEDS_INFO:'NEEDS_INFO', BLOCKED:'BLOCKED', REVIEW_REQUIRED:'REVIEW_REQUIRED', NOT_APPLICABLE:'NOT_APPLICABLE', MISSING_CATALOG:'MISSING_CATALOG' });
  const MINIMUM_CONFIDENCE = 0.3;
  const PDPA_FIELD_PATTERN = /บัตร|เลขประจำตัว|บัญชี|สุขภาพ|biometric/i;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function evaluate(envelope) {
    const source = envelope || {};
    const inputs = source.userInputs || {};
    const entries = Object.entries(inputs);
    const missingFields = entries.filter(([,v])=>!String(v||'').trim()).map(([f])=>f);
    const providedFields = entries.filter(([,v])=>String(v||'').trim()).map(([f])=>f);
    const riskFlags = [...new Set((source.riskFlags || []).map(String))];
    const confidence = Number(source.routing?.confidence) || 0;
    const fallback = source.routing?.fallback !== false;
    const hasSelection = Boolean(source.task?.selectedGpId);
    const evidenceRequired = riskFlags.includes('evidence-required');
    const evidenceProvided = source.evidence?.provided === true || (Number(source.evidence?.count)||0)>0;
    const evidenceRecords = Array.isArray(source.evidence?.records) ? source.evidence.records : [];
    const requiredEvidenceTypes = [...new Set((source.evidence?.requiredTypes || []).map(String))];
    const suppliedEvidenceTypes = new Set(evidenceRecords.filter(r=>['supplied','needs-verification','verified-by-human'].includes(r?.status)).map(r=>String(r.type)));
    const unverifiedEvidenceTypes = requiredEvidenceTypes.filter(type=>evidenceRecords.find(r=>String(r?.type)===type)?.status!=='verified-by-human');
    const missingEvidenceTypes = requiredEvidenceTypes.filter(type=>!suppliedEvidenceTypes.has(type));
    const pdpaFields = entries.map(([f])=>f).filter(f=>PDPA_FIELD_PATTERN.test(f));
    const pdpaConcerns = pdpaFields.length ? ['personal-data-field-present'] : [];
    const missingInformation = [];
    if (!providedFields.length) missingInformation.push('user-inputs');
    if (evidenceRequired && !evidenceProvided) missingInformation.push('required-evidence');
    missingEvidenceTypes.forEach(type=>missingInformation.push(`required-evidence:${type}`));

    const transitionGate = globalThis.GOVPROMPT_LEGAL_TRANSITION_GATE?.evaluate?.(source.legalTransition || {}) || { pass:true, status:'NOT_APPLICABLE', decisionLock:false, blockers:[] };

    let status = STATUSES.PASS;
    if (!transitionGate.pass) status = STATUSES.BLOCKED;
    else if (source.catalogStatus === STATUSES.MISSING_CATALOG) status = STATUSES.MISSING_CATALOG;
    else if (source.catalogStatus === STATUSES.NOT_APPLICABLE) status = STATUSES.NOT_APPLICABLE;
    else if (!hasSelection || fallback) status = STATUSES.BLOCKED;
    else if (missingInformation.length) status = STATUSES.NEEDS_INFO;
    else if (riskFlags.length || pdpaConcerns.length || confidence < MINIMUM_CONFIDENCE || unverifiedEvidenceTypes.length) status = STATUSES.REVIEW_REQUIRED;

    return freeze({
      status,
      decisionLock: !transitionGate.pass,
      checks: {
        completeness:{ passed:providedFields.length>0 && missingFields.length===0, providedFields, missingFields },
        requiredEvidence:{ required:evidenceRequired||requiredEvidenceTypes.length>0, provided:evidenceProvided, requiredTypes:requiredEvidenceTypes, missingTypes:missingEvidenceTypes, unverifiedTypes:unverifiedEvidenceTypes, passed:(!evidenceRequired||evidenceProvided)&&!missingEvidenceTypes.length },
        missingInformation,
        riskFlags,
        confidence:{ value:confidence, minimum:MINIMUM_CONFIDENCE, passed:confidence>=MINIMUM_CONFIDENCE },
        sourceReadiness:{ ready:(evidenceProvided||!evidenceRequired)&&!missingEvidenceTypes.length, evidenceTypes:clone(source.evidence?.types||[]), verificationReady:!unverifiedEvidenceTypes.length },
        pdpaSecurity:{ concerns:pdpaConcerns, requiresReview:pdpaConcerns.length>0 },
        legalAuthorityTransition: transitionGate,
        workflowReadiness:{ ready:status===STATUSES.PASS && transitionGate.pass }
      }
    });
  }

  const api = Object.freeze({ evaluate, statuses:STATUSES });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_QUALITY_GATE = api;
})();
