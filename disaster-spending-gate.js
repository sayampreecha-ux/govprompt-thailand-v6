(() => {
  'use strict';

  const AUTHORITY = 'มท 0808.2/ว 980 ลงวันที่ 5 กุมภาพันธ์ 2569';
  const SAVINGS_RULE = 'ระเบียบ มท. ว่าด้วยการรับเงิน การเบิกจ่ายเงิน การฝากเงิน การเก็บรักษาเงิน และการตรวจเงินของ อปท. พ.ศ. 2566 ข้อ 100';

  function text(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function inputText(source = {}) {
    return text([
      source.query,
      source.task?.query,
      source.category,
      ...Object.values(source.userInputs || {})
    ].join(' '));
  }

  function isDisasterCase(source = {}) {
    return /สาธารณภัย|ภัยพิบัติ|น้ำท่วม|วาตภัย|อัคคีภัย|ดินถล่ม|อพยพ|ถุงยังชีพ|เครื่องสูบน้ำ|ระบายน้ำ|ช่วยเหลือผู้ประสบภัย|ผู้ประสบภัย/i.test(inputText(source));
  }

  function asksDecision(source = {}) {
    return /ได้ไหม|ได้หรือไม่|สามารถ|มีอำนาจ|อนุมัติ|เบิก|จ่าย|ใช้เงิน|ใช้เงินสะสม|จ่ายขาด|ข้อ\s*100|โอนงบ|เงินสำรองจ่าย/i.test(inputText(source));
  }

  function detect(source = {}) {
    const s = inputText(source);
    return {
      disasterOccurred: /เกิด|เกิดเหตุ|ประสบ|มี.*สาธารณภัย|น้ำท่วม|วาตภัย|อัคคีภัย|ดินถล่ม|ภัยพิบัติ/i.test(s),
      emergencyNeed: /ฉุกเฉิน|เร่งด่วน|ทันที|จำเป็นในขณะนั้น|ช่วยชีวิต|คุ้มครองชีวิต|บรรเทาความเดือดร้อน/i.test(s),
      authorityScope: /อำนาจหน้าที่|ภายใต้อำนาจ|ภารกิจของ อปท\.|ภารกิจ อปท\.|ช่วยเหลือประชาชน/i.test(s),
      reserveMentioned: /เงินสำรองจ่าย|งบกลาง.*สำรองจ่าย|สำรองจ่าย/i.test(s),
      transferMentioned: /โอนงบ|โอนงบประมาณ|รายการที่เหลือจ่าย|หมดความจำเป็น|จำเป็นน้อยกว่า/i.test(s),
      savingsMentioned: /เงินสะสม|จ่ายขาดเงินสะสม|ข้อ\s*100/i.test(s),
      reliefRateQuestion: /กี่บาท|เท่าไร|อัตรา|ถุงยังชีพ.*ราคา|ค่าอาหาร|ค่าซ่อม|ค่าช่วยเหลือ/i.test(s),
      announcementQuestion: /ประกาศ.*เขต|เขต.*ภัยพิบัติ|ประกาศเขตภัย/i.test(s)
    };
  }

  function evaluate(source = {}) {
    if (!isDisasterCase(source)) {
      return Object.freeze({
        applicable: false,
        status: 'NOT_APPLICABLE',
        decisionLock: false,
        blockers: [],
        authority: AUTHORITY
      });
    }

    const d = detect(source);
    const blockers = [];

    if (asksDecision(source)) {
      if (!d.disasterOccurred) blockers.push('disaster-fact-not-established');
      if (!d.emergencyNeed) blockers.push('emergency-necessity-not-established');
      if (!d.authorityScope) blockers.push('local-authority-scope-not-established');
    }

    const savingsGate = d.savingsMentioned ? {
      applicable: true,
      rule: SAVINGS_RULE,
      requires: [
        'กรณีฉุกเฉินที่มีสาธารณภัยเกิดขึ้น',
        'เป็นค่าใช้จ่ายที่จำเป็นในขณะนั้น',
        'พิจารณาลำดับแหล่งเงินตามแนวทาง ว 980',
        'คำนึงถึงฐานะการเงินการคลังของ อปท.'
      ],
      autoApproval: false,
      decisionLock: blockers.length > 0
    } : {
      applicable: false,
      rule: SAVINGS_RULE,
      requires: [],
      autoApproval: false,
      decisionLock: false
    };

    const fundingPath = {
      order: ['เงินสำรองจ่าย', 'โอนงบประมาณตามระเบียบ', 'เงินสะสมตามข้อ 100 เมื่อเข้าเงื่อนไข'],
      note: 'ห้ามใช้กฎตายตัวว่าเงินสำรองหมดแล้วจ่ายเงินสะสมได้อัตโนมัติ'
    };

    const reliefPath = {
      separateFromFundingSource: true,
      note: 'ว 980 เน้นแนวทางแหล่งเงิน/การใช้จ่าย ไม่ใช่บัญชีอัตราค่าช่วยเหลือ; อัตราและคุณสมบัติต้องตรวจหลักเกณฑ์การช่วยเหลือประเภทนั้นเพิ่มเติม'
    };

    const announcement = {
      noAutomaticRequirement: true,
      note: 'ไม่ควรใช้การมีหรือไม่มีประกาศเขตภัยพิบัติเป็นเงื่อนไขเดียว ต้องตรวจข้อเท็จจริง อำนาจหน้าที่ ความฉุกเฉิน และหลักเกณฑ์ที่เกี่ยวข้อง'
    };

    return Object.freeze({
      applicable: true,
      status: blockers.length ? 'VERIFY_DISASTER_SPENDING_AUTHORITY' : 'DISASTER_RULE_READY',
      decisionLock: blockers.length > 0,
      blockers,
      authority: AUTHORITY,
      detected: d,
      fundingPath,
      savingsGate,
      reliefPath,
      announcement,
      guardrails: [
        'ไม่ hard-code ว่าเงินสำรองหมด = ข้อ 100',
        'ไม่ถือว่าไม่มีประกาศเขตภัยพิบัติ = เบิกได้ทุกกรณี',
        'ไม่ถือว่า ว 980 เป็นบัญชีอัตราค่าช่วยเหลือ',
        'หากข้อเท็จจริงสำคัญยังไม่ครบ ให้ตอบแบบมีเงื่อนไขและไม่ Final Decision'
      ]
    });
  }

  function policy(source = {}) {
    const review = evaluate(source);
    if (!review.applicable) return '';
    return `\n\n[Disaster Spending Authority Gate — ว 980]\n- ฐานหลัก: ${AUTHORITY}\n- เส้นทางแหล่งเงิน: เงินสำรองจ่าย → โอนงบประมาณตามระเบียบ → หากยังไม่เพียงพอและเข้าเงื่อนไขฉุกเฉินที่มีสาธารณภัย จึงตรวจข้อ 100\n- ข้อ 100 ไม่ใช่กฎอัตโนมัติจากคำว่า “เงินหมด”; ต้องตรวจเหตุสาธารณภัย ความฉุกเฉิน ความจำเป็นในขณะนั้น อำนาจหน้าที่ และฐานะการเงินการคลัง\n- แยก “ฐานอำนาจ/แหล่งเงิน” ออกจาก “อัตราและหลักเกณฑ์การช่วยเหลือ”\n- หากข้อเท็จจริงสำคัญยังไม่ครบ: Decision Lock เฉพาะ Final Decision แต่ยังให้คำอธิบายที่ยืนยันได้และระบุสิ่งที่ต้องตรวจต่อ\n`;
  }

  const api = Object.freeze({ evaluate, detect, isDisasterCase, policy, AUTHORITY, SAVINGS_RULE });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GOVPROMPT_DISASTER_SPENDING_GATE = api;
})();