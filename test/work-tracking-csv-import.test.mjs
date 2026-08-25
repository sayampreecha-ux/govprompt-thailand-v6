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
