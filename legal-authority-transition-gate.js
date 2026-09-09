(() => {
  'use strict';
  const BLOCKED_STATUS = 'BLOCKED_LATER_AUTHORITY_CHECK';
  const text=v=>String(v??'').trim();
  function dateValue(v){const s=text(v);if(!s)return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d;}
  function evaluate(input={}){
    if(input.precedentReliedOn!==true)return Object.freeze({pass:true,status:'NOT_APPLICABLE',decisionLock:false,blockers:[]});
    const precedentFactDate=dateValue(input.precedentFactDate),currentFactDate=dateValue(input.currentFactDate);
    const laterAuthorities=Array.isArray(input.laterAuthorities)?input.laterAuthorities:[];
    const unresolved=laterAuthorities.filter(a=>a?.relevant!==false&&a?.transitionResolved!==true);
    const blockers=[];
    if(!precedentFactDate)blockers.push('missing-precedent-fact-date');
    if(!currentFactDate)blockers.push('missing-current-fact-date');
    if(input.laterAuthoritySearchCompleted!==true)blockers.push('later-authority-search-not-completed');
    if(input.ruleVersionCheckCompleted!==true)blockers.push('rule-version-check-not-completed');
    if(input.contraryEvidenceCheckCompleted!==true)blockers.push('contrary-evidence-check-not-completed');
    if(precedentFactDate&&currentFactDate&&currentFactDate<precedentFactDate)blockers.push('timeline-not-resolved');
    if(unresolved.length)blockers.push('later-authority-effect-unresolved');
    const pass=!blockers.length;
    return Object.freeze({pass,status:pass?'PASS':BLOCKED_STATUS,decisionLock:!pass,blockers:Object.freeze(blockers),requirements:Object.freeze(['identify-precedent-fact-date-not-judgment-date','identify-current-fact-date','search-intervening-and-current-authorities','verify-event-time-and-current-rule-versions','resolve-effect-of-each-relevant-later-authority','perform-contrary-evidence-check'])});
  }
  function enforceDecisionState(state={},transition={}){const result=evaluate(transition);if(result.pass)return Object.freeze({...state,transitionGate:result});return Object.freeze({...state,decisionLock:true,qualityStatus:'UNVERIFIED',caseMatch:'NOT_ASSESSED',ruleInterpretationConfidence:'NOT_ASSESSED',workflowStatus:BLOCKED_STATUS,nextAction:'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK',transitionGate:result});}
  const api=Object.freeze({evaluate,enforceDecisionState,BLOCKED_STATUS});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.GOVPROMPT_LEGAL_TRANSITION_GATE=api;
})();
