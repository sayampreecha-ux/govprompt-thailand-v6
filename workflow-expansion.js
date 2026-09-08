(() => {
  'use strict';

  const QUALITY_STATUS = Object.freeze({ PASS: 'PASS', NEEDS_INFO: 'NEEDS_INFO', BLOCKED: 'BLOCKED', REVIEW_REQUIRED: 'REVIEW_REQUIRED' });
  const WORKFLOW_STATES = Object.freeze(['intake', 'collecting-evidence', 'risk-review', 'human-review', 'deliverable-ready', 'blocked', 'not-applicable']);
  const TRANSITIONS = Object.freeze({
    intake: Object.freeze(['collecting-evidence', 'blocked']),
    'collecting-evidence': Object.freeze(['risk-review', 'human-review', 'blocked']),
    'risk-review': Object.freeze(['human-review', 'blocked']),
    'human-review': Object.freeze(['deliverable-ready', 'collecting-evidence', 'blocked']),
    'deliverable-ready': Object.freeze([]),
    blocked: Object.freeze([]),
    'not-applicable': Object.freeze([])
  });

  const HIGH_RISK_CATEGORIES = Object.freeze(new Set([
    'กฎหมาย', 'การเงิน', 'การคลัง', 'พัสดุ', 'บุคคล', 'งบประมาณ', 'สภาท้องถิ่น',
    'legal', 'finance', 'treasury', 'procurement', 'personnel', 'budget', 'council'
  ]));
  const AUTHORITY_GATE_ID = 'global-high-risk-authority-transition';
  const ACCURACY_GATE_ID = 'global-high-risk-accuracy';
  const PRECEDENT_PATTERN = /(คำพิพากษา|ศาลปกครอง|ฎีกา|คำวินิจฉัย|หนังสือหารือ|ตอบข้อหารือ|แนววินิจฉัย|แนวปฏิบัติเดิม|บรรทัดฐาน|แนวเดิม|แนวคำตอบเดิม|เคสเดิม|กรณีเดิม|เคยตอบ|เคยวินิจฉัย|เคยมีหนังสือ|เคยเบิกได้|เคยอนุมัติ|เมื่อก่อน.*(?:ได้|ไม่ได้|ให้|ไม่ให้)|แต่เดิม.*(?:ได้|ไม่ได้|ให้|ไม่ให้)|เดิม.*(?:ให้|ไม่ให้|เบิก|อนุมัติ)|ยังใช้.*(?:แนว|หลัก|คำตอบ).*เดิม|precedent|case law|prior case|prior ruling|previous guidance|ruling|opinion)/i;
  const HIGH_RISK_ACCURACY_RULES = Object.freeze([
    'ห้ามสร้างหรือเดาเลขหนังสือ วันที่ เลขคำพิพากษา เลขข้อกฎหมาย ชื่อเอกสาร หรือข้อความอ้างอิงที่ตรวจยืนยันไม่ได้',
    'ใช้หลักฐานราชการ/แหล่งต้นฉบับที่มีอำนาจสูงสุดก่อนแหล่งสรุปหรือบทความ และเปิดตรวจเนื้อหาจริงเมื่อเครื่องมือรองรับ',
    'ตรวจว่ากฎหมาย ระเบียบ หนังสือ หรือแนววินิจฉัยฉบับที่อ้างใช้บังคับกับวันที่เกิดเหตุและประเภทบุคคล/หน่วยงานของเคสจริง',
    'ก่อนฟันธงให้ค้นและพิจารณาหลักฐานที่อาจให้ผลตรงข้าม รวมถึงฉบับแก้ไข ยกเลิก หนังสือภายหลัง ข้อยกเว้น และข้อเท็จจริงที่แตกต่าง',
    'ถ้าหลักฐานสำคัญยังเปิดตรวจหรือยืนยันไม่ได้ ให้ระบุว่ายังยืนยันไม่ได้/UNVERIFIED และห้ามคาดเดาหรือฟันธง'
  ]);

  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: 'tor-procurement',
      gpIds: Object.freeze(['GP009', 'GP010', 'GP011', 'GP012']),
      requiredEvidence: Object.freeze(['requirement-specification', 'market-information', 'budget-basis']),
      riskGates: Object.freeze(['competition-and-specification-review', 'acceptance-and-contract-review']),
      deliverable: 'procurement-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'financial-disbursement',
      gpIds: Object.freeze(['GP019']),
      requiredEvidence: Object.freeze(['payment-request', 'supporting-documents', 'approval-reference']),
      riskGates: Object.freeze(['supporting-document-review', 'authority-and-budget-review']),
      deliverable: 'financial-review-brief',
      handoffTargets: Object.freeze(['legal-analysis', 'official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'legal-analysis',
      gpIds: Object.freeze(['GP005', 'GP006', 'GP007', 'GP008']),
      requiredEvidence: Object.freeze(['facts', 'authority-or-source-provided', 'question-for-review']),
      riskGates: Object.freeze(['source-verification', 'human-legal-review']),
      deliverable: 'legal-review-brief',
      handoffTargets: Object.freeze(['official-letter-follow-up'])
    }),
    Object.freeze({
      id: 'official-letter-follow-up',
      gpIds: Object.freeze(['GP001', 'GP002', 'GP003', 'GP004']),
      requiredEvidence: Object.freeze(['facts', 'recipient-or-destination', 'reference-documents']),
      riskGates: Object.freeze(['authority-and-fact-review', 'human-final-review']),
      deliverable: 'official-letter-draft',
      handoffTargets: Object.freeze(['legal-analysis'])
    })
  ]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }
  function definitionFor(gpId) { return DEFINITIONS.find(definition => definition.gpIds.includes(gpId)) || null; }
  function statusFor(qualityStatus) {
    if (qualityStatus === QUALITY_STATUS.PASS) return 'READY_FOR_REVIEW';
    if (qualityStatus === QUALITY_STATUS.NEEDS_INFO) return 'NEEDS_INFO';
    if (qualityStatus === QUALITY_STATUS.REVIEW_REQUIRED) return 'REVIEW_REQUIRED';
    return 'BLOCKED';
  }
  function stateFor(status) {
    return { READY_FOR_REVIEW: 'human-review', NEEDS_INFO: 'collecting-evidence', REVIEW_REQUIRED: 'risk-review', BLOCKED: 'blocked' }[status] || 'blocked';
  }

  function text(value) { return String(value ?? '').trim(); }
  function list(value) {
    if (Array.isArray(value)) return value.flatMap(list);
    if (value == null || value === '') return [];
    if (typeof value === 'object') return Object.values(value).flatMap(list);
    return [text(value)].filter(Boolean);
  }
  function categoryValues(envelope = {}) {
    return [...new Set([
      ...list(envelope?.task?.category), ...list(envelope?.task?.categories),
      ...list(envelope?.task?.domain), ...list(envelope?.task?.domains),
      ...list(envelope?.category), ...list(envelope?.categories),
      ...list(envelope?.domain), ...list(envelope?.domains)
    ].map(value => value.toLowerCase()))];
  }
  function isHighRiskEnvelope(envelope = {}) {
    return categoryValues(envelope).some(category => HIGH_RISK_CATEGORIES.has(category));
  }
  function dateValue(value) { const s = text(value); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
  function localTransitionEvaluate(input = {}) {
    if (input.precedentReliedOn !== true) return freeze({ pass: true, status: 'NOT_APPLICABLE', decisionLock: false, blockers: [] });
    const precedentFactDate = dateValue(input.precedentFactDate);
    const currentFactDate = dateValue(input.currentFactDate);
    const laterAuthorities = Array.isArray(input.laterAuthorities) ? input.laterAuthorities : [];
    const unresolved = laterAuthorities.filter(a => a?.relevant !== false && a?.transitionResolved !== true);
    const blockers = [];
    if (!precedentFactDate) blockers.push('missing-precedent-fact-date');
    if (!currentFactDate) blockers.push('missing-current-fact-date');
    if (input.laterAuthoritySearchCompleted !== true) blockers.push('later-authority-search-not-completed');
    if (input.ruleVersionCheckCompleted !== true) blockers.push('rule-version-check-not-completed');
    if (input.contraryEvidenceCheckCompleted !== true) blockers.push('contrary-evidence-check-not-completed');
    if (precedentFactDate && currentFactDate && currentFactDate < precedentFactDate) blockers.push('timeline-not-resolved');
    if (unresolved.length) blockers.push('later-authority-effect-unresolved');
    return freeze({ pass: blockers.length === 0, status: blockers.length ? 'BLOCKED_LATER_AUTHORITY_CHECK' : 'PASS', decisionLock: blockers.length > 0, blockers });
  }

  function joinedEnvelopeText(envelope = {}) {
    return [
      envelope?.task?.query,
      envelope?.query,
      ...Object.entries(envelope?.userInputs || {}).flatMap(([key, value]) => [key, value])
    ].filter(Boolean).join(' ');
  }
  function explicitAuthorityTransition(envelope = {}) {
    return envelope.authorityTransition || envelope.transitionGateInput || envelope.transition || null;
  }
  function authorityTransitionInput(envelope = {}) {
    const explicit = explicitAuthorityTransition(envelope);
    if (explicit && Object.keys(explicit).length) return explicit;
    if (!isHighRiskEnvelope(envelope)) return {};
    if (!PRECEDENT_PATTERN.test(joinedEnvelopeText(envelope))) return {};
    return {
      precedentReliedOn: true,
      precedentFactDate: null,
      currentFactDate: null,
      laterAuthoritySearchCompleted: false,
      ruleVersionCheckCompleted: false,
      contraryEvidenceCheckCompleted: false,
      laterAuthorities: [],
      inferredFromUserInput: true
    };
  }
  function isHighRiskAuthorityCase(envelope = {}) {
    const input = authorityTransitionInput(envelope);
    return input.precedentReliedOn === true && isHighRiskEnvelope(envelope);
  }
  function evaluateAuthorityTransition(envelope = {}) {
    if (!isHighRiskAuthorityCase(envelope)) return freeze({ applicable: false, pass: true, status: 'NOT_APPLICABLE', blockers: [] });
    const evaluator = typeof window !== 'undefined' && window.GOVPROMPT_LEGAL_TRANSITION_GATE?.evaluate;
    const result = typeof evaluator === 'function' ? evaluator(authorityTransitionInput(envelope)) : localTransitionEvaluate(authorityTransitionInput(envelope));
    return freeze({ applicable: true, ...result });
  }
  function accuracyControl(envelope = {}) {
    const applicable = isHighRiskEnvelope(envelope);
    return freeze({ applicable, gate: ACCURACY_GATE_ID, rules: applicable ? [...HIGH_RISK_ACCURACY_RULES] : [] });
  }
  function authorityBlockedPlan(envelope, result, definition) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    const blockers = [...(result.blockers || [])];
    return freeze({
      workflowId: definition?.id || null,
      selectedGpId,
      status: 'BLOCKED',
      currentState: 'blocked',
      states: [...WORKFLOW_STATES],
      availableTransitions: [],
      requiredEvidence: [],
      missingInformation: blockers.map(item => `authority-transition:${item}`),
      riskGates: [
        { gate: ACCURACY_GATE_ID, triggered: true, blockers: [] },
        { gate: AUTHORITY_GATE_ID, triggered: true, blockers }
      ],
      riskFlags: [ACCURACY_GATE_ID, AUTHORITY_GATE_ID],
      requiresHumanReview: true,
      decisionLock: true,
      qualityStatus: 'UNVERIFIED',
      workflowStatus: 'BLOCKED_LATER_AUTHORITY_CHECK',
      nextAction: 'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK',
      highRiskAccuracy: accuracyControl(envelope),
      authorityTransition: result,
      deliverable: { type: definition?.deliverable || null, state: 'BLOCKED' },
      handoff: { allowedTargets: definition ? [...definition.handoffTargets] : [], requiresHumanDecision: true }
    });
  }

  function plan(envelope, qualityResult) {
    const selectedGpId = envelope?.task?.selectedGpId || null;
    const definition = definitionFor(selectedGpId);
    const highRiskAccuracy = accuracyControl(envelope || {});
    const authorityTransition = evaluateAuthorityTransition(envelope || {});
    if (authorityTransition.applicable && !authorityTransition.pass) return authorityBlockedPlan(envelope || {}, authorityTransition, definition);

    if (!definition) {
      return freeze({
        workflowId: null,
        selectedGpId,
        status: 'NOT_APPLICABLE',
        currentState: 'not-applicable',
        states: [...WORKFLOW_STATES],
        requiredEvidence: [],
        missingInformation: [],
        riskGates: [
          ...(highRiskAccuracy.applicable ? [{ gate: ACCURACY_GATE_ID, triggered: true, blockers: [] }] : []),
          ...(authorityTransition.applicable ? [{ gate: AUTHORITY_GATE_ID, triggered: false, blockers: [] }] : [])
        ],
        requiresHumanReview: true,
        decisionLock: false,
        highRiskAccuracy,
        authorityTransition,
        deliverable: { type: null, state: 'NOT_READY' },
        handoff: { allowedTargets: [], requiresHumanDecision: true }
      });
    }

    const qualityChecks = qualityResult?.checks || {};
    const riskFlags = [...new Set([...(envelope?.riskFlags || []), ...(qualityChecks.riskFlags || []), ...(qualityChecks.pdpaSecurity?.concerns || [])].map(String))];
    const evidenceTypes = new Set((envelope?.evidence?.types || []).map(String));
    const requiredEvidence = definition.requiredEvidence.map(type => ({ type, provided: evidenceTypes.has(type) }));
    const missingWorkflowEvidence = requiredEvidence.filter(evidence => !evidence.provided).map(evidence => `workflow-evidence:${evidence.type}`);
    const missingInformation = [...new Set([...clone(qualityChecks.missingInformation || []), ...missingWorkflowEvidence])];
    const qualityStatus = qualityResult?.status || QUALITY_STATUS.BLOCKED;
    const status = qualityStatus === QUALITY_STATUS.PASS && missingWorkflowEvidence.length ? 'NEEDS_INFO' : statusFor(qualityStatus);
    const deliverableState = status === 'READY_FOR_REVIEW' ? 'READY_FOR_HUMAN_REVIEW' : status === 'BLOCKED' ? 'BLOCKED' : 'NOT_READY';
    const currentState = stateFor(status);
    const riskGates = definition.riskGates.map(gate => ({ gate, triggered: riskFlags.includes(gate) }));
    if (highRiskAccuracy.applicable) riskGates.unshift({ gate: ACCURACY_GATE_ID, triggered: true, blockers: [] });
    if (authorityTransition.applicable) riskGates.unshift({ gate: AUTHORITY_GATE_ID, triggered: false, blockers: [] });

    return freeze({
      workflowId: definition.id,
      selectedGpId,
      status,
      currentState,
      states: [...WORKFLOW_STATES],
      availableTransitions: [...TRANSITIONS[currentState]],
      requiredEvidence,
      missingInformation,
      riskGates,
      riskFlags,
      requiresHumanReview: true,
      decisionLock: false,
      highRiskAccuracy,
      authorityTransition,
      deliverable: { type: definition.deliverable, state: deliverableState },
      handoff: { allowedTargets: [...definition.handoffTargets], requiresHumanDecision: true }
    });
  }

  function blockerThai(blocker) {
    return ({
      'missing-precedent-fact-date': 'ระบุวันที่ข้อเท็จจริงของคำพิพากษา/แนวเดิม',
      'missing-current-fact-date': 'ระบุวันที่ข้อเท็จจริงของเรื่องปัจจุบัน',
      'later-authority-search-not-completed': 'ค้นกฎหมาย ระเบียบ หนังสือสั่งการ/หารือ และแนววินิจฉัยที่ออกภายหลัง',
      'rule-version-check-not-completed': 'ตรวจฉบับกฎหมาย/ระเบียบที่ใช้บังคับ ณ วันที่เกิดเหตุและฉบับปัจจุบัน',
      'contrary-evidence-check-not-completed': 'ตรวจหลักฐานหรือแนวทางที่อาจให้ผลตรงข้าม',
      'timeline-not-resolved': 'แก้ลำดับเวลาให้ชัดเจน',
      'later-authority-effect-unresolved': 'วิเคราะห์ผลของหลักเกณฑ์ภายหลังต่อ precedent เดิม'
    })[blocker] || blocker;
  }

  function accuracyGuardText() {
    return `\n\nGLOBAL HIGH-RISK ACCURACY RULES — บังคับใช้กับงานเสี่ยงสูง\n${HIGH_RISK_ACCURACY_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}\n- หาก AI มี Web Search/เครื่องมือค้นข้อมูล ให้ค้นและเปิดหลักฐานเองทันที ห้ามเพียงแนะนำให้ผู้ใช้ไปค้น\n- SEARCH FOR THE CASE, NOT JUST THE WORDS; “ค้นข้อความไม่พบ” ไม่เท่ากับ “ไม่มีเอกสาร”\n- คำตอบต้องแยกให้ชัดว่าอะไรคือข้อเท็จจริง อะไรคือหลักฐาน อะไรคือการวิเคราะห์ และอะไรคือข้อสรุป`;
  }
  function transitionGuardText(gatePlan) {
    const blockers = gatePlan?.authorityTransition?.blockers || [];
    return `\n\nGLOBAL HIGH-RISK AUTHORITY GATE — บังคับใช้ก่อนฟันธง\nสถานะ: BLOCKED_LATER_AUTHORITY_CHECK\nห้ามสรุปสิทธิ อำนาจ ความชอบด้วยกฎหมาย หรืออนุมัติ/ไม่อนุมัติจาก precedent เดิมเพียงอย่างเดียว\n\nต้องดำเนินการต่อให้ครบ:\n${blockers.map((item, index) => `${index + 1}. ${blockerThai(item)}`).join('\n')}\n\nวิธีทำงานที่บังคับ:\n- แยกวันที่ข้อเท็จจริงของ precedent ออกจากวันที่มีคำพิพากษาหรือหนังสือ\n- ตรวจหลักเกณฑ์ที่ออกภายหลังทั้งหมดจนถึงวันที่เกิดกรณีปัจจุบัน และตรวจสถานะปัจจุบันอีกครั้ง\n- วิเคราะห์ผลของหลักเกณฑ์ภายหลังต่อ precedent เดิมทีละฉบับ\n- ตรวจ contrary evidence ก่อนสรุป\n- หากยังตรวจไม่ครบ ให้รายงานว่า UNVERIFIED และห้ามฟันธง\n- เมื่อครบแล้วจึง Answer First พร้อมฐานอำนาจ แหล่งอ้างอิง และเหตุผลการปรับใช้`;
  }

  function installAuthorityGateRuntime() {
    if (typeof document === 'undefined') return false;
    const form = document.getElementById('promptForm');
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    if (!form || !output || form.dataset.authorityGateRuntimeInstalled === 'true') return false;
    form.dataset.authorityGateRuntimeInstalled = 'true';

    form.addEventListener('submit', () => {
      queueMicrotask(() => {
        const gatePlan = typeof window !== 'undefined' ? window.GOVPROMPT_WORKFLOW_PLAN : null;
        if (!gatePlan?.highRiskAccuracy?.applicable) return;
        const currentPrompt = String(output.textContent || '').trim();
        let guard = '';
        if (!currentPrompt.includes('GLOBAL HIGH-RISK ACCURACY RULES —')) guard += accuracyGuardText();
        if (gatePlan?.decisionLock && gatePlan?.workflowStatus === 'BLOCKED_LATER_AUTHORITY_CHECK' && !currentPrompt.includes('GLOBAL HIGH-RISK AUTHORITY GATE —')) guard += transitionGuardText(gatePlan);
        if (!guard) return;
        const guardedPrompt = `${currentPrompt}${guard}`.trim();
        output.textContent = guardedPrompt;
        output.classList.remove('empty-result');
        window.GOVPROMPT_ACTIVE_PROMPT = guardedPrompt;
        if (copyBtn) copyBtn.disabled = false;
        if (downloadBtn) downloadBtn.disabled = false;
      });
    });

    copyBtn?.addEventListener('click', async event => {
      const gatePlan = window.GOVPROMPT_WORKFLOW_PLAN;
      if (!gatePlan?.highRiskAccuracy?.applicable) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try { await navigator.clipboard.writeText(String(output.textContent || '')); } catch {}
    }, true);

    downloadBtn?.addEventListener('click', event => {
      const gatePlan = window.GOVPROMPT_WORKFLOW_PLAN;
      if (!gatePlan?.highRiskAccuracy?.applicable) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const blob = new Blob([String(output.textContent || '')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = gatePlan?.decisionLock ? 'GovPrompt-authority-gate.txt' : 'GovPrompt-high-risk-accuracy.txt';
      anchor.click();
      URL.revokeObjectURL(url);
    }, true);
    return true;
  }

  const api = Object.freeze({
    plan, definitions: DEFINITIONS, states: WORKFLOW_STATES, transitions: TRANSITIONS,
    highRiskCategories: HIGH_RISK_CATEGORIES, highRiskAccuracyRules: HIGH_RISK_ACCURACY_RULES,
    evaluateAuthorityTransition, authorityGateId: AUTHORITY_GATE_ID, accuracyGateId: ACCURACY_GATE_ID,
    authorityTransitionInput, categoryValues, isHighRiskEnvelope, accuracyControl, installAuthorityGateRuntime
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_WORKFLOW_EXPANSION = api;
  installAuthorityGateRuntime();
})();