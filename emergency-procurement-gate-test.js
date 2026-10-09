'use strict';
const gate = require('./emergency-procurement-gate.js');

function assert(ok, msg){ if(!ok) throw new Error(msg); }

const flood79 = gate.evaluate({
  query:'จัดทำถุงยังชีพกรณีน้ำท่วม',
  facts:'เกิดเหตุอุทกภัยฉับพลัน ต้องจัดหาโดยเร่งด่วน',
  amount:300000
});
assert(flood79.triggered,'flood trigger');
assert(flood79.candidateRoute==='M56_2_B__CHECK_REGULATION_79','route 56(2)(ข)');
assert(flood79.decisionLock===true,'decision lock');

const floodEmergency = gate.evaluate({
  query:'จัดซื้อเครื่องสูบน้ำเพื่อระบายน้ำจากอุทกภัย',
  facts:'หากใช้ขั้นตอนปกติอาจล่าช้าและเกิดความเสียหายร้ายแรง',
  amount:1200000
});
assert(floodEmergency.candidateRoute==='M56_2_D__CHECK_REGULATION_78','route 56(2)(ง)');
assert(floodEmergency.decisionLock===true,'emergency decision lock');
assert(gate.promptPolicy(floodEmergency).includes('น้ำท่วม/ภัยธรรมชาติไม่ใช่คำตอบของวิธีจัดซื้อโดยอัตโนมัติ'),'policy guard');

const ordinary = gate.evaluate({query:'จัดซื้อคอมพิวเตอร์สำนักงาน',amount:300000});
assert(ordinary.triggered===false,'ordinary not triggered');
assert(ordinary.candidateRoute==='UNDETERMINED','ordinary undetermined');

console.log('EMERGENCY PROCUREMENT GATE PASS');
