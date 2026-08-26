import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectImportPreview } from '../src/work-tracking/import-preview.mjs';
import {
  buildCommitProjectImportRpc,
  countUnresolvedImportOwners,
} from '../src/work-tracking/import-rpc-adapter.mjs';

const csv = [
  'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,เบิกจ่าย,แผน,ผลจริง,กำหนดเสร็จ,สถานะ',
  'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,200000,50,40,2026-12-31,กำลังดำเนินการ',
].join('\n');

test('maps acknowledged preview into RPC payload without raw CSV content', () => {
  const preview = buildProjectImportPreview(csv, 'ORG-A');
  const args = buildCommitProjectImportRpc({
    preview,
    organizationId: 'ORG-A',
    departmentId: 'DEP-ENG',
    filename: 'projects.csv',
    requestId: 'REQ-1',
    confirmWarnings: true,
  });
  assert.equal(args.p_organization_id, 'ORG-A');
  assert.equal(args.p_department_id, 'DEP-ENG');
  assert.equal(args.p_rows.length, 1);
  assert.equal(args.p_rows[0].projectCode, 'PJ-1');
  assert.equal('csvText' in args, false);
  assert.equal('role' in args, false);
  assert.equal('owner' in args.p_rows[0], false);
});

test('does not build commit payload when preview contains errors', () => {
  const bad = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,ผลจริง,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,90,เสร็จสิ้น',
  ].join('\n'), 'ORG-A');
  assert.throws(() => buildCommitProjectImportRpc({
    preview: bad, organizationId: 'ORG-A', departmentId: 'DEP-ENG', filename: 'bad.csv',
  }), /IMPORT_HAS_ERRORS/);
});

test('warning preview requires explicit confirmation', () => {
  const warning = buildProjectImportPreview([
    'รหัสโครงการ,ชื่อโครงการ,กอง,ผู้รับผิดชอบ,งบประมาณ,เบิกจ่าย,สถานะ',
    'PJ-1,โครงการ A,กองช่าง,นาย ก,1000000,1200000,กำลังดำเนินการ',
  ].join('\n'), 'ORG-A');

  assert.throws(() => buildCommitProjectImportRpc({
    preview: warning, organizationId: 'ORG-A', departmentId: 'DEP-ENG', filename: 'warning.csv',
  }), /WARNING_CONFIRMATION_REQUIRED/);

  const args = buildCommitProjectImportRpc({
    preview: warning, organizationId: 'ORG-A', departmentId: 'DEP-ENG', filename: 'warning.csv', confirmWarnings: true,
  });
  assert.equal(args.p_confirm_warnings, true);
});

test('CSV owner text requires acknowledgement because it is not silently mapped to a user id', () => {
  const preview = buildProjectImportPreview(csv, 'ORG-A');
  assert.equal(countUnresolvedImportOwners(preview), 1);
  assert.throws(() => buildCommitProjectImportRpc({
    preview, organizationId: 'ORG-A', departmentId: 'DEP-ENG', filename: 'owners.csv',
  }), /WARNING_CONFIRMATION_REQUIRED/);
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
