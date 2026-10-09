import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const qualitySource=readFileSync('quality-gate.js','utf8');
const contextSource=readFileSync('shared-context.js','utf8');

function quality(){const c={window:{}};vm.createContext(c);vm.runInContext(qualitySource,c);return c.window.GOVPROMPT_QUALITY_GATE;}
function contextApi(){const c={window:{}};vm.createContext(c);vm.runInContext(contextSource,c);return c.window.GOVPROMPT_CONTEXT;}

const complete={
  required:true,
  eventClassificationChecked:true,
  rightContinuityChecked:true,
  multipleLegalBasisChecked:true,
  timelineChecked:true,
  continuityOverrideChecked:true,
  finalCounterCheckCompleted:true,
  unresolvedContinuityIssues:[]
};

test('Event & Right Continuity Gate passes only after all continuity checks are complete',()=>{
  const api=quality();
  const result=api.eventContinuityCheck(complete);
  assert.equal(result.pass,true);
  assert.equal(result.status,'PASS');
});

test('different labels for appointment/transfer events do not bypass event classification',()=>{
  const api=quality();
  for(const label of ['โอนย้าย','สอบคัดเลือกแล้วแต่งตั้ง','บรรจุใหม่','เลื่อนระดับ','กลับเข้ารับราชการ']){
    const result=api.eventContinuityCheck({...complete,eventClassificationChecked:false,unresolvedContinuityIssues:[`ต้องจำแนกผลทางกฎหมายของ ${label}`]});
    assert.equal(result.pass,false);
    assert.ok(result.blockers.includes('event-classification-not-checked'));
    assert.ok(result.blockers.includes('continuity-issue-unresolved'));
  }
});

test('old right continuity must be checked before deciding only on a new right',()=>{
  const api=quality();
  const result=api.eventContinuityCheck({...complete,rightContinuityChecked:false});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('right-continuity-not-checked'));
});

test('multiple benefits cannot borrow conditions from another legal basis without a check',()=>{
  const api=quality();
  const result=api.eventContinuityCheck({...complete,multipleLegalBasisChecked:false});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('multiple-legal-basis-not-checked'));
});

test('mid-month change requires timeline and duplicate-payment review before day calculation',()=>{
  const api=quality();
  const result=api.eventContinuityCheck({...complete,timelineChecked:false,unresolvedContinuityIssues:['ยังไม่ตรวจวันคำสั่งมีผล/วันรายงานตัว/ช่วงสิทธิเดิมและใหม่']});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('timeline-not-checked'));
  assert.ok(result.blockers.includes('continuity-issue-unresolved'));
});

test('general rule cannot end review before continuity override check',()=>{
  const api=quality();
  const result=api.eventContinuityCheck({...complete,continuityOverrideChecked:false});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('continuity-override-not-checked'));
});

test('final counter-check is mandatory for continuity cases',()=>{
  const api=quality();
  const result=api.eventContinuityCheck({...complete,finalCounterCheckCompleted:false});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('continuity-final-counter-check-not-completed'));
});

test('shared context activates continuity review from legal effect events, not one housing phrase',()=>{
  const api=contextApi();
  api.selectTool({id:'GP005',category:'กฎหมาย',name:'วิเคราะห์ข้อกฎหมาย อปท.'});
  api.setRouting({score:.9,confidence:.9,matchedReason:'test',fallback:false},'สิทธิหลังได้รับแต่งตั้งต่างท้องที่');
  api.setUserInputs({ข้อเท็จจริง:'เดิมมีสิทธิอยู่ ต่อมาได้รับแต่งตั้งให้ไปรับราชการต่างท้องที่และรายงานตัวกลางเดือน'});
  const state=api.get();
  assert.equal(state.eventContinuity.required,true);
  assert.ok(state.riskFlags.includes('event-continuity-required'));
});

test('timeline regression does not pre-decide 20 + 10 days or any fixed split',()=>{
  const policy=quality().reasoningPolicy('การเงินและเบิกจ่าย');
  assert.match(policy,/วันที่คำสั่งมีผล/);
  assert.match(policy,/วันที่รายงานตัว/);
  assert.doesNotMatch(policy,/20\s*วัน\s*\+\s*10\s*วัน/);
});

test('continuity policy is generic across personnel, travel, salary and benefit cases',()=>{
  const policy=quality().reasoningPolicy('บุคคล');
  assert.match(policy,/สิทธิเดิม/);
  assert.match(policy,/หลายสิทธิหรือหลายฐานกฎหมาย/);
  assert.match(policy,/ห้ามยึดชื่อที่ผู้ใช้เรียก/);
});
