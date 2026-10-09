import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const gateSource=readFileSync('procurement-classification-gate.js','utf8');
const engineSource=readFileSync('service-contract-natural-person.js','utf8');
function build(q){const context={window:{}};vm.createContext(context);vm.runInContext(gateSource,context);vm.runInContext(engineSource,context);return context.window.GOVPROMPT_SERVICE_TOR_ENGINE.buildFromFreeText(q);}

test('GP223 2569 authority pack is present',()=>{
 const r=build('ร่าง TOR จ้างเหมาบริการบุคคลธรรมดา');
 for(const x of ['ว 727','ว 159','ว 714','ว 681','แบบสัญญา','Decision Lock']) assert.match(r,new RegExp(x));
});
test('e-GP is never blanket-exempted',()=>{
 const r=build('จ้างเหมาบริการบุคคลธรรมดา วงเงิน 108000 บาท ไม่ต้องลง e-GP ใช่ไหม');
 assert.match(r,/ตรวจ e-GP เป็นรายกรณี/); assert.match(r,/ห้ามเหมารวม/); assert.match(r,/วิธีจัดจ้าง\/วงเงิน\/ข้อยกเว้น\/วันที่/);
});
test('employment-like fixed-time language is flagged',()=>{
 const r=build('จ้างธุรการ ทำงานจันทร์-ศุกร์ เวลาราชการ 08.30-16.30 ลงเวลา และทำตามคำสั่งผู้บังคับบัญชา');
 assert.match(r,/Employment-like Risk signals ที่พบจากข้อความงาน: [1-9]/);
});
test('authority boundary remains enforced',()=>{
 const r=build('จ้างบุคคลธรรมดาอนุมัติเบิกจ่ายและรับรองเอกสารแทนเจ้าหน้าที่');
 assert.match(r,/Authority Boundary/); assert.match(r,/ห้ามมอบอำนาจรัฐ/);
});
test('partial delivery cannot be auto-paid in full',()=>{
 const r=build('TOR กำหนด 300 รายต่อเดือน ทำได้ 220 ราย ขอเบิกเต็มเดือน');
 assert.match(r,/220\/300/); assert.match(r,/ห้ามรับรองเต็มโดยอัตโนมัติ/); assert.match(r,/Acceptance Criteria/);
});
test('attendance alone is not acceptance',()=>{
 const r=build('ผู้รับจ้างขาด 3 วัน แต่ส่งผลงานครบ');
 assert.match(r,/ห้ามใช้การลงเวลา\/การมาปฏิบัติงานเพียงอย่างเดียวเป็นหลักตรวจรับ/);
});
test('generic command scope is treated as risk not a deliverable',()=>{
 const r=build('ให้ผู้รับจ้างปฏิบัติงานตามที่ผู้บังคับบัญชามอบหมายทุกอย่าง');
 assert.match(r,/Employment-like Risk/); assert.match(r,/ผลส่งมอบ/);
});
test('penalty and security use current contract gate',()=>{
 const r=build('กำหนดค่าปรับรายวันและหลักประกันในสัญญาจ้างเหมาบุคคลธรรมดา');
 assert.match(r,/PENALTY_SECURITY_RULE/); assert.match(r,/ว 727/); assert.match(r,/แบบสัญญาฉบับปัจจุบัน/);
});
test('inspection timeline authority is explicit',()=>{
 const r=build('ตรวจรับงานจ้างเหมาบริการบุคคลธรรมดา');
 assert.match(r,/INSPECTION_TIMELINE_AUTHORITY: กค \(กวจ\) 0405\.4\/ว 681/);
});
test('missing decisive facts stay locked rather than invented',()=>{
 const r=build('ร่าง TOR จ้างเหมาบริการบุคคลธรรมดา');
 assert.match(r,/\[ยังไม่ได้ระบุ\]/); assert.match(r,/Decision Lock/); assert.match(r,/ห้ามแต่งข้อเท็จจริง/);
});
