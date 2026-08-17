(() => {
  'use strict';

  const STATUSES = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', NOT_APPLICABLE: 'NOT_APPLICABLE', MISSING_CATALOG: 'MISSING_CATALOG' });
  const INTAKE_STATUSES = Object.freeze({ READY: 'READY', NEEDS_INFO: 'NEEDS_INFO' });
  const MINIMUM_CONFIDENCE = 0.3;
  const PDPA_FIELD_PATTERN = /บัตร|เลขประจำตัว|บัญชี|สุขภาพ|biometric/i;
  const MAX_INTAKE_QUESTIONS = 3;
  const CATEGORY_PRIORITY = Object.freeze({
    'หนังสือราชการ': Object.freeze(['เรื่อง', 'ผู้รับ', 'ข้อเท็จจริง', 'วัตถุประสงค์', 'วันเวลา', 'สถานที่', 'บันทึกประชุม']),
    'กฎหมาย': Object.freeze(['เรื่อง', 'ข้อเท็จจริง', 'ข้อหารือ', 'กิจกรรม', 'กลุ่มเป้าหมาย', 'แนวทางดำเนินการ', 'ประเด็นเสี่ยง']),
    'พัสดุ': Object.freeze(['รายการพัสดุ', 'ชื่อพัสดุ', 'ความต้องการใช้งาน', 'ข้อความ TOR', 'สเปก', 'วงเงิน', 'ข้อมูลตลาด', 'ผลงานจริง', 'หลักฐาน', 'คุณสมบัติจำเป็น']),
    'โครงการ': Object.freeze(['ชื่อโครงการ', 'ปัญหา', 'วัตถุประสงค์', 'กลุ่มเป้าหมาย', 'กิจกรรม', 'งบประมาณ', 'ระยะเวลา']),
    'ประชาสัมพันธ์': Object.freeze(['หัวเรื่อง', 'กิจกรรม', 'วันเวลา', 'สถานที่', 'ข้อเท็จจริง', 'กลุ่มเป้าหมาย', 'สาระสำคัญ']),
    'ผู้บริหาร': Object.freeze(['เรื่อง', 'ข้อเท็จจริง', 'ประเด็นตัดสินใจ', 'ผู้กล่าว', 'ชื่องาน', 'ผู้เข้าร่วม', 'ความสำคัญ'])
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function nonEmpty(value) {
    return Boolean(String(value ?? '').trim());
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function intakePriorityFields(tool) {
    const fields = Array.isArray(tool?.fields) ? tool.fields.map(String) : [];
    const baseline = fields.slice(0, 2);
    const priorities = CATEGORY_PRIORITY[String(tool?.category || '')] || [];
    const matched = priorities.filter(priority => fields.includes(priority));
    return unique([...baseline, ...matched]);
  }

  function questionFor(field) {
    const text = String(field || '');
    if (/วงเงิน|งบประมาณ/.test(text)) return 'วงเงินหรืองบประมาณประมาณเท่าไร?';
    if (/กลุ่มเป้าหมาย/.test(text)) return 'กลุ่มเป้าหมายคือใคร และประมาณกี่คน?';
    if (/ข้อเท็จจริง/.test(text)) return 'ข้อเท็จจริงสำคัญของเรื่องนี้มีอะไรบ้าง?';
    if (/ข้อหารือ|ประเด็นตัดสินใจ/.test(text)) return 'ต้องการให้ GP ช่วยวิเคราะห์หรือตอบประเด็นใด?';
    if (/ผู้รับ/.test(text)) return 'เอกสารหรือหนังสือนี้จะส่งถึงใครหรือหน่วยงานใด?';
    if (/วันเวลา/.test(text)) return 'งานหรือการประชุมนี้เกิดขึ้นวันและเวลาใด?';
    if (/สถานที่/.test(text)) return 'สถานที่ดำเนินการหรือสถานที่ประชุมคือที่ใด?';
    if (/ปัญหา/.test(text)) return 'ปัญหาหรือเหตุผลความจำเป็นของเรื่องนี้คืออะไร?';
    if (/วัตถุประสงค์/.test(text)) return 'ต้องการให้เกิดผลอะไร หรือมีวัตถุประสงค์อะไร?';
    if (/ข้อความ TOR|สเปก/.test(text)) return `กรุณาระบุ${text}ที่ต้องการให้ตรวจ`;
    if (/ข้อมูลตลาด/.test(text)) return 'มีข้อมูลตลาด ราคา หรือผู้ขายที่เกี่ยวข้องหรือไม่?';
    if (/ความต้องการใช้งาน/.test(text)) return 'ต้องการพัสดุนี้ไปใช้งานอะไร และมีความจำเป็นอย่างไร?';
    if (/กิจกรรม/.test(text)) return 'กิจกรรมหลักที่จะดำเนินการมีอะไรบ้าง?';
    if (/เรื่อง|ชื่อโครงการ|ชื่อพัสดุ|รายการพัสดุ|หัวเรื่อง|ชื่องาน/.test(text)) return 'เรื่องหรือชื่อของงานนี้คืออะไร?';
    return `กรุณาระบุข้อมูล: ${text}`;
  }

  function assessIntake(tool, inputValues = {}) {
    const fields = Array.isArray(tool?.fields) ? tool.fields.map(String) : [];
    if (!tool || !fields.length) {
      return freeze({ status: INTAKE_STATUSES.READY, ready: true, missingFields: [], questions: [], checkedFields: [] });
    }

    const checkedFields = intakePriorityFields(tool);
    const missingFields = checkedFields.filter(field => !nonEmpty(inputValues[field])).slice(0, MAX_INTAKE_QUESTIONS);
    const questions = missingFields.map(field => ({ field, question: questionFor(field) }));
    return freeze({
      status: missingFields.length ? INTAKE_STATUSES.NEEDS_INFO : INTAKE_STATUSES.READY,
      ready: missingFields.length === 0,
      missingFields,
      questions,
      checkedFields
    });
  }

  function installGuidedIntake() {
    if (typeof document === 'undefined') return false;
    const form = document.getElementById('promptForm');
    if (!form || form.dataset.guidedIntakeInstalled === 'true') return false;
    form.dataset.guidedIntakeInstalled = 'true';

    form.addEventListener('submit', event => {
      const gpId = String(document.getElementById('toolCode')?.textContent || '').trim();
      const tools = Array.isArray(window.GOVPROMPT_TOOLS) ? window.GOVPROMPT_TOOLS : [];
      const tool = tools.find(item => String(item?.id || '') === gpId);
      if (!tool) return;

      const textareas = [...form.querySelectorAll('#fields textarea')];
      const inputValues = Object.fromEntries((tool.fields || []).map((field, index) => [String(field), String(textareas[index]?.value || '').trim()]));
      const assessment = assessIntake(tool, inputValues);

      textareas.forEach(textarea => {
        textarea.removeAttribute('aria-invalid');
        textarea.style.borderColor = '';
        textarea.style.boxShadow = '';
      });

      if (assessment.ready) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.GOVPROMPT_CONTEXT?.setUserInputs(inputValues);
      window.GOVPROMPT_CONTEXT?.setWorkflowState('collecting-input');

      const output = document.getElementById('output');
      const copyButton = document.getElementById('copyBtn');
      const downloadButton = document.getElementById('downloadBtn');
      if (copyButton) copyButton.disabled = true;
      if (downloadButton) downloadButton.disabled = true;

      const lines = assessment.questions.map((item, index) => `${index + 1}. ${item.question}`);
      if (output) {
        output.textContent = `ยังขาดข้อมูลสำคัญ ${assessment.missingFields.length} ข้อ\n\n${lines.join('\n')}\n\nกรอกเฉพาะข้อมูลที่ทราบ หากยังไม่ทราบให้พิมพ์ “ไม่ทราบ” แล้ว GP จะระบุจุดที่ต้องตรวจสอบต่อให้`;
        output.classList.remove('empty-result');
      }

      assessment.missingFields.forEach(field => {
        const index = (tool.fields || []).findIndex(item => String(item) === field);
        const textarea = textareas[index];
        if (!textarea) return;
        textarea.setAttribute('aria-invalid', 'true');
        textarea.style.borderColor = '#d97706';
        textarea.style.boxShadow = '0 0 0 3px rgba(217,119,6,.12)';
      });

      const firstMissingIndex = (tool.fields || []).findIndex(item => String(item) === assessment.missingFields[0]);
      textareas[firstMissingIndex]?.focus();
    }, true);

    return true;
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
    const evidenceRecords = Array.isArray(source.evidence?.records) ? source.evidence.records : [];
    const requiredEvidenceTypes = [...new Set((source.evidence?.requiredTypes || []).map(String))];
    const suppliedEvidenceTypes = new Set(evidenceRecords.filter(record => ['supplied', 'needs-verification', 'verified-by-human'].includes(record?.status)).map(record => String(record.type)));
    const unverifiedEvidenceTypes = requiredEvidenceTypes.filter(type => evidenceRecords.find(record => String(record?.type) === type)?.status !== 'verified-by-human');
    const missingEvidenceTypes = requiredEvidenceTypes.filter(type => !suppliedEvidenceTypes.has(type));
    const pdpaFields = entries.map(([field]) => field).filter(field => PDPA_FIELD_PATTERN.test(field));
    const pdpaConcerns = pdpaFields.length ? ['personal-data-field-present'] : [];
    const missingInformation = [];
    if (!providedFields.length) missingInformation.push('user-inputs');
    if (evidenceRequired && !evidenceProvided) missingInformation.push('required-evidence');
    missingEvidenceTypes.forEach(type => missingInformation.push(`required-evidence:${type}`));

    let status = STATUSES.PASS;
    if (source.catalogStatus === STATUSES.MISSING_CATALOG) status = STATUSES.MISSING_CATALOG;
    else if (source.catalogStatus === STATUSES.NOT_APPLICABLE) status = STATUSES.NOT_APPLICABLE;
    else if (!hasSelection || fallback) status = STATUSES.BLOCKED;
    else if (missingInformation.length) status = STATUSES.NEEDS_INFO;
    else if (riskFlags.length || pdpaConcerns.length || confidence < MINIMUM_CONFIDENCE || unverifiedEvidenceTypes.length) status = STATUSES.REVIEW_REQUIRED;

    return freeze({
      status,
      checks: {
        completeness: { passed: providedFields.length > 0 && missingFields.length === 0, providedFields, missingFields },
        requiredEvidence: { required: evidenceRequired || requiredEvidenceTypes.length > 0, provided: evidenceProvided, requiredTypes: requiredEvidenceTypes, missingTypes: missingEvidenceTypes, unverifiedTypes: unverifiedEvidenceTypes, passed: (!evidenceRequired || evidenceProvided) && !missingEvidenceTypes.length },
        missingInformation,
        riskFlags,
        confidence: { value: confidence, minimum: MINIMUM_CONFIDENCE, passed: confidence >= MINIMUM_CONFIDENCE },
        sourceReadiness: { ready: (evidenceProvided || !evidenceRequired) && !missingEvidenceTypes.length, evidenceTypes: clone(source.evidence?.types || []), verificationReady: !unverifiedEvidenceTypes.length },
        pdpaSecurity: { concerns: pdpaConcerns, requiresReview: pdpaConcerns.length > 0 },
        workflowReadiness: { ready: status === STATUSES.PASS }
      }
    });
  }

  window.GOVPROMPT_QUALITY_GATE = Object.freeze({ evaluate, assessIntake, installGuidedIntake, statuses: STATUSES, intakeStatuses: INTAKE_STATUSES });
  installGuidedIntake();
})();
