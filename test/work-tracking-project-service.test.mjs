import test from 'node:test';
import assert from 'node:assert/strict';

import { ORG_ROLE } from '../src/work-tracking/access-control.mjs';
import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import { prepareProjectUpdate } from '../src/work-tracking/project-service.mjs';

const project = {
  id: 'P-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', department: 'กองช่าง',
  ownerUserId: 'U-1', owner: 'เจ้าหน้าที่', name: 'โครงการถนน', budget: 1000000,
  spent: 200000, plannedProgress: 50, actualProgress: 40, dueDate: '2026-12-31',
  status: WORK_STATUS.IN_PROGRESS,
};

const audit = { eventId: 'AE-1', occurredAt: '2026-08-26T08:00:00+07:00', requestId: 'REQ-1' };

test('prepares allowed officer update and emits audit event', () => {
  const result = prepareProjectUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingProject: project,
    patch: { actualProgress: 55, problem: 'อัปเดตหน้างาน' },
    audit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'READY_TO_PERSIST');
  assert.equal(result.project.actualProgress, 55);
  assert.ok(result.auditEvent.metadata.changedFields.includes('actualProgress'));
});

test('denies cross-tenant update even when caller changes patch organization id', () => {
  const result = prepareProjectUpdate({
    actor: { userId: 'U-X', organizationId: 'ORG-B', departmentId: 'DEP-ENG', role: ORG_ROLE.ORG_ADMIN, active: true },
    existingProject: project,
    patch: { organizationId: 'ORG-B', actualProgress: 80 },
    audit,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TENANT_MISMATCH');
  assert.equal(result.project.organizationId, 'ORG-A');
});

test('blocks update that makes completed progress inconsistent', () => {
  const result = prepareProjectUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingProject: project,
    patch: { status: WORK_STATUS.COMPLETED, actualProgress: 90 },
    audit,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DATA_QUALITY_BLOCKED');
  assert.ok(result.issues.some((item) => item.code === 'COMPLETED_PROGRESS_MISMATCH'));
});

test('immutable identity fields cannot be overwritten by patch', () => {
  const result = prepareProjectUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingProject: project,
    patch: { id: 'P-OTHER', organizationId: 'ORG-B', departmentId: 'DEP-OTHER', name: 'ชื่อใหม่' },
    audit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.project.id, 'P-1');
  assert.equal(result.project.organizationId, 'ORG-A');
  assert.equal(result.project.departmentId, 'DEP-ENG');
});
