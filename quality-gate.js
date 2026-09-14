(() => {
'use strict';
const STATUSES=Object.freeze({PASS:'PASS',NEEDS_INFO:'NEEDS_INFO',BLOCKED:'BLOCKED',REVIEW_REQUIRED:'REVIEW_REQUIRED',NOT_APPLICABLE:'NOT_APPLICABLE',MISSING_CATALOG:'MISSING_CATALOG'});
const MINIMUM_CONFIDENCE=.3, PDPA_FIELD_PATTERN=/บัตร|เลขประจำตัว|บัญชี|สุขภาพ|biometric/i;
const HIGH_RISK_PATTERN=/กฎหมาย|การเงิน|คลัง|พัสดุ|งบประมาณ|บุคคล|สิทธิ|อำนาจ|สภา|เบิกจ่าย|เดินทาง/i;
const VALID_CONCLUSIONS=new Set(['ยืนยันได้','ยืนยันได้เมื่อครบเงื่อนไข','ยังยืนยันไม่ได้']);
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
function decisionIntegrityCheck(d={}){
 if(d.enabled!==true)return {pass:true,status:'NOT_APPLICABLE',decisionLock:false,blockers:[],conclusionLevel:d.conclusionLevel||null};
 const blockers=[];
 if(d.factsChecked!==true)blockers.push('material-facts-not-checked');
 if(d.applicableAuthorityChecked!==true)blockers.push('applicable-authority-not-checked');
 if(d.legalVersionChecked!==true)blockers.push('legal-version-not-checked');
 if(d.ruleChainChecked!==true)blockers.push('rule-chain-not-checked');
 if(d.counterCheckCompleted!==true)blockers.push('counter-check-not-completed');
 if(d.primarySourceChecked!==true)blockers.push('primary-source-not-checked');
 const unresolved=Array.isArray(d.unresolvedPotentialReversals)?d.unresolvedPotentialReversals.filter(Boolean):[];
 if(unresolved.length)blockers.push('potential-reversal-unresolved');
 if(!VALID_CONCLUSIONS.has(String(d.conclusionLevel||'')))blockers.push('invalid-or-missing-conclusion-level');
 return {pass:!blockers.length,status:blockers.length?'BLOCKED_DECISION_INTEGRITY':'PASS',decisionLock:!!blockers.length,blockers,unresolvedPotentialReversals:clone(unresolved),conclusionLevel:d.conclusionLevel||null};
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
 const decisionGate=decisionIntegrityCheck(source.decisionIntegrity||{});
 let status=STATUSES.PASS;
 if(!transitionGate.pass||!decisionGate.pass)status=STATUSES.BLOCKED;else if(source.catalogStatus===STATUSES.MISSING_CATALOG)status=STATUSES.MISSING_CATALOG;else if(source.catalogStatus===STATUSES.NOT_APPLICABLE)status=STATUSES.NOT_APPLICABLE;else if(!hasSelection||fallback)status=STATUSES.BLOCKED;else if(missingInformation.length)status=STATUSES.NEEDS_INFO;else if(riskFlags.length||pdpaConcerns.length||confidence<MINIMUM_CONFIDENCE||unverified.length)status=STATUSES.REVIEW_REQUIRED;
 return freeze({status,decisionLock:!transitionGate.pass||!decisionGate.pass,checks:{completeness:{passed:providedFields.length>0&&!missingFields.length,providedFields,missingFields},requiredEvidence:{required:evidenceRequired||requiredEvidenceTypes.length>0,provided:evidenceProvided,requiredTypes:requiredEvidenceTypes,missingTypes:missingEvidenceTypes,unverifiedTypes:unverified,passed:(!evidenceRequired||evidenceProvided)&&!missingEvidenceTypes.length},missingInformation,riskFlags,confidence:{value:confidence,minimum:MINIMUM_CONFIDENCE,passed:confidence>=MINIMUM_CONFIDENCE},sourceReadiness:{ready:(evidenceProvided||!evidenceRequired)&&!missingEvidenceTypes.length,evidenceTypes:clone(source.evidence?.types||[]),verificationReady:!unverified.length},pdpaSecurity:{concerns:pdpaConcerns,requiresReview:!!pdpaConcerns.length},legalAuthorityTransition:transitionGate,decisionIntegrity:decisionGate,workflowReadiness:{ready:status===STATUSES.PASS&&transitionGate.pass&&decisionGate.pass}}});
}
function reasoningPolicy(category=''){
 if(!HIGH_RISK_PATTERN.test(String(category||'')))return '';
 return `\n\nมาตรฐานตรวจสอบก่อนสรุปสำหรับงานความเสี่ยงสูง\n- ใช้เฉพาะข้อเท็จจริงที่มีผลต่อคำตอบ และห้ามสมมติข้อเท็จจริงสำคัญ\n- ตรวจว่าฐานกฎหมาย/ระเบียบ/หลักเกณฑ์ใช้กับบุคคล หน่วยงาน เรื่อง และช่วงเวลาเกิดเหตุนี้จริง รวมทั้งฉบับแก้ไขและบทเฉพาะกาล โดยใช้แหล่งปฐมภูมิ/ทางการก่อน\n- ห้ามหยุดที่ข้อกฎหมายแรก ต้องตรวจนิยาม บทหลัก เงื่อนไข ข้อยกเว้น บทอ้างถึง บทต่อเนื่อง บทเฉพาะ สิทธิต่อเนื่อง เหตุระงับหรือสิ้นสุดสิทธิ หนังสือสั่งการ และแนววินิจฉัยที่อาจเปลี่ยนผล\n- ก่อนฟันธง ให้ตรวจฐานตรงข้ามเสมอ: ถ้าเบื้องต้นว่าไม่ได้ ให้หาฐานที่อาจทำให้ได้; ถ้าเบื้องต้นว่าได้ ให้หาฐานที่อาจทำให้ไม่ได้\n- ค้นไม่พบไม่เท่ากับไม่มี หากแหล่งสำคัญยังตรวจไม่ครบให้ระบุข้อจำกัด\n- สรุปได้เพียง: ยืนยันได้ / ยืนยันได้เมื่อครบเงื่อนไข / ยังยืนยันไม่ได้\n- ตอบแบบ Answer First: ข้อสรุปสั้น ระดับความแน่นอน ฐานสำคัญ เงื่อนไขที่เปลี่ยนผล และสิ่งที่ควรตรวจต่อ\n- อย่าเปิดเผยกระบวนการคิดภายในหรือรายการตรวจสอบภายในแก่ผู้ใช้; แสดงเฉพาะผลและเหตุผลที่จำเป็น`;
}
function installPromptPolicy(){
 if(typeof document==='undefined')return;
 const form=document.getElementById('promptForm'),output=document.getElementById('output');
 if(!form||!output||form.dataset.decisionIntegrityInstalled==='1')return;
 form.dataset.decisionIntegrityInstalled='1';
 const original=form.onsubmit;
 form.onsubmit=function(event){
   const result=typeof original==='function'?original.call(this,event):undefined;
   const category=globalThis.GOVPROMPT_CONTEXT?.get?.().category||'';
   const policy=reasoningPolicy(category);
   if(policy&&!output.textContent.includes('มาตรฐานตรวจสอบก่อนสรุปสำหรับงานความเสี่ยงสูง'))output.textContent+=policy;
   return result;
 };
 const copy=document.getElementById('copyBtn');
 if(copy)copy.onclick=async()=>{await navigator.clipboard.writeText(output.textContent||'');};
 const download=document.getElementById('downloadBtn');
 if(download)download.onclick=()=>{const b=new Blob([output.textContent||''],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='GovPrompt-V7.txt';a.click();URL.revokeObjectURL(u);};
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',installPromptPolicy,{once:true});
const api=Object.freeze({evaluate,statuses:STATUSES,decisionIntegrityCheck,reasoningPolicy});if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.GOVPROMPT_QUALITY_GATE=api;
})();
