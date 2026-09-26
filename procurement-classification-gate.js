(() => {
  'use strict';

  const V727 = 'กค (กวจ) 0405.2/ว 727 ลงวันที่ 22 กันยายน 2569';
  const SERVICE_TERMS = [
    'ช่วยปฏิบัติงาน','สนับสนุนงาน','บันทึกข้อมูล','จัดทำเอกสาร','ธุรการ',
    'วิเคราะห์นโยบายและแผน','สำรวจข้อมูล','ดูแลสถานที่','ทำความสะอาด',
    'ขับรถ','พนักงานขับรถ','จัดเก็บขยะ','ประชาสัมพันธ์','สนับสนุนงานด้าน'
  ];
  const OTHER_TERMS = [
    'ซ่อมรถ','ซ่อมแซมรถ','ซ่อมครุภัณฑ์','ซ่อมบำรุง','ทำป้าย','ผลิตป้าย',
    'ผลิตหรือจัดทำสิ่งของ','จัดทำสิ่งของ','ประกอบอาหาร','อาหารกลางวัน'
  ];

  const text = v => String(v ?? '').normalize('NFC').trim();
  const hasAny = (s, terms) => terms.filter(t => s.includes(t));

  function classify(input = {}) {
    const job = text(input['ลักษณะงานที่ต้องการจ้าง']);
    const deliverables = text(input['ผลผลิต/งานที่ต้องส่งมอบ']);
    const combined = [job, deliverables].filter(Boolean).join(' ');
    const serviceHits = hasAny(combined, SERVICE_TERMS);
    const otherHits = hasAny(combined, OTHER_TERMS);

    let classification = 'UNDETERMINED';
    let decisionLock = false;
    let reason = 'ยังมีข้อมูลไม่พอสำหรับจำแนกวัตถุแห่งการจัดจ้าง';
    let nextAction = 'ตรวจลักษณะงาน ผลส่งมอบ และ TOR เพิ่มเติม';

    if (otherHits.length && !serviceHits.length) {
      classification = 'OTHER_PROCUREMENT_SERVICE';
      reason = 'พบลักษณะงานที่ชี้ไปยังงานจ้างประเภทอื่น ไม่ควรอนุมานว่าเป็น ว 727 เพียงเพราะผู้รับจ้างเป็นบุคคลธรรมดา';
      nextAction = 'จำแนกประเภทงานจ้างตามวัตถุแห่งการจัดหา และใช้หลักเกณฑ์/แบบสัญญาของงานประเภทนั้น';
    } else if (serviceHits.length && !otherHits.length) {
      classification = 'NATURAL_PERSON_SERVICE_CANDIDATE';
      reason = 'พบลักษณะงานที่มีแนวโน้มเป็นงานจ้างเหมาบริการบุคคลธรรมดา แต่ยังต้องตรวจ TOR/ผลส่งมอบและฐานอำนาจก่อนสรุป';
      nextAction = 'ตรวจองค์ประกอบตาม ว 727, TOR, แบบสัญญา และเงื่อนไขที่เกี่ยวข้อง';
    } else if (serviceHits.length && otherHits.length) {
      classification = 'MIXED_OR_CONFLICT';
      decisionLock = true;
      reason = 'พบทั้งลักษณะงานจ้างเหมาบริการและงานจ้างประเภทอื่น จึงห้ามเลือกใช้ ว 727 จากคำสำคัญเพียงอย่างเดียว';
      nextAction = 'แยกวัตถุแห่งการจัดจ้าง/ผลส่งมอบและตรวจข้อเท็จจริงก่อนตัดสิน';
    } else {
      decisionLock = true;
    }

    return Object.freeze({
      policyVersion: 'v727-classification-gate.1',
      authority: V727,
      rule: 'PERSON_STATUS_IS_NOT_PROCUREMENT_CLASSIFICATION',
      classification,
      naturalPersonStatus: true,
      serviceTermHits: Object.freeze(serviceHits),
      otherProcurementHits: Object.freeze(otherHits),
      decisionLock,
      reason,
      nextAction
    });
  }

  window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE = Object.freeze({ classify, authority: V727 });
  if (typeof module !== 'undefined' && module.exports) module.exports = window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE;
})();