(() => {
  'use strict';

  const V727 = 'กค (กวจ) 0405.2/ว 727 ลงวันที่ 22 กันยายน 2569';
  const V9636 = 'มท 0808.2/ว 9636 ลงวันที่ 10 กันยายน 2567';
  const V877 = 'กค (กวจ) 0405.2/ว 877 ลงวันที่ 8 ธันวาคม 2568';
  const V727_RULES = Object.freeze({
    supersedes: V877,
    legalDefinition: 'งานจ้างเหมาบริการมุ่งเน้นผลสำเร็จของงานภายในระยะเวลาตามสัญญา/ข้อตกลง ผู้รับจ้างมีอิสระในการทำงาน ผู้ว่าจ้างไม่มีอำนาจควบคุมบังคับบัญชาหรือสั่งการ มีเพียงตรวจตราและสั่งแก้ไขเมื่อผิดพลาดบกพร่อง',
    paymentGate: 'จ่ายสินจ้างเมื่อถึงงวด/เงื่อนไขส่งมอบ ผู้รับจ้างส่งมอบงาน และผู้ตรวจรับตรวจรับถูกต้องครบถ้วนแล้ว',
    exemptions: ['ระเบียบฯ ข้อ 162 และ 163 เรื่องค่าปรับ', 'ระเบียบฯ ข้อ 168 เรื่องหลักประกันการปฏิบัติตามสัญญา'],
    torRule: 'TOR ต้องสอดคล้องกับลักษณะงานจ้างเหมาบริการและเงื่อนไขตามแบบสัญญาจ้างงานบริการประเภทจ้างเหมาบริการบุคคลธรรมดา'
  });
  const SERVICE_TERMS = [
    'ช่วยปฏิบัติงาน','ช่วยเสริมการปฏิบัติงาน','เสริมการปฏิบัติงาน','สนับสนุนงาน','สนับสนุนการปฏิบัติงาน','บันทึกข้อมูล','จัดทำเอกสาร','ธุรการ',
    'วิเคราะห์นโยบายและแผน','สำรวจข้อมูล','สำรวจ','ดูแลสถานที่','ดูแลข้อมูล','ทำความสะอาด',
    'ขับรถ','พนักงานขับรถ','ขับเครื่องจักร','จัดเก็บขยะ','รักษาความปลอดภัย','ประชาสัมพันธ์',
    'จัดทำข้อมูล','จัดทำรายงาน','จัดทำทะเบียน','เตรียมข้อมูล','เตรียมเอกสาร','ปฏิบัติงานสอน','สอน',
    'สนับสนุนการจัดการศึกษา','สนับสนุนงานด้าน'
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

    const authorityCheck = Object.freeze({
      status: classification === 'NATURAL_PERSON_SERVICE_CANDIDATE' ? 'APPLICABLE_CANDIDATE_VERIFY_FACTS' : classification === 'OTHER_PROCUREMENT_SERVICE' ? 'NOT_V727_BY_OBJECT' : 'LOCKED_FOR_CLASSIFICATION',
      authority: V727,
      issuingAuthority: 'กรมบัญชีกลาง / คณะกรรมการวินิจฉัยปัญหาการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ',
      versionStatus: 'CURRENT_SOURCE_VERIFIED',
      supersedes: V877,
      legalDefinition: V727_RULES.legalDefinition,
      independenceRequirement: 'ตรวจว่าผู้รับจ้างมีอิสระในการทำงาน และหน่วยงานไม่ควบคุมบังคับบัญชาหรือสั่งการแบบลูกจ้าง',
      paymentRequirement: V727_RULES.paymentGate,
      exemptions: Object.freeze(V727_RULES.exemptions),
      torRequirement: V727_RULES.torRule,
      requiredEvidence: Object.freeze(['TOR/ขอบเขตงานที่ระบุผลสำเร็จและผลส่งมอบ','เงื่อนไขสัญญาหรือข้อตกลง','หลักฐานการส่งมอบงาน','รายงาน/หลักฐานการตรวจรับ'])
    });

    return Object.freeze({
      policyVersion: 'v727-classification-gate.3-v9636-support-service',
      authority: V727,
      rule: 'PERSON_STATUS_IS_NOT_PROCUREMENT_CLASSIFICATION',
      classification,
      naturalPersonStatus: true,
      serviceTermHits: Object.freeze(serviceHits),
      otherProcurementHits: Object.freeze(otherHits),
      decisionLock,
      reason,
      nextAction,
      authorityCheck
    });
  }

  window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE = Object.freeze({ classify, authority: V727 });
  if (typeof module !== 'undefined' && module.exports) module.exports = window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE;
})();