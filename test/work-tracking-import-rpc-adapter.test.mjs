import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectImportPreview } from '../src/work-tracking/import-preview.mjs';
import {
  buildCommitProjectImportRpc,
  countIgnoredImportUpdateTimestamps,
  countUnresolvedImportOwners,
  findImportDepartmentMismatches,
} from '../src/work-tracking/import-rpc-adapter.mjs';

const csv = [
  'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,เบิกจ่าย,แผน,ผลจริง,กำหนดเสร็จ,สถานะ',
  'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,200000,50,40,2026-12-31,กำลังดำเนินการ',
].join('\n');

test('maps acknowledged preview into RPC payload without raw CSV or source filename metadata', () => {
  const preview = buildProjectImportPreview(csv, 'ORG-A');
  const args = buildCommitProjectImportRpc({
    preview,
    organizationId: 'ORG-A',
    departmentId: 'DEP-ENG',
    departmentName: 'กองช่าง',
    filename: 'นายสมชาย_ข้อมูลภายใน.csv',
    requestId: 'REQ-1',
    confirmWarnings: true,
  });
  assert.equal(args.p_organization_id, 'ORG-A');
  assert.equal(args.p_department_id, 'DEP-ENG');
  assert.equal(args.p_filename, 'work-tracking-import.csv');
  assert.doesNotMatch(args.p_filename, /สมชาย|ข้อมูลภายใน/);
  assert.equal(args.p_rows.length, 1);
  assert.equal(args.p_rows[0].projectCode, 'PJ-1');
  assert.equal('csvText' in args, false);
  assert.equal('role' in args, false);
  assert.equal('owner' in args.p_rows[0], false);
  assert.equal('lastUpdatedAt' in args.p_rows[0], false);
});

test('does not build commit payload when preview contains errors', () => {
  const bad = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,ผลจริง,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,90,เสร็จสิ้น',
  ].join('\n'), 'ORG-A');
  assert.throws(() => buildCommitProjectImportRpc({
    preview: bad, organizationId: 'ORG-A', departmentId: 'DEP-ENG', departmentName: 'กองช่าง', filename: 'bad.csv',
  }), /IMPORT_HAS_ERRORS/);
});

test('warning preview requires explicit confirmation', () => {
  const warning = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,เบิกจ่าย,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,1200000,กำลังดำเนินการ',
  ].join('\n'), 'ORG-A');

  assert.throws(() => buildCommitProjectImportRpc({
    preview: warning, organizationId: 'ORG-A', departmentId: 'DEP-ENG', departmentName: 'กองช่าง', filename: 'warning.csv',
  }), /WARNING_CONFIRMATION_REQUIRED/);

  const args = buildCommitProjectImportRpc({
    preview: warning, organizationId: 'ORG-A', departmentId: 'DEP-ENG', departmentName: 'กองช่าง', filename: 'warning.csv', confirmWarnings: true,
  });
  assert.equal(args.p_confirm_warnings, true);
});

test('CSV owner text requires acknowledgement because it is not silently mapped to a user id', () => {
  const preview = buildProjectImportPreview(csv, 'ORG-A');
  assert.equal(countUnresolvedImportOwners(preview), 1);
  assert.throws(() => buildCommitProjectImportRpc({
    preview, organizationId: 'ORG-A', departmentId: 'DEP-ENG', departmentName: 'กองช่าง', filename: 'owners.csv',
  }), /WARNING_CONFIRMATION_REQUIRED/);
});

test('legacy source update timestamp requires acknowledgement because server stamps the real import time', () => {
  const preview = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,งบประมาณ,วันที่อัปเดต',
    'PJ-OLD-TIME,โครงการไฟล์เก่า,กองช่าง,1000,2026-07-01T09:30:00+07:00',
  ].join('\n'), 'ORG-A');

  assert.equal(countIgnoredImportUpdateTimestamps(preview), 1);
  assert.throws(() => buildCommitProjectImportRpc({
    preview,
    organizationId: 'ORG-A',
    departmentId: 'DEP-ENG',
    departmentName: 'กองช่าง',
    filename: 'legacy.csv',
  }), /WARNING_CONFIRMATION_REQUIRED/);

  const args = buildCommitProjectImportRpc({
    preview,
    organizationId: 'ORG-A',
    departmentId: 'DEP-ENG',
    departmentName: 'กองช่าง',
    filename: 'legacy.csv',
    confirmWarnings: true,
  });
  assert.equal('lastUpdatedAt' in args.p_rows[0], false);
});

test('blocks non-empty CSV department that differs from selected commit department', () => {
  const preview = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,งบประมาณ',
    'PJ-MISMATCH,โครงการผิดกอง,กองคลัง,1000',
  ].join('\n'), 'ORG-A');

  const mismatches = findImportDepartmentMismatches(preview, 'กองช่าง');
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].row, 2);
  assert.equal(mismatches[0].sourceDepartment, 'กองคลัง');
  assert.throws(() => buildCommitProjectImportRpc({
    preview,
    organizationId: 'ORG-A',
    departmentId: 'DEP-ENG',
    departmentName: 'กองช่าง',
    filename: 'wrong-department.csv',
    confirmWarnings: true,
  }), /IMPORT_DEPARTMENT_MISMATCH/);
});

test('department comparison tolerates surrounding and repeated whitespace but not a different unit', () => {
  const preview = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,งบประมาณ',
    'PJ-SPACES,โครงการกองตรง,"  กองช่าง  ",1000',
  ].join('\n'), 'ORG-A');
  assert.equal(findImportDepartmentMismatches(preview, 'กองช่าง').length, 0);
});

test('blank CSV department does not override or conflict with selected department authority', () => {
  const preview = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,งบประมาณ',
    'PJ-BLANK,โครงการไม่ระบุกอง,,1000',
  ].join('\n'), 'ORG-A');
  assert.equal(findImportDepartmentMismatches(preview, 'กองช่าง').length, 0);
});

test('adapter enforces the same 500-row pilot ceiling as the server', () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    row: index + 2,
    status: 'VALID',
    project: { id: `PJ-${index}`, name: `Project ${index}`, organizationId: 'ORG-A' },
  }));
  assert.throws(() => buildCommitProjectImportRpc({
    preview: { rows }, organizationId: 'ORG-A', departmentId: 'DEP-ENG', filename: 'too-large.csv',
  }), /IMPORT_TOO_LARGE/);
});
