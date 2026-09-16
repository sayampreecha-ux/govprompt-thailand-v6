(() => {
  'use strict';

  const RETRIEVAL_STATUS = Object.freeze({
    SEARCH_READY: 'SEARCH_READY',
    BLOCKED_MISSING_SCOPE: 'BLOCKED_MISSING_SCOPE',
    AUTHORITY_REQUIRED: 'AUTHORITY_REQUIRED',
    AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT: 'AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT',
    FINAL_DECISION_READY: 'FINAL_DECISION_READY'
  });

  // Kept for backward compatibility with existing tests and integrations.
  const RETRIEVAL_FLOW = Object.freeze([
    'CURRENT_RULE',
    'LATER_RULE_OR_AMENDMENT',
    'TEMPORARY_MEASURE_OR_EXCEPTION',
    'EXPIRY_OR_TRANSITION',
    'OFFICIAL_GUIDANCE_OR_PRECEDENT_WHEN_RELEVANT',
    'CONFLICT_CHECK',
    'CONTRARY_EVIDENCE_CHECK',
    'APPLICABLE_RULE',
    'DECISION_FACTS',
    'FINAL_DECISION'
  ]);

  const FAST_RETRIEVAL_FLOW = Object.freeze([
    'PROVIDED_EVIDENCE',
    'PRIMARY_RULE',
    'DIRECTLY_CITED_DOCUMENT',
    'LATER_CHANGE_CHECK',
    'FACT_MATCH',
    'TARGETED_CONTRARY_CHECK',
    'ANSWER'
  ]);

  const RETRIEVAL_LEVEL = Object.freeze({
    FAST: 'FAST_VERIFY',
    TARGETED: 'TARGETED_VERIFY',
    FULL: 'FULL_AUTHORITY_REVIEW'
  });

  const SEARCH_BUDGET = Object.freeze({
    fastQueries: 5,
    fastOfficialDocuments: 5,
    principle: 'ค้นเท่าที่จำเป็นต่อการตัดสิน ไม่ใช่ค้นทุกอย่างที่เป็นไปได้'
  });

  const AUTHORITY_CASE_PATTERN = /กฎหมาย|ระเบียบ|หลักเกณฑ์|หนังสือสั่งการ|มติ|มีสิทธิ|สิทธิในการ|สิทธิของ|สิทธิประโยชน์|อำนาจ|เบิก|เบิกจ่าย|จ่ายได้|พัสดุ|จัดซื้อ|งบประมาณ|ข้อบัญญัติ|แปรญัตติ|เดินทางไปราชการ|ค่าเช่า|เช่าซื้อ|งานก่อสร้าง|แต่งตั้ง|โอน|ย้าย|ภาษี|ค่าธรรมเนียม|เรียกเก็บ|ยกเว้น|ค้างชำระ|เสียภาษี|คิดเท่าไร|เก็บได้เท่าไร/i;
  const AUTHORITY_CATEGORY_PATTERN = /กฎหมาย|งานบุคคล|บุคคล|สิทธิ|อำนาจ|สภาท้องถิ่น|สภา/i;
  const DEMONSTRATIVE_ONLY_PATTERN = /^(?:ทำ)?(?:อันนี้|แบบนี้|อย่างนี้|เรื่องนี้|กรณีนี้|นี่|นั้น)$/i;
  const GENERIC_ONLY_PATTERN = /^(?:ช่วย|ขอ|อยากทราบ|สอบถาม|ตรวจสอบ|เช็ก|ดู)?(?:ทำ|เบิก|จ่าย|ใช้|อนุมัติ|ดำเนินการ)?(?:ได้|ไม่ได้)?$/i;
  const PLACEHOLDER_PATTERN = /(?:\.\.\.|…|___+|\[ระบุ|xxx+)/i;
  const PAST_PRACTICE_WITHOUT_SUBJECT_PATTERN = /^(?:เมื่อก่อน|เดิม|ที่ผ่านมา)?\s*(?:หน่วยงาน)?\s*(?:เคย)?\s*(?:ทำ|ปฏิบัติ)(?:แบบนี้|อย่างนี้|เช่นนี้|มาแบบนี้)(?:มาตลอด|อยู่|ไว้)?(?:\s*ยัง(?:ทำ|ใช้|ปฏิบัติ)(?:ต่อ)?(?:ได้ไหม|ได้หรือไม่|ไหม))?$/i;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }
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
    const source = text(query), found = [];
    const patterns = [
      /(?:พ\.ศ\.\s*)?\d{4}/g,
      /(?:เลขที่|ที่)\s*[ก-ฮA-Za-z0-9.\/-]+(?:\s*\/\s*[วVv]?\s*\d+)?/g,
      /(?:มติ|คำสั่ง|ประกาศ|ระเบียบ|พระราชบัญญัติ|กฎกระทรวง)\s+[^,;\n]{3,80}/g
    ];
    patterns.forEach(pattern => {
      const matches = source.match(pattern);
      if (matches) found.push(...matches);
    });
    return unique([...discoveredIdentifiers, ...found]);
  }

  function buildSearchVocabulary({ query = '', discoveredIdentifiers = [] } = {}) {
    const original = text(query), subject = extractSubject(original);
    if (!subject) return Object.freeze([]);
    const identifiers = extractIdentifiers(original, discoveredIdentifiers);
    const withoutQuestionWords = text(subject.replace(/(?:ได้ไหม|ได้หรือไม่|หรือไม่|ไหม|อย่างไร|ยังไง)/gi, ''));
    return Object.freeze(unique([original, subject, withoutQuestionWords, ...identifiers]));
  }

  function evidenceSnapshot(evidence = {}) {
    const types = Array.isArray(evidence.types) ? evidence.types.map(text).filter(Boolean) : [];
    const count = Number(evidence.count) || 0;
    return freeze({
      provided: evidence.provided === true || count > 0 || types.length > 0,
      count,
      types: unique(types)
    });
  }

  function evaluateOfficialAuthorityRetrieval({ query = '', discoveredIdentifiers = [], evidence = {} } = {}) {
    const subject = extractSubject(query), subjectIdentifiable = Boolean(subject);
    const suppliedEvidence = evidenceSnapshot(evidence);
    return freeze({
      policyVersion: '7.1-adaptive.1',
      subject,
      subjectIdentifiable,
      status: subjectIdentifiable ? RETRIEVAL_STATUS.SEARCH_READY : RETRIEVAL_STATUS.BLOCKED_MISSING_SCOPE,
      action: subjectIdentifiable ? 'AUTHORITY_RETRIEVAL' : 'CLARIFY_SUBJECT',
      retrievalLevel: RETRIEVAL_LEVEL.FAST,
      searchVocabulary: subjectIdentifiable ? buildSearchVocabulary({ query, discoveredIdentifiers }) : [],
      suppliedEvidence,
      retrievalFlow: FAST_RETRIEVAL_FLOW,
      searchBudget: SEARCH_BUDGET,
      principle: 'ข้อมูลไม่พอสำหรับตัดสิน ไม่ได้หมายความว่าข้อมูลไม่พอสำหรับเริ่มค้น'
    });
  }

  function assessDecisionSufficiency({ authoritySufficient, factsSufficient } = {}) {
    if (authoritySufficient !== true) return freeze({
      authoritySufficient: false,
      factsSufficient: factsSufficient === true,
      status: RETRIEVAL_STATUS.AUTHORITY_REQUIRED,
      finalDecisionAllowed: false,
      partialAnswerAllowed: true,
      nextAction: 'CONTINUE_TARGETED_AUTHORITY_RETRIEVAL'
    });
    if (factsSufficient !== true) return freeze({
      authoritySufficient: true,
      factsSufficient: false,
      status: RETRIEVAL_STATUS.AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT,
      finalDecisionAllowed: false,
      partialAnswerAllowed: true,
      nextAction: 'ANSWER_VERIFIED_GENERAL_RULE_THEN_ASK_DECISIVE_FACTS_ONLY'
    });
    return freeze({
      authoritySufficient: true,
      factsSufficient: true,
      status: RETRIEVAL_STATUS.FINAL_DECISION_READY,
      finalDecisionAllowed: true,
      partialAnswerAllowed: true,
      nextAction: 'RUN_EXISTING_FINAL_DECISION_AND_QUALITY_GATES'
    });
  }

  function shouldApplyOfficialAuthorityRetrieval({ query = '', category = '' } = {}) {
    const q = text(query), c = text(category);
    return AUTHORITY_CASE_PATTERN.test(q) || AUTHORITY_CATEGORY_PATTERN.test(c);
  }

  function officialAuthorityPromptPolicy({ query = '', category = '', evidence = {} } = {}) {
    if (!shouldApplyOfficialAuthorityRetrieval({ query, category })) return '';
    const scope = evaluateOfficialAuthorityRetrieval({ query, evidence });
    const vocabulary = scope.searchVocabulary.length ? scope.searchVocabulary.join(' | ') : '[ยังระบุ subject matter ไม่ได้]';
    const evidenceLine = scope.suppliedEvidence.provided
      ? `มีหลักฐานจากผู้ใช้แล้ว (${scope.suppliedEvidence.count || scope.suppliedEvidence.types.length || 1} รายการ) → อ่านและใช้ก่อนค้นเว็บ ห้ามค้นเอกสารเดิมซ้ำโดยไม่มีเหตุ`
      : 'ยังไม่พบหลักฐานแนบใน context → เริ่มจากฐานอำนาจปฐมภูมิที่ตรงเรื่อง';
    const initialInstruction = scope.subjectIdentifiable
      ? `สถานะเริ่มต้น: SUBJECT IDENTIFIABLE → FAST VERIFY ทันที\nSearch Vocabulary: ${vocabulary}`
      : 'สถานะเริ่มต้น: SUBJECT AMBIGUOUS → CLARIFY เฉพาะ subject matter ที่ต้องตรวจ';

    return `\n\nAdaptive Official Authority Retrieval — GovPrompt Thailand V7.1\nหลัก: “ค้นเท่าที่จำเป็นต่อการตัดสิน ไม่ใช่ค้นทุกอย่างที่เป็นไปได้”\n${initialInstruction}\n${evidenceLine}\n- เริ่ม FAST VERIFY เสมอ: Provided Evidence → Primary Rule → Directly Cited Document → Later Change Check → Fact Match → Targeted Contrary Check → Answer\n- Search Budget รอบแรก: โดยประมาณ 3–5 query และเปิดต้นฉบับ/เอกสารทางการที่ดีที่สุด 2–5 ฉบับ แล้ว STOP AND ASSESS; จำนวนนี้เป็นเพดานเริ่มต้น ไม่ใช่เป้าหมายบังคับ\n- High Risk ≠ Full Search อัตโนมัติ: HIGH RISK หมายถึงต้องมีหลักฐานพอก่อนฟันธง ไม่ได้หมายถึงต้องค้นคำพิพากษา หนังสือหารือ FAQ คู่มือ สารบัญ และ PDF scan ทุกครั้ง\n- FOLLOW ONE BEST LEAD: ค้นรอบถัดไปได้เมื่อระบุได้ว่าสิ่งที่จะค้นอาจเปลี่ยนผลอย่างไร; หากไม่มี new lead ที่มีนัยสำคัญให้หยุดค้น\n- ยกระดับ TARGETED VERIFY เมื่อยังขาดฐานอำนาจที่เปลี่ยนคำตอบได้, ต้องตรวจฉบับแก้ไข/ลักษณะต้องห้าม/เงื่อนไขเฉพาะราย, หรือพบถ้อยคำของหนังสือเวียนที่ต้องเทียบกฎหมายแม่บท\n- ยกระดับ FULL AUTHORITY REVIEW เฉพาะเมื่อพบ conflict ของ authority, ปัญหาอำนาจผู้ออก, บทเฉพาะกาล/สิทธิเดิม, ต้องใช้คำพิพากษาหรือหนังสือหารือเป็นเหตุหลัก, contrary evidence ที่อาจกลับผล, ฉบับที่ใช้ในวันเกิดเหตุไม่ชัด, หรือผู้ใช้ขอค้นลึกถึงที่สุด\n- Deep/Hidden Document/OCR/Citation Recovery ใช้เมื่อ Direct Search ไม่พบต้นฉบับหรือมี identifier สำคัญที่จำเป็นต่อคำตอบเท่านั้น\n- Decision Lock บล็อกเฉพาะการฟันธง ✅ ได้ / ❌ ไม่ได้ เมื่อฐานสำคัญยังไม่ครบ; ยังให้ตอบส่วนที่ยืนยันแล้วและใช้ ⚠️ ได้โดยมีเงื่อนไข / 🔎 หลักฐานยังไม่พอที่จะฟันธงได้\n- แยก Searchable ออกจาก Decidable: เมื่อระบุเรื่องได้ให้เริ่มค้นทันที แม้ WHO, ORG, TIME, BEFORE หรือ STAGE ยังไม่ครบ และถามภายหลังเฉพาะ decisive facts ที่เปลี่ยนผลจริง\n- ตรวจ Legal Version ตามวันที่เกิดเหตุ และตรวจฉบับแก้ไข/ยกเลิก/แทนที่/บทเฉพาะกาลเท่าที่เกี่ยวข้องกับผล; ห้ามเลือกฉบับใหม่ที่สุดโดยอัตโนมัติ\n- Contrary Evidence Check ให้ทำแบบเจาะจง 1 รอบหลังมี tentative conclusion; หากไม่พบ lead น้ำหนักสูงที่เปลี่ยนผล ไม่ต้องเปิด Full Search ใหม่ทั้งหมด\n- STOP SEARCH เมื่อพบฐานปฐมภูมิที่ตรงเรื่อง, ยืนยันฉบับที่ใช้กับเหตุ, เทียบข้อเท็จจริงสำคัญแล้ว, ตรวจฉบับใหม่กว่า/ข้อยกเว้นที่มีนัยสำคัญแล้ว และไม่มี unresolved lead ที่อาจเปลี่ยนผล\n- Compatibility rule chain สำหรับกรณีที่ต้องยกระดับ: Current Rule → Later Rule/Amendment → Conflict/Transition when relevant → Applicable Rule → Final Decision\n- คง Decision Gate, Multi-condition Gate, Legal Version Gate, Evidence Gate, Applicable Authority Check, Contrary Evidence Check และ Human Approval เดิมทั้งหมด แต่ใช้แบบ adaptive ไม่ทำทุกแขนงโดยอัตโนมัติ\n- ห้าม hard-code ผลกฎหมาย อัตรา ตัวเลข ระยะเวลา หรือเลขหนังสือเฉพาะเรื่องเป็นความจริงถาวร ต้องได้จาก Current Case และตรวจ applicability ทุกครั้ง`;
  }

  function currentCaseText(source = {}) {
    const values = Object.values(source.userInputs || {}).map(text).filter(Boolean);
    return unique([text(source.query), ...values]).join(' ');
  }

  function prepare(context) {
    const source = context || {}, caseQuery = currentCaseText(source);
    const retrieval = evaluateOfficialAuthorityRetrieval({ query: caseQuery, evidence: source.evidence || {} });
    return freeze({
      version: 7,
      coreRevision: '7.1-adaptive-retrieval.1',
      task: {
        query: String(valueOr(source.query, '')),
        selectedGpId: source.selectedGpId || null,
        category: source.category || null
      },
      userInputs: clone(source.userInputs || {}),
      routing: {
        score: Number(source.routing?.score) || 0,
        confidence: Number(source.routing?.confidence) || 0,
        matchedReason: String(source.routing?.matchedReason || ''),
        fallback: source.routing?.fallback !== false
      },
      evidence: {
        provided: source.evidence?.provided === true,
        types: clone(source.evidence?.types || []),
        count: Number(source.evidence?.count) || 0,
        records: clone(source.evidence?.records || []),
        requiredTypes: clone(source.evidence?.requiredTypes || [])
      },
      officialAuthorityRetrieval: clone(source.officialAuthorityRetrieval || retrieval),
      legalTransition: clone(source.legalTransition || {}),
      decisionIntegrity: clone(source.decisionIntegrity || {}),
      eventContinuity: clone(source.eventContinuity || {}),
      riskFlags: clone(source.riskFlags || []),
      workflowState: String(valueOr(source.workflowState, 'idle'))
    });
  }

  function installOfficialAuthorityPromptPolicy() {
    if (typeof document === 'undefined') return;
    const form = document.getElementById('promptForm'), output = document.getElementById('output');
    if (!form || !output || form.dataset.officialAuthorityRetrievalInstalled === '1') return;
    form.dataset.officialAuthorityRetrievalInstalled = '1';
    const original = form.onsubmit;
    form.onsubmit = function (event) {
      const result = typeof original === 'function' ? original.call(this, event) : undefined;
      const context = globalThis.GOVPROMPT_CONTEXT?.get?.() || {};
      const caseQuery = currentCaseText(context);
      const policy = officialAuthorityPromptPolicy({ query: caseQuery, category: context.category || '', evidence: context.evidence || {} });
      if (policy && !output.textContent.includes('Adaptive Official Authority Retrieval — GovPrompt Thailand V7.1')) output.textContent += policy;
      return result;
    };
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', installOfficialAuthorityPromptPolicy, { once: true });

  const officialAuthorityRetrievalGate = Object.freeze({
    evaluateScope: evaluateOfficialAuthorityRetrieval,
    buildSearchVocabulary,
    assessDecisionSufficiency,
    shouldApply: shouldApplyOfficialAuthorityRetrieval,
    promptPolicy: officialAuthorityPromptPolicy,
    statuses: RETRIEVAL_STATUS,
    levels: RETRIEVAL_LEVEL,
    searchBudget: SEARCH_BUDGET,
    retrievalFlow: RETRIEVAL_FLOW,
    fastRetrievalFlow: FAST_RETRIEVAL_FLOW
  });

  const api = Object.freeze({ prepare, officialAuthorityRetrievalGate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_CORE_ENGINE = api;
})();
