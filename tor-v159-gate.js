(() => {
  'use strict';

  const AUTHORITY = 'ด่วนที่สุด ที่ กค (กวจ) 0405.4/ว 159 ลงวันที่ 20 มีนาคม 2566';
  const TOR_FIELDS = Object.freeze([
    'ความเป็นมา','วัตถุประสงค์','คุณสมบัติของผู้ยื่นข้อเสนอ',
    'ขอบเขตของงาน/รายละเอียดคุณลักษณะเฉพาะ/แบบรูปรายการงานก่อสร้าง และเอกสารแนบท้าย (แล้วแต่กรณี)',
    'กำหนดเวลาส่งมอบพัสดุ','หลักเกณฑ์ในการพิจารณาคัดเลือกข้อเสนอ',
    'วงเงินงบประมาณ/วงเงินที่ได้รับจัดสรร','งวดงานและการจ่ายเงิน','อัตราค่าปรับ',
    'ระยะเวลารับประกันความชำรุดบกพร่อง (ถ้ามี)'
  ]);

  function policyBlock() {
    return [
      '',
      '=== TOR GOVERNANCE GATE — ว 159 ===',
      'ฐานแนวทาง: ' + AUTHORITY,
      'แนวทางที่ใช้: ผู้รับผิดชอบสามารถใช้ดุลพินิจเลือกแนวทางจัดทำ TOR ตามลักษณะงาน; หากจัดทำ TOR อย่างละเอียด ให้ตรวจสาระสำคัญขั้นต่ำ 10 รายการ',
      'สาระสำคัญขั้นต่ำตามแนวทางที่ 2:',
      ...TOR_FIELDS.map(function(x,i){ return (i + 1) + '. ' + x; }),
      '',
      'PRICE SEPARATION GATE:',
      '- TOR_REQUIRED: วงเงินงบประมาณ/วงเงินที่ได้รับจัดสรร',
      '- PRICE_REFERENCE: ราคากลางเป็นกระบวนการ/เอกสารที่ต้องกำหนดและตรวจสอบตามหลักเกณฑ์ราคากลางที่เกี่ยวข้อง',
      '- DO_NOT_SUBSTITUTE: ห้ามใช้ “ราคากลาง” แทนหัวข้อ “วงเงินงบประมาณ/วงเงินที่ได้รับจัดสรร” ใน TOR',
      '- DO_NOT_MIX: ห้ามนำราคากลางมาใส่ใน TOR โดยอัตโนมัติเพียงเพราะเป็นองค์ประกอบของกระบวนการจัดซื้อจัดจ้าง',
      '',
      'TOR QUALITY RULES:',
      '- ขอบเขตงานต้องชัดเจน สอดคล้องวัตถุประสงค์ และสามารถนำไปใช้เป็นฐานตรวจรับได้',
      '- หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอต้องสอดคล้องกับวิธีจัดซื้อจัดจ้างและลักษณะงาน',
      '- ถ้าเป็นงานที่ต้องมีการรับประกัน ให้ระบุระยะเวลารับประกัน; ถ้าไม่เกี่ยวข้องให้ระบุว่าไม่กำหนด/ไม่ใช้บังคับ พร้อมเหตุผล',
      '- ห้ามแต่งวงเงิน ราคากลาง อัตราค่าปรับ หรือระยะเวลารับประกัน หากผู้ใช้ยังไม่ได้ให้ข้อมูลหรือไม่มีฐานที่ตรวจสอบได้',
      '- แยกวงเงินงบประมาณ/วงเงินที่ได้รับจัดสรร ออกจาก ราคากลาง และ ราคาที่เสนอ/ราคาตามสัญญา ทุกครั้ง',
      '',
      'PRE-USE CHECK:',
      'ตรวจ 10 หัวข้อ → ตรวจความสอดคล้อง TOR/สัญญา/ผลส่งมอบ/ตรวจรับ → ตรวจฐานราคากลางแยกต่างหาก → Human Approval ก่อนใช้จริง'
    ].join('\n');
  }

  function wrap(engine) {
    if (!engine || engine.__V159_WRAPPED__) return;
    const originalBuild = engine.build;
    const originalFree = engine.buildFromFreeText;
    if (typeof originalBuild === 'function') {
      engine.build = function(input) { return String(originalBuild.call(this, input)) + policyBlock(); };
    }
    if (typeof originalFree === 'function') {
      engine.buildFromFreeText = function(query, options) { return String(originalFree.call(this, query, options)) + policyBlock(); };
    }
    Object.defineProperty(engine, '__V159_WRAPPED__', {value:true, enumerable:false});
  }

  wrap(window.GOVPROMPT_SERVICE_TOR_ENGINE);
  window.GOVPROMPT_TOR_V159_GATE = Object.freeze({authority:AUTHORITY,fields:TOR_FIELDS,policy:policyBlock});
})();