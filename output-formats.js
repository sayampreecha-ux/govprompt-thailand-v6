(() => {
  'use strict';

  const FORMATS = Object.freeze([
    Object.freeze({
      id: 'easy-summary',
      label: 'สรุปเนื้อหาเข้าใจง่าย',
      icon: '🧾',
      description: 'คัดเฉพาะสาระสำคัญ เรียงจากภาพรวมไปสู่รายละเอียด',
      structure: Object.freeze(['พาดหัวหลัก', 'สาระสำคัญ 3–5 ประเด็น', 'สิ่งที่ต้องดำเนินการ', 'แหล่งอ้างอิง/วันที่ข้อมูล'])
    }),
    Object.freeze({
      id: 'step-by-step',
      label: 'ขั้นตอน Step-by-Step',
      icon: '🔢',
      description: 'แปลงกระบวนการเป็นลำดับ 1–6 ขั้นที่ทำตามได้',
      structure: Object.freeze(['ชื่อกระบวนการ', 'ขั้นตอน 1–6', 'ผู้รับผิดชอบหรือผลลัพธ์แต่ละขั้น', 'จุดตรวจสอบก่อนจบ'])
    }),
    Object.freeze({
      id: 'timeline',
      label: 'Timeline ลำดับเวลา',
      icon: '🗓️',
      description: 'เรียงเหตุการณ์ วัน เวลา หรือหมุดหมายสำคัญ',
      structure: Object.freeze(['จุดเริ่มต้น', 'เหตุการณ์ตามลำดับเวลา', 'สถานะปัจจุบัน', 'กำหนดการถัดไป'])
    }),
    Object.freeze({
      id: 'comparison',
      label: 'เปรียบเทียบ A–B',
      icon: '⚖️',
      description: 'เปรียบเทียบสองทางเลือกด้วยเกณฑ์เดียวกัน',
      structure: Object.freeze(['เกณฑ์เปรียบเทียบ', 'ทางเลือก A', 'ทางเลือก B', 'ข้อจำกัด', 'ข้อสรุปแบบมีเงื่อนไข'])
    }),
    Object.freeze({
      id: 'workflow',
      label: 'Workflow กระบวนงาน',
      icon: '🔄',
      description: 'แสดง Input → Process → Decision → Action → Output',
      structure: Object.freeze(['ข้อมูลนำเข้า', 'กระบวนการ', 'จุดตัดสินใจ', 'การดำเนินการ', 'ผลลัพธ์'])
    }),
    Object.freeze({
      id: 'checklist',
      label: 'Checklist ตรวจงาน',
      icon: '✅',
      description: 'ทำรายการตรวจ 8–10 ข้อที่นำไปใช้หน้างานได้',
      structure: Object.freeze(['รายการตรวจ', 'หลักฐานที่ต้องมี', 'ผู้ตรวจ/ช่วงเวลาตรวจ', 'ผลผ่าน–ไม่ผ่าน'])
    }),
    Object.freeze({
      id: 'do-dont',
      label: 'ควรทำ / ไม่ควรทำ',
      icon: '🚦',
      description: 'แบ่งแนวปฏิบัติเป็นสองฝั่งอย่างละไม่เกิน 5 ข้อ',
      structure: Object.freeze(['ควรทำ 3–5 ข้อ', 'ไม่ควรทำ 3–5 ข้อ', 'เหตุผลสั้น', 'ตัวอย่างที่ไม่เปิดเผยข้อมูลส่วนบุคคล'])
    }),
    Object.freeze({
      id: 'framework',
      label: 'Framework กรอบความคิด',
      icon: '🧩',
      description: 'จัดกลุ่มแนวคิดหลักเป็น 4–6 หมวดและอธิบายความเชื่อมโยง',
      structure: Object.freeze(['หัวข้อหลัก', 'หมวดแนวคิด 4–6 หมวด', 'ความสัมพันธ์ระหว่างหมวด', 'แนวทางนำไปใช้'])
    }),
    Object.freeze({
      id: 'key-insights',
      label: 'ตัวเลขและ Key Insights',
      icon: '📊',
      description: 'เลือกตัวเลขจริง 5–8 ค่า พร้อมความหมายและข้อสังเกต',
      structure: Object.freeze(['ตัวเลขสำคัญ', 'หน่วย/ช่วงเวลา', 'ความหมายของแต่ละค่า', 'Insight ที่มีหลักฐานรองรับ'])
    }),
    Object.freeze({
      id: 'quick-guide',
      label: 'คู่มือฉบับย่อ',
      icon: '📘',
      description: 'สรุปสิ่งนี้คืออะไร ใช้ทำอะไร วิธีใช้ ข้อควรระวัง และเคล็ดลับ',
      structure: Object.freeze(['สิ่งนี้คืออะไร', 'ใช้ทำอะไร', 'วิธีใช้งาน', 'สิ่งที่ควรระวัง', 'Tips สำหรับใช้จริง'])
    })
  ]);

  const BY_ID = new Map(FORMATS.map(format => [format.id, format]));
  const SAFE_DEFAULT = 'easy-summary';

  function resolve(id) {
    return BY_ID.get(String(id || '')) || BY_ID.get(SAFE_DEFAULT);
  }

  function buildPromptBlock(id) {
    const format = resolve(id);
    const sections = format.structure.map((item, index) => `${index + 1}. ${item}`).join('\n');
    return `รูปแบบการนำเสนอ: ${format.label}\nเป้าหมาย: ${format.description}\n\nโครงสร้างที่ต้องมี\n${sections}\n\nข้อกำกับสำหรับงานราชการและอินโฟกราฟิก\n- ใช้เฉพาะข้อเท็จจริง ตัวเลข วันที่ และชื่อหน่วยงานที่พบในข้อมูลต้นทาง\n- หากข้อมูลใดไม่มีหรือยืนยันไม่ได้ ให้ระบุ [ต้องตรวจสอบ/เพิ่มเติม] และห้ามแต่งเติม\n- ข้อความต้องสั้น อ่านง่ายบนโทรศัพท์ และจัดลำดับจากสาระสำคัญที่สุด\n- งานกฎหมาย/พัสดุต้องระบุชื่อแหล่งอ้างอิง ฉบับ และวันที่ตรวจสอบข้อมูล\n- ปกปิดข้อมูลส่วนบุคคลหรือข้อมูลสุขภาพที่ไม่จำเป็น\n- ส่งมอบทั้ง (1) ข้อความพร้อมจัดวาง และ (2) คำแนะนำโครงสร้างภาพ โดยไม่สร้างตราสัญลักษณ์หรือคำรับรองที่ไม่มีต้นฉบับ`;
  }

  function suggestForTool(tool) {
    const id = String(tool?.id || '');
    const category = String(tool?.category || '');
    if (id === 'GP004') return 'timeline';
    if (['GP009', 'GP010', 'GP011', 'GP012'].includes(id)) return 'checklist';
    if (id === 'GP015' || id === 'GP019') return 'key-insights';
    if (id === 'GP018') return 'quick-guide';
    if (category === 'กฎหมาย') return 'comparison';
    return SAFE_DEFAULT;
  }

  window.GOVPROMPT_OUTPUT_FORMATS = Object.freeze({
    formats: FORMATS,
    defaultId: SAFE_DEFAULT,
    resolve,
    buildPromptBlock,
    suggestForTool
  });
})();
