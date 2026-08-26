import test from 'node:test';
import assert from 'node:assert/strict';

import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import { importProjectsFromCsv } from '../src/work-tracking/csv-import.mjs';

test('imports Thai construction columns and injects organization boundary', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,กอง,เลขที่สัญญา,ผู้รับจ้าง,งบประมาณ,เบิกจ่าย,แผน,ผลจริง,กำหนดเสร็จ,สถานะ',
    'PJ-001,"ปรับปรุงถนน, สาย A",กองช่าง,สญ.1/2569,บริษัทตัวอย่าง,4,500,000,1000000,80,52,2026-09-30,กำลังดำเนินการ',
  ].join('\n');

  // งบประมาณที่มี comma ต้อง quote ใน CSV จึงทดสอบข้อมูลมาตรฐานแยกอีกเคสด้านล่าง
  const fixed = csv.replace('4,500,000', '"4,500,000"');
  const result = importProjectsFromCsv(fixed, 'ORG-PILOT');

  assert.equal(result.errors.length, 0);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].organizationId, 'ORG-PILOT');
  assert.equal(result.projects[0].name, 'ปรับปรุงถนน, สาย A');
  assert.equal(result.projects[0].budget, 4500000);
  assert.equal(result.projects[0].status, WORK_STATUS.IN_PROGRESS);
});

test('CSV organization id from user file cannot override caller organization', () => {
  const csv = [
    'ชื่อโครงการ,organizationId,งบประมาณ',
    'โครงการทดสอบ,ORG-OTHER,1000',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects[0].organizationId, 'ORG-PILOT');
});

test('reports missing project name without importing an invalid row', () => {
  const csv = [
    'ชื่อโครงการ,งบประมาณ',
    ',1000',
    'โครงการถูกต้อง,2000',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].row, 2);
});

test('requires organization id before import', () => {
  const result = importProjectsFromCsv('ชื่อโครงการ\nโครงการ A', '');
  assert.equal(result.projects.length, 0);
  assert.match(result.errors[0].message, /organizationId/);
});

test('rejects malformed numeric values instead of silently turning them into zero', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,งบประมาณ,เบิกจ่าย',
    'PJ-BAD-NUM,โครงการตัวเลขผิด,abc,12x',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /งบประมาณไม่ใช่ตัวเลข/);
  assert.match(result.errors[0].message, /เบิกจ่ายไม่ใช่ตัวเลข/);
});

test('rejects negative amounts and progress outside 0 to 100 before normalization can clamp them', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,งบประมาณ,แผน,ผลจริง',
    'PJ-BAD-RANGE,โครงการช่วงค่าผิด,-1,101,-5',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /งบประมาณต้องไม่น้อยกว่า 0/);
  assert.match(result.errors[0].message, /แผนความก้าวหน้าต้องไม่เกิน 100/);
  assert.match(result.errors[0].message, /ความก้าวหน้าจริงต้องไม่น้อยกว่า 0/);
});

test('rejects unknown non-empty status instead of silently mapping it to NOT_STARTED', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,สถานะ',
    'PJ-BAD-STATUS,โครงการสถานะผิด,กำลังทำอยู่',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /สถานะไม่อยู่ในค่าที่รองรับ/);
});

test('normalizes common Thai Buddhist calendar date into ISO date', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,วันเริ่ม,กำหนดเสร็จ',
    'PJ-TH-DATE,โครงการวันที่ไทย,1/9/2569,31/12/2569',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.errors.length, 0);
  assert.equal(result.projects[0].startDate, '2026-09-01');
  assert.equal(result.projects[0].dueDate, '2026-12-31');
});

test('rejects impossible or ambiguous dates at the source row', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,วันเริ่ม,กำหนดเสร็จ',
    'PJ-BAD-DATE,โครงการวันที่ผิด,31/02/2569,09-30-2026',
  ].join('\n');

  const result = importProjectsFromCsv(csv, 'ORG-PILOT');
  assert.equal(result.projects.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /วันเริ่มไม่ใช่วันที่จริง/);
  assert.match(result.errors[0].message, /กำหนดเสร็จต้องเป็น YYYY-MM-DD/);
});
