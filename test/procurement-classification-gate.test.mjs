import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('procurement-classification-gate.js','utf8');

function gate(){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(source,context);
  return context.window.GOVPROMPT_PROCUREMENT_CLASSIFICATION_GATE;
}

test('does not classify every natural-person contract as V727',()=>{
  const r=gate().classify({'ลักษณะงานที่ต้องการจ้าง':'ซ่อมรถเทศบาล','ผลผลิต/งานที่ต้องส่งมอบ':'รถที่ซ่อมเสร็จพร้อมใช้งาน'});
  assert.equal(r.classification,'OTHER_PROCUREMENT_SERVICE');
  assert.equal(r.decisionLock,false);
});

test('classifies data/document support as a V727 candidate, not an automatic final decision',()=>{
  const r=gate().classify({'ลักษณะงานที่ต้องการจ้าง':'ช่วยบันทึกข้อมูลและจัดทำเอกสาร','ผลผลิต/งานที่ต้องส่งมอบ':'ชุดข้อมูลและเอกสารตามรายการส่งมอบรายเดือน'});
  assert.equal(r.classification,'NATURAL_PERSON_SERVICE_CANDIDATE');
  assert.equal(r.decisionLock,false);
  assert.match(r.authority,/ว 727/);
});

test('locks mixed or conflicting work instead of guessing',()=>{
  const r=gate().classify({'ลักษณะงานที่ต้องการจ้าง':'ช่วยงานธุรการและซ่อมรถ','ผลผลิต/งานที่ต้องส่งมอบ':'เอกสารและรถที่ซ่อมเสร็จ'});
  assert.equal(r.classification,'MIXED_OR_CONFLICT');
  assert.equal(r.decisionLock,true);
});

test('locks when the procurement object is not sufficiently described',()=>{
  const r=gate().classify({});
  assert.equal(r.classification,'UNDETERMINED');
  assert.equal(r.decisionLock,true);
});
