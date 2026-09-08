(() => {
'use strict';
const STATUSES=Object.freeze({PASS:'PASS',NEEDS_INFO:'NEEDS_INFO',BLOCKED:'BLOCKED',REVIEW_REQUIRED:'REVIEW_REQUIRED',NOT_APPLICABLE:'NOT_APPLICABLE',MISSING_CATALOG:'MISSING_CATALOG'});
const MINIMUM_CONFIDENCE=.3, PDPA_FIELD_PATTERN=/บัตร|เลขประจำตัว|บัญชี|สุขภาพ|biometric/i;
const clone=v=>JSON.parse(JSON.stringify(v));
function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;Object.values(v).forEach(freeze);return Object.freeze(v)}
function transitionFallback(t={}){
 if(t.precedentReliedOn!==true)return {pass:true,status:'NOT_APPLICABLE',decisionLock:false,blockers:[]};
 const blockers=[];
 if(!String(t.precedentFactDate||'').trim())blockers.push('missing-precedent-fact-date');
 if(!String(t.currentFactDate||'').trim())blockers.push('missing-current-fact-date');
 if(t.laterAuthoritySearchCompleted!==true)blockers.push('later-authority-search-not-completed');
 if(t.ruleVersionCheckCompleted!==true)blockers.push('rule-version-check-not-completed');
 if(t.contraryEvidenceCheckCompleted!==true)blockers.push('contrary-evidence-check-not-completed');
 const unresolved=(Array.isArray(t.laterAuthorities)?t.laterAuthorities:[]).some(a=>a?.relevant!==false&&a?.transitionResolved!==true);
 if(unresolved)blockers.push('later-authority-effect-unresolved');
 return {pass:!blockers.length,status:blockers.length?'BLOCKED_LATER_AUTHORITY_CHECK':'PASS',decisionLock:!!blockers.length,blockers};
}
function evaluate(envelope){
 const source=envelope||{},inputs=source.userInputs||{},entries=Object.entries(inputs);
 const missingFields=entries.filter(([,v])=>!String(v||'').trim()).map(([f])=>f),providedFields=entries.filter(([,v])=>String(v||'').trim()).map(([f])=>f);
 const riskFlags=[...new Set((source.riskFlags||[]).map(String))],confidence=Number(source.routing?.confidence)||0,fallback=source.routing?.fallback!==false,hasSelection=Boolean(source.task?.selectedGpId);
 const evidenceRequired=riskFlags.includes('evidence-required'),evidenceProvided=source.evidence?.provided===true||(Number(source.evidence?.count)||0)>0,evidenceRecords=Array.isArray(source.evidence?.records)?source.evidence.records:[],requiredEvidenceTypes=[...new Set((source.evidence?.requiredTypes||[]).map(String))];
 const supplied=new Set(evidenceRecords.filter(r=>['supplied','needs-verification','verified-by-human'].includes(r?.status)).map(r=>String(r.type))),unverified=requiredEvidenceTypes.filter(type=>evidenceRecords.find(r=>String(r?.type)===type)?.status!=='verified-by-human'),missingEvidenceTypes=requiredEvidenceTypes.filter(type=>!supplied.has(type));
 const pdpaFields=entries.map(([f])=>f).filter(f=>PDPA_FIELD_PATTERN.test(f)),pdpaConcerns=pdpaFields.length?['personal-data-field-present']:[],missingInformation=[];
 if(!providedFields.length)missingInformation.push('user-inputs');if(evidenceRequired&&!evidenceProvided)missingInformation.push('required-evidence');missingEvidenceTypes.forEach(type=>missingInformation.push(`required-evidence:${type}`));
 const transitionGate=globalThis.GOVPROMPT_LEGAL_TRANSITION_GATE?.evaluate?.(source.legalTransition||{})||transitionFallback(source.legalTransition||{});
 let status=STATUSES.PASS;
 if(!transitionGate.pass)status=STATUSES.BLOCKED;else if(source.catalogStatus===STATUSES.MISSING_CATALOG)status=STATUSES.MISSING_CATALOG;else if(source.catalogStatus===STATUSES.NOT_APPLICABLE)status=STATUSES.NOT_APPLICABLE;else if(!hasSelection||fallback)status=STATUSES.BLOCKED;else if(missingInformation.length)status=STATUSES.NEEDS_INFO;else if(riskFlags.length||pdpaConcerns.length||confidence<MINIMUM_CONFIDENCE||unverified.length)status=STATUSES.REVIEW_REQUIRED;
 return freeze({status,decisionLock:!transitionGate.pass,checks:{completeness:{passed:providedFields.length>0&&!missingFields.length,providedFields,missingFields},requiredEvidence:{required:evidenceRequired||requiredEvidenceTypes.length>0,provided:evidenceProvided,requiredTypes:requiredEvidenceTypes,missingTypes:missingEvidenceTypes,unverifiedTypes:unverified,passed:(!evidenceRequired||evidenceProvided)&&!missingEvidenceTypes.length},missingInformation,riskFlags,confidence:{value:confidence,minimum:MINIMUM_CONFIDENCE,passed:confidence>=MINIMUM_CONFIDENCE},sourceReadiness:{ready:(evidenceProvided||!evidenceRequired)&&!missingEvidenceTypes.length,evidenceTypes:clone(source.evidence?.types||[]),verificationReady:!unverified.length},pdpaSecurity:{concerns:pdpaConcerns,requiresReview:!!pdpaConcerns.length},legalAuthorityTransition:transitionGate,workflowReadiness:{ready:status===STATUSES.PASS&&transitionGate.pass}}});
}
const api=Object.freeze({evaluate,statuses:STATUSES});if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.GOVPROMPT_QUALITY_GATE=api;
})();
