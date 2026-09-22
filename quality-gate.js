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
function eventContinuityCheck(c={}){
 if(c.required!==true)return {pass:true,status:'NOT_APPLICABLE',decisionLock:false,blockers:[],unresolvedContinuityIssues:[]};
 const blockers=[];
 if(c.eventClassificationChecked!==true)blockers.push('event-classification-not-checked');
 if(c.rightContinuityChecked!==true)blockers.push('right-continuity-not-checked');
 if(c.multipleLegalBasisChecked!==true)blockers.push('multiple-legal-basis-not-checked');
 if(c.timelineChecked!==true)blockers.push('timeline-not-checked');
 if(c.continuityOverrideChecked!==true)blockers.push('continuity-override-not-checked');
 if(c.finalCounterCheckCompleted!==true)blockers.push('continuity-final-counter-check-not-completed');
 const unresolved=Array.isArray(c.unresolvedContinuityIssues)?c.unresolvedContinuityIssues.filter(Boolean):[];
 if(unresolved.length)blockers.push('continuity-issue-unresolved');
 return {pass:!blockers.length,status:blockers.length?'BLOCKED_EVENT_CONTINUITY':'PASS',decisionLock:!!blockers.length,blockers,unresolvedContinuityIssues:clone(unresolved)};
}
function evaluate(envelope){
 const source=envelope||{},inputs=source.userInputs||{},entries=Object.entries(inputs);
 const missingFields=entries.filter(([,v])=>!String(v||'').trim()).map(([f])=>f),providedFields=entries.filter(([,v])=>String(v||'').trim()).map(([f])=>f);
 const riskFlags=[...new Set((source.riskFlags||[]).map(String))],confidence=Number(source.routing?.confidence)||0,fallback=source.routing?.fallback!==false,hasSelection=Boolean(source.task?.selectedGpId);
 const evidenceRequired=riskFlags.includes('evidence-required'),evidenceProvided=source.evidence?.provided===true||(Number(source.evidence?.count)||0)>0,evidenceRecords=Array.isArray(source.evidence?.records)?source.evidence.records:[],requiredEvidenceTypes=[...new Set((source.evidence?.requiredTypes||[]).map(String))];
 const supplied=new Set(evidenceRecords.filter(r=>['supplied','needs-verification','verified-by-human'].includes(r?.status)).map(r=>String(r.type))),unverified=requiredEvidenceTypes.filter(type=>evidenceRecords.find(r=>String(r?.type)===type)?.status!=='verified-by-human'),missingEvidenceTypes=requiredEvidenceTypes.filter(type=>!supplied.has(type));
 const pdpaFields=entries.map(([f])=>f).filter(f=>PDPA_FIELD_PATTERN.test(f)),pdpaConcerns=pdpaFields.length?['personal-data-field-present']:[],missingInformation=[];
 if(!providedFields.length)missingInformation.push('user-inputs');
 if(evidenceRequired&&!evidenceProvided)missingInformation.push('required-evidence');
 missingEvidenceTypes.forEach(type=>missingInformation.push(`required-evidence:${type}`));
 const transitionGate=globalThis.GOVPROMPT_LEGAL_TRANSITION_GATE?.evaluate?.(source.legalTransition||{})||transitionFallback(source.legalTransition||{});
 const budgetAuthorityGate=globalThis.GOVPROMPT_BUDGET_AUTHORITY_GATE?.evaluate?.(source)||{applicable:false,status:'NOT_APPLICABLE',decisionLock:false,blockers:[]};
 const decisionGate=decisionIntegrityCheck(source.decisionIntegrity||{});
 const continuityGate=eventContinuityCheck(source.eventContinuity||{});
 const finalDecisionLocked=!transitionGate.pass||!decisionGate.pass||!continuityGate.pass||budgetAuthorityGate.decisionLock;
 let status=STATUSES.PASS;
 // A final-decision lock must not block verified partial answers or authority retrieval.
 if(source.catalogStatus===STATUSES.MISSING_CATALOG)status=STATUSES.MISSING_CATALOG;
 else if(source.catalogStatus===STATUSES.NOT_APPLICABLE)status=STATUSES.NOT_APPLICABLE;
 else if(!hasSelection||fallback)status=STATUSES.BLOCKED;
 else if(missingInformation.length)status=STATUSES.NEEDS_INFO;
 else if(finalDecisionLocked||riskFlags.length||pdpaConcerns.length||confidence<MINIMUM_CONFIDENCE||unverified.length)status=STATUSES.REVIEW_REQUIRED;
 return freeze({
   status,
   decisionLock:finalDecisionLocked,
   partialAnswerAllowed:hasSelection&&!fallback,
   checks:{
     completeness:{passed:providedFields.length>0&&!missingFields.length,providedFields,missingFields},
     requiredEvidence:{required:evidenceRequired||requiredEvidenceTypes.length>0,provided:evidenceProvided,requiredTypes:requiredEvidenceTypes,missingTypes:missingEvidenceTypes,unverifiedTypes:unverified,passed:(!evidenceRequired||evidenceProvided)&&!missingEvidenceTypes.length},
     missingInformation,
     riskFlags,
     confidence:{value:confidence,minimum:MINIMUM_CONFIDENCE,passed:confidence>=MINIMUM_CONFIDENCE},
     sourceReadiness:{ready:(evidenceProvided||!evidenceRequired)&&!missingEvidenceTypes.length,evidenceTypes:clone(source.evidence?.types||[]),verificationReady:!unverified.length},
     pdpaSecurity:{concerns:pdpaConcerns,requiresReview:!!pdpaConcerns.length},
     legalAuthorityTransition:transitionGate,
     budgetAuthority:budgetAuthorityGate,
     decisionIntegrity:decisionGate,
     eventContinuity:continuityGate,
     workflowReadiness:{ready:status===STATUSES.PASS&&transitionGate.pass&&decisionGate.pass&&continuityGate.pass&&!budgetAuthorityGate.decisionLock},
     partialAnswerReadiness:{ready:hasSelection&&!fallback,finalDecisionLocked}
   }
 });
}
function reasoningPolicy(category=''){
 if(!HIGH_RISK_PATTERN.test(String(category||'')))return '';
 return `\n\nมาตรฐานตรวจสอบงานความเสี่ยงสูง — Adaptive Review\n- ใช้ข้อเท็จจริงและเอกสารที่ผู้ใช้ให้ก่อน แล้วตรวจฐานปฐมภูมิที่ตรงเรื่องและฉบับที่ใช้กับวันเกิดเหตุ; ห้ามสมมติข้อเท็จจริงสำคัญ\n- เริ่มจากหลักฐานที่มี → กฎหลัก → เอกสารที่อ้างตรง → ฉบับแก้ไข/ยกเลิกที่เกี่ยวข้อง → เทียบข้อเท็จจริง → contrary check แบบเจาะจง แล้วประเมินว่าพอหรือยัง\n- High Risk ไม่เท่ากับค้นทุกฐานข้อมูล: ถ้าฐานปฐมภูมิที่ตรงเรื่องและเงื่อนไขสำคัญพอแล้ว ให้หยุดค้นและตอบ; ยกระดับการค้นเฉพาะเมื่อพบ conflict, ฉบับที่ใช้ไม่ชัด, บทเฉพาะกาล/สิทธิเดิม, ข้อยกเว้นสำคัญ หรือจำเป็นต้องพึ่งคำพิพากษา/หนังสือหารือ\n- Multi-condition Gate: ห้ามสรุปสิทธิ อำนาจ การเบิกจ่าย พัสดุ หรือผลทางบุคคลจากเงื่อนไขเพียงข้อเดียว ต้องเทียบเงื่อนไขสาระสำคัญกับข้อเท็จจริงก่อน\n- เมื่อมีเหตุเปลี่ยนสถานะหรือท้องที่ ห้ามยึดชื่อที่ผู้ใช้เรียก เช่น ย้าย โอน สอบได้ บรรจุ แต่งตั้ง หรือเลื่อนระดับ ให้จำแนกผลทางกฎหมายของเหตุการณ์จริงจากคำสั่งและตัวบทก่อน\n- หากมีสิทธิเดิม ให้ตรวจสิทธิเดิม → เหตุเปลี่ยนสถานะ/ท้องที่ → บทต่อเนื่องหรือบทคุ้มครอง → เงื่อนไขสถานะใหม่ → เหตุระงับ/สิ้นสุด → สิทธิหลังเหตุการณ์\n- หากเหตุการณ์เดียวเกี่ยวข้องหลายสิทธิหรือหลายฐานกฎหมาย ให้แยกฐาน เงื่อนไข ระยะเวลา และเพดานของแต่ละสิทธิ ห้ามยืมเงื่อนไขของสิทธิหนึ่งไปตัดอีกสิทธิโดยไม่มีฐานกฎหมาย\n- เมื่อสิทธิเปลี่ยนกลางเดือนหรือกลางเหตุการณ์ ให้ตรวจวันที่คำสั่งมีผล วันที่รายงานตัว วันที่เริ่มสถานะใหม่ ช่วงสิทธิเดิม/ใหม่ ช่วงซ้อน ช่วงขาด และความเสี่ยงการเบิกซ้ำก่อนคำนวณวันหรือเงิน\n- ก่อนฟันธง ให้ทำ contrary check อย่างน้อยหนึ่งรอบแบบเจาะจงต่อ tentative conclusion; ไม่ต้องเปิด Full Search ใหม่ทั้งหมดหากไม่พบ lead น้ำหนักสูงที่อาจกลับผล\n- Decision Lock ใช้ห้ามฟันธง “ยืนยันได้” เมื่อฐานสำคัญยังไม่ครบ แต่ไม่ห้ามตอบส่วนที่ยืนยันแล้วหรือสรุป “ยืนยันได้เมื่อครบเงื่อนไข / ยังยืนยันไม่ได้” พร้อมสิ่งที่ขาด\n- ค้นไม่พบไม่เท่ากับไม่มี; หากแหล่งสำคัญยังตรวจไม่ครบให้ระบุข้อจำกัด แต่ห้ามค้นต่อเพียงเพื่อเพิ่มจำนวนแหล่งอ้างอิง\n- สรุปได้เพียง: ยืนยันได้ / ยืนยันได้เมื่อครบเงื่อนไข / ยังยืนยันไม่ได้\n- ตอบแบบ Answer First: ข้อสรุปสั้น ระดับความแน่นอน ฐานสำคัญ เงื่อนไขที่เปลี่ยนผล และสิ่งที่ควรตรวจต่อ\n- อย่าเปิดเผยกระบวนการคิดภายในหรือ checklist ภายในแก่ผู้ใช้; แสดงเฉพาะผล เหตุผล และหลักฐานที่จำเป็น`;
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
   if(policy&&!output.textContent.includes('มาตรฐานตรวจสอบงานความเสี่ยงสูง — Adaptive Review'))output.textContent+=policy;
   return result;
 };
 const copy=document.getElementById('copyBtn');
 if(copy)copy.onclick=async()=>{await navigator.clipboard.writeText(output.textContent||'');};
 const download=document.getElementById('downloadBtn');
 if(download)download.onclick=()=>{const b=new Blob([output.textContent||''],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='GovPrompt-V7.txt';a.click();URL.revokeObjectURL(u);};
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',installPromptPolicy,{once:true});
const api=Object.freeze({evaluate,statuses:STATUSES,decisionIntegrityCheck,eventContinuityCheck,reasoningPolicy});if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.GOVPROMPT_QUALITY_GATE=api;
})();
