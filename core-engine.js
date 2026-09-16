(() => {
  'use strict';

  const RETRIEVAL_STATUS = Object.freeze({
    SEARCH_READY: 'SEARCH_READY',
    BLOCKED_MISSING_SCOPE: 'BLOCKED_MISSING_SCOPE',
    AUTHORITY_REQUIRED: 'AUTHORITY_REQUIRED',
    AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT: 'AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT',
    FINAL_DECISION_READY: 'FINAL_DECISION_READY'
  });

  const RETRIEVAL_FLOW = Object.freeze([
    'CURRENT_RULE','LATER_RULE_OR_AMENDMENT','TEMPORARY_MEASURE_OR_EXCEPTION','EXPIRY_OR_TRANSITION',
    'OFFICIAL_GUIDANCE_OR_PRECEDENT_WHEN_RELEVANT','CONFLICT_CHECK','CONTRARY_EVIDENCE_CHECK','APPLICABLE_RULE','DECISION_FACTS','FINAL_DECISION'
  ]);

  // Query-level trigger: authoritative rules can change the legal/financial consequence.
  // Deliberately excludes generic management-analysis words such as "รายได้" by themselves.
  const AUTHORITY_CASE_PATTERN = /กฎหมาย|ระเบียบ|หลักเกณฑ์|หนังสือสั่งการ|มติ|สิทธิ|อำนาจ|เบิก|เบิกจ่าย|จ่ายได้|พัสดุ|จัดซื้อ|งบประมาณ|ข้อบัญญัติ|แปรญัตติ|เดินทางไปราชการ|ค่าเช่า|เช่าซื้อ|งานก่อสร้าง|แต่งตั้ง|โอน|ย้าย|ภาษี|ค่าธรรมเนียม|เรียกเก็บ|ยกเว้น|ค้างชำระ|เสียภาษี|คิดเท่าไร|เก็บได้เท่าไร/i;
  // Category fallback is intentionally narrow. Finance/engineering categories alone must not
  // force legal retrieval for ordinary analysis; substantive query signals decide those cases.
  const AUTHORITY_CATEGORY_PATTERN = /กฎหมาย|งานบุคคล|บุคคล|สิทธิ|อำนาจ|สภาท้องถิ่น|สภา/i;
  const DEMONSTRATIVE_ONLY_PATTERN = /^(?:ทำ)?(?:อันนี้|แบบนี้|อย่างนี้|เรื่องนี้|กรณีนี้|นี่|นั้น)$/i;
  const GENERIC_ONLY_PATTERN = /^(?:ช่วย|ขอ|อยากทราบ|สอบถาม|ตรวจสอบ|เช็ก|ดู)?(?:ทำ|เบิก|จ่าย|ใช้|อนุมัติ|ดำเนินการ)?(?:ได้|ไม่ได้)?$/i;
  const PLACEHOLDER_PATTERN = /(?:\.\.\.|…|___+|\[ระบุ|xxx+)/i;
  const PAST_PRACTICE_WITHOUT_SUBJECT_PATTERN = /^(?:เมื่อก่อน|เดิม|ที่ผ่านมา)?\s*(?:หน่วยงาน)?\s*(?:เคย)?\s*(?:ทำ|ปฏิบัติ)(?:แบบนี้|อย่างนี้|เช่นนี้|มาแบบนี้)(?:มาตลอด|อยู่|ไว้)?(?:\s*ยัง(?:ทำ|ใช้|ปฏิบัติ)(?:ต่อ)?(?:ได้ไหม|ได้หรือไม่|ไหม))?$/i;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
  function valueOr(value, fallback) { return value === undefined || value === null ? fallback : value; }
  function text(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function unique(values) { return [...new Set(values.map(text).filter(Boolean))]; }

  function extractSubject(query) {
    const original = text(query);
    if (PLACEHOLDER_PATTERN.test(original)) return '';
    let subject = original
      .replace(/[?？]+$/g, '')
      .replace(/^(?:ช่วย|ขอ|อยากทราบ|สอบถาม|รบกวน|ตรวจสอบ|เช็ก|เช็ค|ดูให้หน่อย)\s*/i, '')
      .trim();
    subject = subject
      .replace(/(?:เบิก|ทำ|ใช้|จ่าย|อนุมัติ|ดำเนินการ)?\s*(?:ได้ไหม|ได้หรือไม่|หรือไม่|ไหม)\s*$/i, '')
      .replace(/(?:อย่างไร|ยังไง)\s*$/i, '')
      .trim();
    if (!subject || DEMONSTRATIVE_ONLY_PATTERN.test(subject) || GENERIC_ONLY_PATTERN.test(subject) || PAST_PRACTICE_WITHOUT_SUBJECT_PATTERN.test(original)) return '';
    return subject;
  }

  function extractIdentifiers(query, discoveredIdentifiers = []) {
    const source = text(query); const found = [];
    const patterns = [/(?:พ\.ศ\.\s*)?\d{4}/g,/(?:เลขที่|ที่)\s*[ก-ฮA-Za-z0-9.\/-]+(?:\s*\/\s*[วVv]?\s*\d+)?/g,/(?:มติ|คำสั่ง|ประกาศ|ระเบียบ|พระราชบัญญัติ|กฎกระทรวง)\s+[^,;\n]{3,80}/g];
    patterns.forEach(pattern => { const matches = source.match(pattern); if (matches) found.push(...matches); });
    return unique([...discoveredIdentifiers, ...found]);
  }

  function buildSearchVocabulary({ query = '', discoveredIdentifiers = [] } = {}) {
    const original = text(query); const subject = extractSubject(original);
    if (!subject) return Object.freeze([]);
    const identifiers = extractIdentifiers(original, discoveredIdentifiers);
    const withoutQuestionWords = text(subject.replace(/(?:ได้ไหม|ได้หรือไม่|หรือไม่|ไหม|อย่างไร|ยังไง)/gi, ''));
    return Object.freeze(unique([original, subject, withoutQuestionWords, ...identifiers]));
  }

  function evaluateOfficialAuthorityRetrieval({ query = '', discoveredIdentifiers = [] } = {}) {
    const subject = extractSubject(query); const subjectIdentifiable = Boolean(subject);
    return freeze({ policyVersion:'7.1', subject, subjectIdentifiable,
      status: subjectIdentifiable ? RETRIEVAL_STATUS.SEARCH_READY : RETRIEVAL_STATUS.BLOCKED_MISSING_SCOPE,
      action: subjectIdentifiable ? 'AUTHORITY_RETRIEVAL' : 'CLARIFY_SUBJECT',
      searchVocabulary: subjectIdentifiable ? buildSearchVocabulary({ query, discoveredIdentifiers }) : [],
      retrievalFlow: RETRIEVAL_FLOW,
      principle:'ข้อมูลไม่พอสำหรับตัดสิน ไม่ได้หมายความว่าข้อมูลไม่พอสำหรับเริ่มค้น' });
  }

  function assessDecisionSufficiency({ authoritySufficient, factsSufficient } = {}) {
    if (authoritySufficient !== true) return freeze({ authoritySufficient:false, factsSufficient:factsSufficient===true, status:RETRIEVAL_STATUS.AUTHORITY_REQUIRED, finalDecisionAllowed:false, nextAction:'CONTINUE_AUTHORITY_RETRIEVAL' });
    if (factsSufficient !== true) return freeze({ authoritySufficient:true, factsSufficient:false, status:RETRIEVAL_STATUS.AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT, finalDecisionAllowed:false, nextAction:'ANSWER_VERIFIED_GENERAL_RULE_THEN_ASK_DECISIVE_FACTS_ONLY' });
    return freeze({ authoritySufficient:true, factsSufficient:true, status:RETRIEVAL_STATUS.FINAL_DECISION_READY, finalDecisionAllowed:true, nextAction:'RUN_EXISTING_FINAL_DECISION_AND_QUALITY_GATES' });
  }

  function shouldApplyOfficialAuthorityRetrieval({ query = '', category = '' } = {}) {
    const q = text(query); const c = text(category);
    return AUTHORITY_CASE_PATTERN.test(q) || AUTHORITY_CATEGORY_PATTERN.test(c);
  }

  function officialAuthorityPromptPolicy({ query = '', category = '' } = {}) {
    if (!shouldApplyOfficialAuthorityRetrieval({ query, category })) return '';
    const scope = evaluateOfficialAuthorityRetrieval({ query });
    const vocabulary = scope.searchVocabulary.length ? scope.searchVocabulary.join(' | ') : '[ยังระบุ subject matter ไม่ได้]';
    const initialInstruction = scope.subjectIdentifiable
      ? `สถานะเริ่มต้น: SUBJECT IDENTIFIABLE → SEARCH ทันที\nSearch Vocabulary เริ่มต้นจาก Current Case เท่านั้น: ${vocabulary}`
      : 'สถานะเริ่มต้น: SUBJECT AMBIGUOUS → CLARIFY เฉพาะว่าเรื่องหรือการกระทำใดที่ต้องการตรวจ โดยใช้ BLOCKED_MISSING_SCOPE เฉพาะกรณีนี้';
    return `\n\nOfficial Authority Retrieval Gate — GovPrompt Thailand V7.1\nหลักกลาง: “ข้อมูลไม่พอสำหรับตัดสิน ไม่ได้หมายความว่าข้อมูลไม่พอสำหรับเริ่มค้น”\n${initialInstruction}\n- แยก Searchable ออกจาก Decidable: เมื่อระบุ subject matter ได้แล้ว ให้เริ่มค้นฐานอำนาจทันที แม้ WHO, ORG, TIME, BEFORE, RULE หรือ STAGE ยังไม่ครบ ห้ามใช้การขาดข้อมูลเหล่านี้เพียงอย่างเดียวเป็นเหตุ BLOCKED_MISSING_SCOPE\n- SUBJECT IDENTIFIABLE → SEARCH; SUBJECT AMBIGUOUS → CLARIFY\n- ห้ามถามข้อมูลที่สามารถค้นจากแหล่งราชการได้เอง ให้ถามภายหลังเฉพาะ decisive facts ที่หากเปลี่ยนแล้วจะเปลี่ยนผลการวินิจฉัย\n- ทุกเรื่องใหม่ต้องรีเซ็ต Search Vocabulary และสร้างใหม่จาก Current Case เท่านั้น: คำถามปัจจุบัน, subject matter, ศัพท์กฎหมาย/การเงิน/พัสดุ/บุคคลที่เกี่ยวข้องซึ่งปรากฏในกรณีนี้ และ identifiers ที่ค้นพบระหว่าง Retrieval ห้ามนำคำค้นจาก workflow, template หรือ case อื่นมาปน\n- เมื่อพบเลขหนังสือ วันที่ หน่วยงาน มติ ชื่อระเบียบ คำสั่ง ประกาศ หรือเอกสารอ้างถึง ให้ทำ Identifier Search และตามสายเอกสารต่อ\n- Retrieval Flow: Current Rule → Later Rule/Amendment → Temporary Measure/Exception → Expiry/Transition → Official Guidance/Precedent when relevant → Conflict Check → Contrary Evidence Check → Applicable Rule → Decision Facts → Final Decision\n- ตรวจ Applicable Rule ตามวันที่เกิดเหตุ ไม่เลือกเอกสารใหม่ที่สุดโดยอัตโนมัติ สำหรับกฎหรือมาตรการภายหลังต้องตรวจวันมีผล ผู้/กรณีที่ใช้ สิ่งที่แก้หรือแทน ถาวรหรือชั่วคราว วันสิ้นสุด/ขยายเวลา/บทเฉพาะกาล และผลต่อสิทธิหรือเหตุเดิม\n- หลัง Retrieval ให้แยก A. AUTHORITY_SUFFICIENT (ฐานอำนาจพออธิบายหลักเกณฑ์) ออกจาก B. FACTS_SUFFICIENT (ข้อเท็จจริงเฉพาะกรณีพอฟันธง)\n- ถ้า A ผ่านแต่ B ไม่ผ่าน ห้ามย้อนเป็น BLOCKED_MISSING_SCOPE: ให้ตอบหลักทั่วไปที่ยืนยันได้ก่อน ใช้ ⚠️ ได้โดยมีเงื่อนไข หรือ 🔎 หลักฐานยังไม่พอที่จะฟันธงตามความเหมาะสม แล้วถามเฉพาะ decisive facts ที่ขาด\n- ถ้า A และ B ผ่าน จึงเข้าสู่ Final Decision เดิม 4 สถานะ: ✅ ได้ / ❌ ไม่ได้ / ⚠️ ได้โดยมีเงื่อนไข / 🔎 หลักฐานยังไม่พอที่จะฟันธง\n- คง Decision Gate, Multi-condition Gate, Legal Version Gate, Evidence Gate, Applicable Authority Check, Contrary Evidence Check และ Human Approval เดิมทั้งหมด และห้ามข้าม Quality Gates เดิมก่อน Final Decision\n- ห้าม hard-code ผลกฎหมาย อัตรา ตัวเลข เลขหนังสือ หรือ identifier เฉพาะเรื่องเป็นความจริงถาวร ต้องได้มาจาก Retrieval ของ Current Case และตรวจ applicability ทุกครั้ง`;
  }

  function currentCaseText(source = {}) { const values=Object.values(source.userInputs||{}).map(text).filter(Boolean); return unique([text(source.query),...values]).join(' '); }
  function prepare(context) {
    const source=context||{}; const caseQuery=currentCaseText(source); const retrieval=evaluateOfficialAuthorityRetrieval({query:caseQuery});
    return freeze({ version:7, coreRevision:'7.1', task:{query:String(valueOr(source.query,'')),selectedGpId:source.selectedGpId||null,category:source.category||null}, userInputs:clone(source.userInputs||{}), routing:{score:Number(source.routing?.score)||0,confidence:Number(source.routing?.confidence)||0,matchedReason:String(source.routing?.matchedReason||''),fallback:source.routing?.fallback!==false}, evidence:{provided:source.evidence?.provided===true,types:clone(source.evidence?.types||[]),count:Number(source.evidence?.count)||0,records:clone(source.evidence?.records||[]),requiredTypes:clone(source.evidence?.requiredTypes||[])}, officialAuthorityRetrieval:clone(source.officialAuthorityRetrieval||retrieval), legalTransition:clone(source.legalTransition||{}), decisionIntegrity:clone(source.decisionIntegrity||{}), eventContinuity:clone(source.eventContinuity||{}), riskFlags:clone(source.riskFlags||[]), workflowState:String(valueOr(source.workflowState,'idle')) });
  }

  function installOfficialAuthorityPromptPolicy() {
    if (typeof document==='undefined') return;
    const form=document.getElementById('promptForm'); const output=document.getElementById('output');
    if(!form||!output||form.dataset.officialAuthorityRetrievalInstalled==='1') return;
    form.dataset.officialAuthorityRetrievalInstalled='1'; const original=form.onsubmit;
    form.onsubmit=function(event){ const result=typeof original==='function'?original.call(this,event):undefined; const context=globalThis.GOVPROMPT_CONTEXT?.get?.()||{}; const caseQuery=currentCaseText(context); const policy=officialAuthorityPromptPolicy({query:caseQuery,category:context.category||''}); if(policy&&!output.textContent.includes('Official Authority Retrieval Gate — GovPrompt Thailand V7.1')) output.textContent+=policy; return result; };
  }

  if (typeof document!=='undefined') document.addEventListener('DOMContentLoaded',installOfficialAuthorityPromptPolicy,{once:true});
  const officialAuthorityRetrievalGate=Object.freeze({evaluateScope:evaluateOfficialAuthorityRetrieval,buildSearchVocabulary,assessDecisionSufficiency,shouldApply:shouldApplyOfficialAuthorityRetrieval,promptPolicy:officialAuthorityPromptPolicy,statuses:RETRIEVAL_STATUS,retrievalFlow:RETRIEVAL_FLOW});
  const api=Object.freeze({prepare,officialAuthorityRetrievalGate});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.GOVPROMPT_CORE_ENGINE=api;
})();
