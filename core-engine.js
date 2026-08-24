(() => {
  'use strict';

  const SMART_ACTIONS = Object.freeze([
    Object.freeze({
      id: 'executive-summary',
      label: 'สรุปเอกสารและรายงาน',
      purpose: 'สกัดสาระสำคัญ ตัวเลข ผลการดำเนินงาน ความเสี่ยง และประเด็นที่ผู้บริหารควรรู้จากเอกสาร',
      gpHints: Object.freeze(['GP004', 'GP019']),
      keywords: Object.freeze(['สรุปผู้บริหาร', 'สรุปรายงาน', 'สรุปเอกสาร', 'รายงานประจำปี', 'สาระสำคัญ', 'executive summary']),
      requiredEvidence: Object.freeze(['source-document']),
      outputSections: Object.freeze(['สาระสำคัญ', 'ตัวเลขและข้อเท็จจริง', 'ผลการดำเนินงาน', 'ความเสี่ยง/ข้อสังเกต', 'ข้อเสนอหรือขั้นตอนถัดไป']),
      routeMode: 'ai-only',
      priority: 50
    }),
    Object.freeze({
      id: 'targeted-document-search',
      label: 'ค้นข้อมูลเฉพาะจุดในเอกสาร',
      purpose: 'ค้นหาตัวเลข เงื่อนไข ข้อความ หน้า หรือประเด็นเฉพาะในเอกสาร โดยตอบพร้อมบริบทที่เกี่ยวข้อง',
      gpHints: Object.freeze([]),
      keywords: Object.freeze(['ค้นในเอกสาร', 'ค้นหาในไฟล์', 'หาในเอกสาร', 'หาเลข', 'หาเงื่อนไข', 'หน้าไหน', 'ข้อความไหน', 'อยู่หน้า']),
      requiredEvidence: Object.freeze(['source-document', 'target-question']),
      outputSections: Object.freeze(['คำตอบตรงประเด็น', 'ตำแหน่ง/บริบทในเอกสาร', 'ข้อจำกัดหรือข้อมูลที่ยังหาไม่พบ']),
      routeMode: 'ai-only',
      priority: 70
    }),
    Object.freeze({
      id: 'regulation-extractor',
      label: 'สกัดกฎหมาย ระเบียบ และข้อบังคับ',
      purpose: 'ดึงข้อกฎหมาย ระเบียบ หลักเกณฑ์ อำนาจหน้าที่ และขั้นตอนที่เกี่ยวข้อง พร้อมแยกข้อที่ต้องยืนยันจากต้นฉบับ',
      gpHints: Object.freeze(['GP005', 'GP006', 'GP007']),
      keywords: Object.freeze(['ข้อกฎหมาย', 'กฎหมาย', 'ระเบียบ', 'ข้อบังคับ', 'หลักเกณฑ์', 'อำนาจหน้าที่', 'ฐานอำนาจ']),
      requiredEvidence: Object.freeze(['facts', 'law-or-regulation-source']),
      outputSections: Object.freeze(['ข้อกฎหมาย/ระเบียบที่เกี่ยวข้อง', 'เงื่อนไขและขั้นตอน', 'การปรับใช้กับข้อเท็จจริง', 'ประเด็นที่ต้องตรวจฉบับล่าสุด']),
      routeMode: 'web-when-needed',
      priority: 55
    }),
    Object.freeze({
      id: 'document-comparison',
      label: 'เปรียบเทียบเอกสารสองฉบับ',
      purpose: 'เทียบข้อความ โครงสร้าง ตัวเลข และเงื่อนไขของเอกสารสองเวอร์ชัน พร้อมชี้ผลกระทบของการเปลี่ยนแปลง',
      gpHints: Object.freeze(['GP011']),
      keywords: Object.freeze(['เปรียบเทียบเอกสาร', 'เปรียบเทียบ', 'ฉบับเดิม', 'ฉบับใหม่', 'สองฉบับ', '2 ฉบับ', 'เวอร์ชัน', 'ต่างกัน', 'แก้ไขจากเดิม']),
      requiredEvidence: Object.freeze(['document-a', 'document-b']),
      outputSections: Object.freeze(['ตารางความแตกต่าง', 'ข้อความที่เพิ่ม/แก้/ตัด', 'ผลกระทบ', 'จุดที่ควรตรวจซ้ำ']),
      routeMode: 'ai-only',
      priority: 65
    }),
    Object.freeze({
      id: 'risk-audit',
      label: 'ตรวจความเสี่ยงและจุดผิดปกติ',
      purpose: 'ค้นหาความเสี่ยง จุดขัดแย้ง ข้อมูลไม่ครบ เงื่อนไขผิดปกติ และประเด็นที่ควรให้มนุษย์ตรวจทานก่อนดำเนินการ',
      gpHints: Object.freeze(['GP008', 'GP010', 'GP013']),
      keywords: Object.freeze(['ความเสี่ยง', 'จุดเสี่ยง', 'ผิดปกติ', 'ข้อทักท้วง', 'ตรวจสอบภายใน', 'ล็อกสเปก', 'สตง', 'ป.ป.ช.']),
      requiredEvidence: Object.freeze(['facts', 'source-document']),
      outputSections: Object.freeze(['ความเสี่ยงที่พบ', 'ระดับ/เหตุผล', 'หลักฐานที่รองรับ', 'ข้อมูลที่ขาด', 'มาตรการลดความเสี่ยง']),
      routeMode: 'web-when-needed',
      priority: 60
    }),
    Object.freeze({
      id: 'tor-boq-review',
      label: 'ตรวจ TOR และ BOQ',
      purpose: 'ตรวจความครบถ้วน ความเป็นกลาง การแข่งขัน ปริมาณ ราคา เงื่อนไขตรวจรับ และความสอดคล้องระหว่าง TOR/BOQ/สัญญา',
      gpHints: Object.freeze(['GP009', 'GP010', 'GP011', 'GP012']),
      keywords: Object.freeze(['TOR', 'BOQ', 'ราคากลาง', 'สเปก', 'คุณลักษณะ', 'ตรวจรับ', 'ปริมาณงาน', 'ถอดแบบ']),
      requiredEvidence: Object.freeze(['tor-or-specification', 'budget-or-boq']),
      outputSections: Object.freeze(['ข้อกำหนดสำคัญ', 'จุดเสี่ยงด้านการแข่งขัน', 'ความสอดคล้องของปริมาณ/ราคา', 'เงื่อนไขตรวจรับ/ค่าปรับ', 'ข้อเสนอแก้ไข']),
      routeMode: 'web-when-needed',
      priority: 90
    }),
    Object.freeze({
      id: 'contract-review',
      label: 'วิเคราะห์สัญญาและเงื่อนไขสำคัญ',
      purpose: 'สรุปหน้าที่คู่สัญญา กำหนดส่งมอบ หลักประกัน ค่าปรับ การแก้ไขสัญญา การขยายเวลา และความเสี่ยงสำคัญ',
      gpHints: Object.freeze(['GP011']),
      keywords: Object.freeze(['สัญญา', 'คู่สัญญา', 'ค่าปรับ', 'ส่งมอบ', 'หลักประกัน', 'แก้ไขสัญญา', 'ขยายเวลา', 'เลิกสัญญา']),
      requiredEvidence: Object.freeze(['contract-document']),
      outputSections: Object.freeze(['คู่สัญญาและหน้าที่', 'กำหนดเวลา/ส่งมอบ', 'หลักประกันและค่าปรับ', 'เงื่อนไขแก้ไข/ขยายเวลา/เลิกสัญญา', 'ความเสี่ยงและข้อควรตรวจ']),
      routeMode: 'web-when-needed',
      priority: 75
    }),
    Object.freeze({
      id: 'budget-analysis',
      label: 'วิเคราะห์งบประมาณและตัวเลข',
      purpose: 'สรุปวงเงิน ค่าใช้จ่าย สัดส่วน ความคุ้มค่า ความผิดปกติของตัวเลข และประเด็นงบประมาณที่ต้องตัดสินใจ',
      gpHints: Object.freeze(['GP013', 'GP019']),
      keywords: Object.freeze(['งบประมาณ', 'วงเงิน', 'ค่าใช้จ่าย', 'เบิกจ่าย', 'ราคาต่อหน่วย', 'คุ้มค่า', 'ต้นทุน', 'งบ']),
      requiredEvidence: Object.freeze(['budget-data']),
      outputSections: Object.freeze(['สรุปวงเงินและรายการ', 'การคำนวณ/สัดส่วน', 'จุดผิดปกติหรือความคลาดเคลื่อน', 'ความคุ้มค่า', 'ข้อเสนอเพื่อการตัดสินใจ']),
      routeMode: 'ai-only',
      priority: 55
    }),
    Object.freeze({
      id: 'meeting-minutes',
      label: 'สรุปรายงานการประชุมและมติ',
      purpose: 'จัดโครงรายงานการประชุมให้เห็นประเด็นหารือ มติ ผู้รับผิดชอบ กำหนดเวลา และงานติดตาม',
      gpHints: Object.freeze(['GP004']),
      keywords: Object.freeze(['รายงานการประชุม', 'สรุปประชุม', 'มติที่ประชุม', 'มติ', 'ผู้รับผิดชอบ', 'action item', 'ประชุม']),
      requiredEvidence: Object.freeze(['meeting-record']),
      outputSections: Object.freeze(['ประเด็นหารือ', 'มติที่ประชุม', 'ผู้รับผิดชอบ', 'กำหนดเวลา', 'เรื่องติดตามครั้งถัดไป']),
      routeMode: 'ai-only',
      priority: 85
    }),
    Object.freeze({
      id: 'executive-brief',
      label: 'จัดทำเอกสารเสนอผู้บริหาร',
      purpose: 'แปลงข้อเท็จจริงและผลวิเคราะห์เป็นเอกสารพร้อมเสนอผู้บริหาร โดยแยกเรื่องเดิม ข้อเท็จจริง ข้อพิจารณา ทางเลือก ความเสี่ยง และข้อเสนอ',
      gpHints: Object.freeze(['GP002', 'GP019']),
      keywords: Object.freeze(['เสนอผู้บริหาร', 'บันทึกเสนอ', 'ประเด็นตัดสินใจ', 'ข้อพิจารณา', 'ทางเลือกมติ', 'วาระเสนอ', 'ข้อเสนอ']),
      requiredEvidence: Object.freeze(['facts', 'decision-question']),
      outputSections: Object.freeze(['เรื่องเดิม/ที่มา', 'ข้อเท็จจริง', 'ข้อพิจารณา', 'ทางเลือกและความเสี่ยง', 'ข้อเสนอเพื่อพิจารณา']),
      routeMode: 'ai-only',
      priority: 80
    })
  ]);

  const SMART_ACTION_BY_ID = Object.freeze(Object.fromEntries(SMART_ACTIONS.map(action => [action.id, action])));
  const COMMON_GATES = Object.freeze(['fact-check', 'pdpa-check', 'traceability', 'human-review']);
  const ACTION_NOTES = Object.freeze({
    'executive-summary': 'สรุปแบบ Answer First และแยกข้อเท็จจริงออกจากข้อเสนอแนะอย่างชัดเจน',
    'targeted-document-search': 'ตอบเฉพาะสิ่งที่ถาม พร้อมระบุหน้า/หัวข้อ/บริบทจากเอกสารเมื่อหาได้ และห้ามเดาตำแหน่ง',
    'regulation-extractor': 'ถ้าต้องอ้างกฎหมายหรือระเบียบ ให้ตรวจชื่อ ฉบับแก้ไขเพิ่มเติม สถานะใช้บังคับ และแหล่งราชการก่อนฟันธง',
    'document-comparison': 'ทำตารางเทียบฉบับเดิมกับฉบับใหม่ แยก เพิ่ม/แก้/ตัด และอธิบายผลกระทบของแต่ละจุด',
    'risk-audit': 'จัดระดับความเสี่ยงตามหลักฐานที่มี ระบุเหตุผล ผลกระทบ และมาตรการลดความเสี่ยง โดยไม่กล่าวหาบุคคลโดยไม่มีหลักฐาน',
    'tor-boq-review': 'ตรวจความเป็นกลางและการแข่งขัน ความสอดคล้อง TOR/BOQ/สัญญา ปริมาณ ราคา หน่วย ตรวจรับ รับประกัน และค่าปรับ',
    'contract-review': 'ตรวจหน้าที่คู่สัญญา ระยะเวลา ส่งมอบ หลักประกัน ค่าปรับ การแก้ไข/ขยายเวลา/เลิกสัญญา และเงื่อนไขที่ต้องขอความเห็นผู้มีอำนาจ',
    'budget-analysis': 'แสดงวิธีคำนวณที่ตรวจสอบย้อนกลับได้ ตรวจผลรวม หน่วย สัดส่วน ราคาต่อหน่วย และความคลาดเคลื่อนก่อนสรุป',
    'meeting-minutes': 'แยกข้อหารือ มติ ผู้รับผิดชอบ กำหนดเวลา และงานติดตาม ห้ามสร้างมติหรือผู้รับผิดชอบที่ไม่มีในข้อมูล',
    'executive-brief': 'จัดทำเรื่องเดิม ข้อเท็จจริง ข้อพิจารณา ทางเลือก ความเสี่ยง และข้อเสนอเพื่อการตัดสินใจ โดยไม่ชี้นำเกินหลักฐาน'
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function valueOr(value, fallback) {
    return value === undefined || value === null ? fallback : value;
  }

  function normalizedText(context) {
    const source = context || {};
    const task = source.task || {};
    const parts = [
      source.query,
      task.query,
      source.category,
      task.category,
      source.selectedGpId,
      task.selectedGpId,
      source.title,
      source.name,
      JSON.stringify(source.userInputs || {})
    ];
    return parts.filter(Boolean).join(' ').toLocaleLowerCase('th-TH');
  }

  function selectedGpId(context) {
    return String(context?.selectedGpId || context?.task?.selectedGpId || '');
  }

  function keywordScore(text, keyword) {
    const term = String(keyword || '').toLocaleLowerCase('th-TH');
    if (!term || !text.includes(term)) return 0;
    return term.length >= 8 ? 2 : 1;
  }

  function scoreAction(action, context) {
    const text = normalizedText(context);
    const gpId = selectedGpId(context);
    let score = action.gpHints.includes(gpId) ? 5 : 0;
    for (const keyword of action.keywords) score += keywordScore(text, keyword);
    return score;
  }

  function detectSmartAction(context = {}) {
    const explicitId = String(context.smartActionId || '');
    if (SMART_ACTION_BY_ID[explicitId]) {
      return freeze({
        actionId: explicitId,
        label: SMART_ACTION_BY_ID[explicitId].label,
        score: 100,
        confidence: 1,
        matchedReason: 'explicit-action',
        fallback: false
      });
    }

    const ranked = SMART_ACTIONS.map((action, index) => ({
      action,
      score: scoreAction(action, context),
      index
    })).filter(item => item.score > 0).sort((a, b) =>
      b.score - a.score || b.action.priority - a.action.priority || a.index - b.index
    );

    if (!ranked.length) {
      return freeze({ actionId: null, label: null, score: 0, confidence: 0, matchedReason: '', fallback: true });
    }

    const best = ranked[0];
    return freeze({
      actionId: best.action.id,
      label: best.action.label,
      score: best.score,
      confidence: Math.min(1, Number((best.score / 10).toFixed(2))),
      matchedReason: best.action.gpHints.includes(selectedGpId(context)) ? `gp-hint:${selectedGpId(context)}` : 'keyword-match',
      fallback: false
    });
  }

  function inferEvidenceTypes(context = {}, actionId = null) {
    const types = new Set((context?.evidence?.types || []).map(String));
    const inputs = context?.userInputs || {};
    const entries = Object.entries(inputs).filter(([, value]) => String(value || '').trim());
    const keys = entries.map(([key]) => String(key).toLocaleLowerCase('th-TH')).join(' ');
    const values = entries.map(([, value]) => String(value).toLocaleLowerCase('th-TH')).join(' ');
    const all = `${keys} ${values}`;

    if (entries.length) types.add('facts');
    if (/เอกสาร|หลักฐาน|รายงาน|ข้อความ|บันทึก|tor|boq|สัญญา|กฎหมาย|ระเบียบ|สเปก|ข้อกำหนด/.test(all)) types.add('source-document');
    if (/กฎหมาย|ระเบียบ|ข้อบังคับ|หลักเกณฑ์|เอกสารอ้างอิง/.test(all)) types.add('law-or-regulation-source');
    if (/tor|สเปก|คุณลักษณะ|ข้อกำหนด/.test(all)) types.add('tor-or-specification');
    if (/boq|งบประมาณ|วงเงิน|ราคา|ต้นทุน|ค่าใช้จ่าย/.test(all)) {
      types.add('budget-or-boq');
      types.add('budget-data');
    }
    if (/สัญญา|คู่สัญญา|ค่าปรับ|ส่งมอบ|หลักประกัน/.test(all)) types.add('contract-document');
    if (/บันทึกประชุม|รายงานการประชุม|มติ|ผู้เข้าร่วม|วาระ/.test(all)) types.add('meeting-record');
    if (/ข้อหารือ|คำถาม|ประเด็น|ต้องการทราบ|ค้นหา|หา/.test(all)) types.add('target-question');
    if (/ประเด็นตัดสินใจ|ข้อพิจารณา|ข้อเสนอ|ทางเลือก|มติ/.test(all)) types.add('decision-question');
    if (/ฉบับเดิม|เอกสาร a|ไฟล์ a|เวอร์ชันเดิม/.test(all)) types.add('document-a');
    if (/ฉบับใหม่|เอกสาร b|ไฟล์ b|เวอร์ชันใหม่/.test(all)) types.add('document-b');

    if (actionId === 'executive-summary' && entries.length) types.add('source-document');
    if (actionId === 'risk-audit' && entries.length) types.add('source-document');
    if (actionId === 'meeting-minutes' && entries.length) types.add('meeting-record');
    if (actionId === 'executive-brief' && entries.length) types.add('decision-question');

    return [...types];
  }

  function withInferredEvidence(context = {}, actionId = null) {
    const source = clone(context || {});
    const types = inferEvidenceTypes(source, actionId);
    source.evidence = {
      ...(source.evidence || {}),
      provided: types.length > 0,
      types,
      count: Math.max(Number(source.evidence?.count) || 0, types.length)
    };
    return source;
  }

  function planSmartAction(actionId, context = {}) {
    const action = SMART_ACTION_BY_ID[String(actionId || '')];
    if (!action) {
      return freeze({
        actionId: null,
        status: 'NOT_APPLICABLE',
        routeMode: 'ai-only',
        requiredEvidence: [],
        missingEvidence: [],
        outputSections: [],
        qualityGates: [...COMMON_GATES],
        constraints: ['attached-file-first', 'no-invented-facts', 'human-final-review'],
        requiresHumanReview: true
      });
    }

    const enriched = withInferredEvidence(context, action.id);
    const evidenceTypes = new Set((enriched?.evidence?.types || []).map(String));
    const requiredEvidence = action.requiredEvidence.map(type => ({ type, provided: evidenceTypes.has(type) }));
    const qualityGates = [...COMMON_GATES];
    if (action.routeMode === 'web-when-needed') qualityGates.splice(1, 0, 'official-source-verification');
    if (['risk-audit', 'tor-boq-review', 'contract-review', 'regulation-extractor'].includes(action.id)) qualityGates.push('risk-review');

    return freeze({
      actionId: action.id,
      label: action.label,
      purpose: action.purpose,
      selectedGpId: selectedGpId(context) || null,
      routeMode: action.routeMode,
      requiredEvidence,
      missingEvidence: requiredEvidence.filter(item => !item.provided).map(item => item.type),
      outputSections: [...action.outputSections],
      qualityGates: [...new Set(qualityGates)],
      constraints: [
        'attached-file-first',
        'no-invented-facts',
        'flag-missing-information',
        action.routeMode === 'web-when-needed' ? 'official-sources-first-when-searching' : 'use-user-evidence-first',
        'human-final-review'
      ],
      requiresHumanReview: true
    });
  }

  function thaiRouteMode(routeMode) {
    return routeMode === 'web-when-needed'
      ? 'ใช้ข้อมูล/เอกสารที่ผู้ใช้ให้ก่อน และค้นเว็บเฉพาะเมื่อจำเป็น โดยยึดแหล่งราชการหรือต้นฉบับก่อน'
      : 'วิเคราะห์จากข้อมูลและเอกสารที่ผู้ใช้ให้ก่อน ไม่ค้นเว็บโดยอัตโนมัติ';
  }

  function buildSmartActionPrompt(context = {}, basePrompt = '') {
    const detected = detectSmartAction(context);
    if (detected.fallback || !detected.actionId) return String(basePrompt || '');

    const action = SMART_ACTION_BY_ID[detected.actionId];
    const plan = planSmartAction(action.id, context);
    const required = plan.requiredEvidence.map(item => `- ${item.type}: ${item.provided ? 'มีข้อมูลแล้ว' : '[ต้องแนบ/เพิ่มเติมหากจำเป็น]'}`).join('\n');
    const sections = plan.outputSections.map((section, index) => `${index + 1}. ${section}`).join('\n');
    const gates = plan.qualityGates.map(gate => `- ${gate}`).join('\n');
    const missing = plan.missingEvidence.length ? plan.missingEvidence.join(', ') : 'ไม่มีจากข้อมูลที่ตรวจพบ';

    const smartBlock = `SMART ACTION — ระบบเลือกอัตโนมัติ\nภารกิจย่อย: ${action.label}\nเป้าหมาย: ${action.purpose}\n\nแนวทางดำเนินการ\n- ${thaiRouteMode(plan.routeMode)}\n- หากมีไฟล์ PDF, Word, Excel, รูปภาพ หรือเอกสารหลายฉบับแนบมากับ AI ให้เปิดอ่านไฟล์เหล่านั้นก่อนใช้ความรู้ทั่วไป\n- อ้างอิงเฉพาะข้อมูลที่พบจริงในเอกสารหรือแหล่งที่ตรวจสอบได้ และระบุหน้า/หัวข้อ/ตารางเมื่อทำได้\n- หากข้อมูลไม่พอ ห้ามเดา ให้ระบุ [ต้องตรวจสอบ/เพิ่มเติม]\n- ตรวจและลดการเปิดเผยข้อมูลส่วนบุคคลหรือข้อมูลสุขภาพที่ไม่จำเป็นก่อนสรุปผล\n- ${ACTION_NOTES[action.id]}\n\nหลักฐาน/ข้อมูลที่ภารกิจนี้ต้องใช้\n${required}\nข้อมูลที่ยังขาดจากการตรวจอัตโนมัติ: ${missing}\n\nรูปแบบผลลัพธ์เฉพาะภารกิจ\n${sections}\n\nQUALITY GATE ก่อนจบคำตอบ\n${gates}\n- ตรวจชื่อ วันที่ ตัวเลข หน่วยงาน กฎหมาย/ระเบียบ และผลคำนวณอีกครั้ง\n- ผลลัพธ์เป็นข้อเสนอเพื่อช่วยงาน ไม่ใช่การอนุมัติหรือคำสั่งแทนผู้มีอำนาจ`;

    return `${String(basePrompt || '').trim()}\n\n${smartBlock}`.trim();
  }

  function prepare(context) {
    const source = context || {};
    return freeze({
      version: 1,
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
      riskFlags: clone(source.riskFlags || []),
      workflowState: String(valueOr(source.workflowState, 'idle'))
    });
  }

  function installSmartActionRuntime() {
    if (typeof document === 'undefined') return;

    const bind = () => {
      const form = document.getElementById('promptForm');
      const output = document.getElementById('output');
      const copyBtn = document.getElementById('copyBtn');
      const downloadBtn = document.getElementById('downloadBtn');
      const toolDesc = document.getElementById('toolDesc');
      const contextApi = window.GOVPROMPT_CONTEXT;
      if (!form || !output || !copyBtn || !downloadBtn || !contextApi || form.dataset.smartActionBound === 'true') return;
      form.dataset.smartActionBound = 'true';

      let badge = document.getElementById('smartActionBadge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'smartActionBadge';
        badge.style.cssText = 'display:none;margin-top:10px;padding:8px 11px;border-radius:10px;background:#eaf4ff;color:#103b70;font-size:12px;font-weight:700;border:1px solid #bdd8f7';
        toolDesc?.insertAdjacentElement('afterend', badge);
      }

      const showBadge = () => {
        const context = contextApi.get();
        const detected = detectSmartAction(context);
        if (!detected.actionId) {
          badge.style.display = 'none';
          badge.textContent = '';
          return;
        }
        const plan = planSmartAction(detected.actionId, context);
        badge.textContent = `✨ Smart Action: ${detected.label} · ${plan.routeMode === 'web-when-needed' ? 'ค้นเว็บเมื่อจำเป็น' : 'วิเคราะห์จากข้อมูลที่ให้'}`;
        badge.style.display = 'block';
      };

      document.addEventListener('click', event => {
        if (event.target?.closest?.('[data-open]')) {
          window.GOVPROMPT_ACTIVE_PROMPT = null;
          queueMicrotask(showBadge);
        }
      });
      form.addEventListener('input', () => queueMicrotask(showBadge));
      form.addEventListener('submit', () => {
        queueMicrotask(() => {
          const context = contextApi.get();
          const basePrompt = String(output.textContent || '');
          const smartPrompt = buildSmartActionPrompt(context, basePrompt);
          if (smartPrompt !== basePrompt && smartPrompt.trim()) {
            window.GOVPROMPT_ACTIVE_PROMPT = smartPrompt;
            window.GOVPROMPT_SMART_ACTION = detectSmartAction(context);
            window.GOVPROMPT_SMART_ACTION_PLAN = planSmartAction(window.GOVPROMPT_SMART_ACTION.actionId, context);
            output.textContent = smartPrompt;
            output.classList.remove('empty-result');
          } else {
            window.GOVPROMPT_ACTIVE_PROMPT = null;
          }
          showBadge();
        });
      });

      const originalCopy = copyBtn.onclick;
      copyBtn.onclick = async event => {
        const smartPrompt = window.GOVPROMPT_ACTIVE_PROMPT;
        if (!smartPrompt) return originalCopy?.call(copyBtn, event);
        try {
          await navigator.clipboard.writeText(smartPrompt);
          const old = copyBtn.textContent;
          copyBtn.textContent = '✅ คัดลอกแล้ว';
          setTimeout(() => { copyBtn.textContent = old; }, 1200);
        } catch {
          return originalCopy?.call(copyBtn, event);
        }
      };

      const originalDownload = downloadBtn.onclick;
      downloadBtn.onclick = event => {
        const smartPrompt = window.GOVPROMPT_ACTIVE_PROMPT;
        if (!smartPrompt) return originalDownload?.call(downloadBtn, event);
        const blob = new Blob([smartPrompt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const gpId = contextApi.get()?.selectedGpId || 'GovPrompt';
        anchor.href = url;
        anchor.download = `${gpId}-smart-action.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
      };

      showBadge();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
    else queueMicrotask(bind);
  }

  window.GOVPROMPT_CORE_ENGINE = Object.freeze({
    prepare,
    smartActions: SMART_ACTIONS,
    detectSmartAction,
    inferEvidenceTypes,
    planSmartAction,
    buildSmartActionPrompt
  });

  installSmartActionRuntime();
})();
