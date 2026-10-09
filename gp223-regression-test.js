// GP223 Regression Test — natural-person service TOR
// Run: node gp223-regression-test.js
'use strict';

global.window = {};
require('./procurement-classification-gate.js');
require('./service-contract-natural-person.js');

const gate = window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE;
const engine = window.GOVPROMPT_SERVICE_TOR_ENGINE;
const cases = [
  ['คนขับรถ','จ้างเหมาบริการบุคคลธรรมดา คนขับรถ จัดทำบันทึกการใช้รถและส่งมอบรายงาน','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ธุรการ','จัดทำเอกสารและข้อมูลธุรการ พร้อมส่งมอบชุดเอกสารรายเดือน','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ขับเครื่องจักรหนัก','ขับเครื่องจักรขนาดหนักและส่งมอบรายงานผลการปฏิบัติงาน','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['มาตรวัดน้ำ','สำรวจและจัดทำข้อมูลตรวจมาตรวัดน้ำประปา พร้อมบัญชีผลตรวจ','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['รักษาความปลอดภัย','จ้างเหมาบริการรักษาความปลอดภัยและส่งมอบรายงานเหตุการณ์','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['จัดเก็บรายได้','จัดทำและรวบรวมข้อมูลสนับสนุนงานจัดเก็บรายได้ โดยไม่รับเงินหรือใช้อำนาจแทนเจ้าหน้าที่','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ธุรการการเงิน','จัดทำข้อมูลและเอกสารการเงินและการเบิกจ่าย พร้อมส่งมอบชุดเอกสาร','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['นิติการ','ช่วยจัดเตรียมข้อมูลและเอกสารด้านนิติการและรับเรื่องร้องทุกข์ โดยไม่วินิจฉัยหรือสั่งการ','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ป้องกันภัย','สนับสนุนการจัดทำข้อมูลและเอกสารด้านป้องกันและบรรเทาสาธารณภัย','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ระบบประปา','ดูแลข้อมูลและจัดทำรายงานการตรวจสอบระบบประปา','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['นักการภารโรง','งานดูแลสถานที่และส่งมอบผลการดูแลพื้นที่','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['การศึกษา','ปฏิบัติงานสอนและสนับสนุนการจัดการศึกษา พร้อมส่งมอบผลการดำเนินงาน','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['ทำความสะอาด','จ้างเหมาบริการทำความสะอาดพื้นที่และส่งมอบรายงานผล','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['สาธารณสุข','จัดทำข้อมูลสนับสนุนงานสาธารณสุขและรายงานผลการดำเนินงาน','NATURAL_PERSON_SERVICE_CANDIDATE'],
  ['บัญชี/การเงิน','สนับสนุนการจัดทำทะเบียนและข้อมูลด้านบัญชีและรายงานทางการเงิน','NATURAL_PERSON_SERVICE_CANDIDATE']
];

let passed = 0;
for (const [name, job, expected] of cases) {
  const input = {'ลักษณะงานที่ต้องการจ้าง': job, 'ผลผลิต/งานที่ต้องส่งมอบ':'รายงาน/ชุดเอกสาร/ข้อมูลที่ตรวจสอบได้'};
  const result = gate.classify(input);
  if (result.classification !== expected) throw new Error(name + ': classification=' + result.classification);
  const output = engine.build(input);
  for (const required of ['ว 727','Employment-like Risk','Deliverable Gate','Authority Boundary','TOR ↔ สัญญา ↔ ผลส่งมอบ ↔ ตรวจรับ ↔ จ่ายเงิน']) {
    if (!output.includes(required)) throw new Error(name + ': missing ' + required);
  }
  passed++;
}

const legacyInput = {'ลักษณะงานที่ต้องการจ้าง':'งานธุรการด้านการเงิน', 'ผลผลิต/งานที่ต้องส่งมอบ':'ชุดเอกสารและรายงาน'};
const legacyOutput = engine.build(legacyInput);
if (!legacyOutput.includes('CURRENT_AUTHORITY_BASELINE: กค (กวจ) 0405.2/ว 727')) throw new Error('current authority baseline missing');
if (!legacyOutput.includes('LEGACY_TO_VERIFY:')) throw new Error('legacy citation gate missing');
if (legacyOutput.includes('CURRENT_AUTHORITY_BASELINE: กค (กวจ) 0405.2/ว 877')) throw new Error('legacy authority incorrectly promoted');

const freeText = engine.buildFromFreeText('ร่าง TOR จ้างเหมาบริการบุคคลธรรมดาเพื่อช่วยเสริมการปฏิบัติงานด้านข้อมูลและเอกสารการเงินและการเบิกจ่าย');
if (!freeText.includes('GP223 AUTO-EXECUTION MODE')) throw new Error('free-text auto execution missing');
if (!freeText.includes('ไม่เปิดแบบฟอร์ม')) throw new Error('conversation-first rule missing');

console.log('GP223 REGRESSION PASS');
console.log('Cases passed: ' + passed + '/' + cases.length);
console.log('Current authority baseline: ว 727');
console.log('Conversation-first / free-text execution: PASS');
