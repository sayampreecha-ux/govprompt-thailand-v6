// Disaster Spending Gate Regression Test — M.T. 0808.2/W 980 (5 Feb 2026)
'use strict';

global.window = {};
const gate = require('./disaster-spending-gate.js');

const cases = [
  {
    name: 'General disaster guidance',
    input: { query: 'แนวทางช่วยเหลือประชาชนกรณีน้ำท่วมตาม ว 980' },
    locked: false
  },
  {
    name: 'Emergency savings decision with facts',
    input: { query: 'เทศบาลเกิดน้ำท่วมฉุกเฉิน ต้องช่วยประชาชนทันที เงินสำรองจ่ายไม่พอ และไม่มีงบที่สามารถโอนได้ สามารถจ่ายขาดเงินสะสมตามข้อ 100 ได้หรือไม่' },
    locked: false
  },
  {
    name: 'Savings decision missing emergency fact',
    input: { query: 'เทศบาลมีเงินสะสม จะใช้ข้อ 100 จ่ายช่วยเหลือประชาชนได้ไหม' },
    locked: true
  },
  {
    name: 'Rate question stays separate',
    input: { query: 'น้ำท่วม จะซื้อถุงยังชีพช่วยประชาชนได้กี่บาทตาม ว 980' },
    locked: false
  },
  {
    name: 'No automatic rule from exhausted reserve',
    input: { query: 'เงินสำรองจ่ายหมด ใช้เงินสะสมข้อ 100 ได้เลยไหมกรณีน้ำท่วม' },
    locked: true
  }
];

for (const c of cases) {
  const result = gate.evaluate(c.input);
  if (result.decisionLock !== c.locked) {
    throw new Error(c.name + ': decisionLock=' + result.decisionLock + ', expected=' + c.locked);
  }
}

const policy = gate.policy(cases[1].input);
for (const required of [
  'มท 0808.2/ว 980 ลงวันที่ 5 กุมภาพันธ์ 2569',
  'เงินสำรองจ่าย',
  'โอนงบประมาณ',
  'ข้อ 100',
  'ไม่ hard-code'
]) {
  if (!policy.includes(required)) throw new Error('missing policy text: ' + required);
}

console.log('DISASTER SPENDING GATE REGRESSION PASS');
console.log('Cases passed: ' + cases.length + '/' + cases.length);
