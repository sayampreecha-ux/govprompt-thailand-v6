import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('quality-gate.js', 'utf8');

function gate() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_QUALITY_GATE;
}

test('asks at most three high-impact questions before prompt generation', () => {
  const tool = {
    id: 'GP014', category: 'โครงการ',
    fields: ['หน่วยงาน', 'ชื่อโครงการ', 'ปัญหา', 'กลุ่มเป้าหมาย', 'ระยะเวลา', 'งบประมาณ']
  };
  const result = gate().assessIntake(tool, { หน่วยงาน: 'อบจ.ตัวอย่าง', ชื่อโครงการ: 'NCD' });
  assert.equal(result.status, 'NEEDS_INFO');
  assert.deepEqual(JSON.parse(JSON.stringify(result.missingFields)), ['ปัญหา', 'กลุ่มเป้าหมาย', 'งบประมาณ']);
  assert.equal(result.questions.length, 3);
});

test('allows prompt generation when priority information is supplied', () => {
  const tool = {
    id: 'GP005', category: 'กฎหมาย',
    fields: ['หน่วยงาน', 'เรื่อง', 'ข้อเท็จจริง', 'ข้อหารือ', 'เอกสารหรือกฎหมายที่มี']
  };
  const result = gate().assessIntake(tool, {
    หน่วยงาน: 'อบจ.ตัวอย่าง', เรื่อง: 'อำนาจหน้าที่', ข้อเท็จจริง: 'มีข้อเท็จจริงแล้ว', ข้อหารือ: 'ทำได้หรือไม่'
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.ready, true);
});

test('procurement intake asks for facts that materially affect the answer', () => {
  const tool = {
    id: 'GP009', category: 'พัสดุ',
    fields: ['รายการพัสดุ', 'ความต้องการใช้งาน', 'ข้อความ TOR', 'วงเงิน', 'จุดกังวล']
  };
  const result = gate().assessIntake(tool, { รายการพัสดุ: 'รถขุด', ความต้องการใช้งาน: 'งานป้องกันภัย' });
  assert.deepEqual(JSON.parse(JSON.stringify(result.missingFields)), ['ข้อความ TOR', 'วงเงิน']);
});

test('intake logic is memory-only and has no network or persistence primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
