import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPORT_ROW_STATUS,
  buildProjectImportPreview,
} from '../src/work-tracking/import-preview.mjs';

test('builds row-level preview with source CSV row numbers', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,กำหนดเสร็จ,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,2026-12-31,กำลังดำเนินการ',
    'PJ-2,โครงการ B,กองช่าง,นาย ข,500000,2026-11-30,กำลังดำเนินการ',
  ].join('\n');

  const preview = buildProjectImportPreview(csv, 'ORG-PILOT');
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].row, 2);
  assert.equal(preview.rows[1].row, 3);
  assert.equal(preview.canCommit, true);
});

test('blocks commit when a parsed project has data-quality error', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,ผลจริง,กำหนดเสร็จ,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,80,2026-12-31,เสร็จสิ้น',
  ].join('\n');

  const preview = buildProjectImportPreview(csv, 'ORG-PILOT');
  assert.equal(preview.rows[0].status, IMPORT_ROW_STATUS.ERROR);
  assert.equal(preview.canCommit, false);
  assert.ok(preview.rows[0].issues.some((item) => item.code === 'COMPLETED_PROGRESS_MISMATCH'));
});

test('warnings allow commit but require explicit warning confirmation', () => {
  const csv = [
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,เบิกจ่าย,กำหนดเสร็จ,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,1200000,2026-12-31,กำลังดำเนินการ',
  ].join('\n');

  const preview = buildProjectImportPreview(csv, 'ORG-PILOT');
  assert.equal(preview.rows[0].status, IMPORT_ROW_STATUS.WARNING);
  assert.equal(preview.canCommit, true);
  assert.equal(preview.requiresWarningConfirmation, true);
});

test('parser errors stay tied to the original CSV row and block commit', () => {
  const csv = [
    'ชื่อโครงการ,งบประมาณ',
    ',1000',
    'โครงการถูกต้อง,2000',
  ].join('\n');

  const preview = buildProjectImportPreview(csv, 'ORG-PILOT');
  const invalid = preview.rows.find((item) => item.row === 2);
  assert.equal(invalid.status, IMPORT_ROW_STATUS.ERROR);
  assert.equal(preview.canCommit, false);
});
