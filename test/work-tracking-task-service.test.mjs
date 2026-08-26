import test from 'node:test';
import assert from 'node:assert/strict';

import { ORG_ROLE } from '../src/work-tracking/access-control.mjs';
import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import { TASK_PRIORITY } from '../src/work-tracking/task-model.mjs';
import { prepareTaskAssignment, prepareTaskUpdate } from '../src/work-tracking/task-service.mjs';

const task = {
  id: 'T-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', projectId: 'P-1',
  title: 'ตรวจหน้างาน', assignedUserId: 'U-1', status: WORK_STATUS.IN_PROGRESS,
  priority: TASK_PRIORITY.NORMAL, dueAt: '2026-09-15T17:00:00+07:00',
};

const audit = { eventId: 'AE-T1', occurredAt: '2026-08-26T09:00:00+07:00', requestId: 'REQ-T1' };

test('assigned officer can update own task', () => {
  const result = prepareTaskUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingTask: task,
    patch: { priority: TASK_PRIORITY.HIGH, status: WORK_STATUS.IN_PROGRESS },
    audit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'READY_TO_PERSIST');
  assert.equal(result.task.priority, TASK_PRIORITY.HIGH);
  assert.ok(result.auditEvent.metadata.changedFields.includes('priority'));
});

test('generic task update cannot reassign even when officer supplies assignedUserId', () => {
  const result = prepareTaskUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingTask: task,
    patch: { assignedUserId: 'U-2', priority: TASK_PRIORITY.HIGH },
    audit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.task.assignedUserId, 'U-1');
  assert.equal(result.auditEvent.action, 'TASK_UPDATED');
  assert.equal(result.auditEvent.metadata.changedFields.includes('assignedUserId'), false);
});

test('officer cannot update another assignee task', () => {
  const result = prepareTaskUpdate({
    actor: { userId: 'U-2', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingTask: task,
    patch: { status: WORK_STATUS.BLOCKED },
    audit,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_ASSIGNED_OWNER');
});

test('director can assign a task within department', () => {
  const result = prepareTaskAssignment({
    actor: { userId: 'D-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.DIRECTOR, active: true },
    existingTask: task,
    assignedUserId: 'U-2',
    audit,
  });
  assert.equal(result.ok, true);
  assert.equal(result.task.assignedUserId, 'U-2');
  assert.equal(result.auditEvent.action, 'TASK_ASSIGNED');
});

test('executive cannot assign or update task', () => {
  const actor = { userId: 'E-1', organizationId: 'ORG-A', role: ORG_ROLE.EXECUTIVE, active: true };
  assert.equal(prepareTaskAssignment({ actor, existingTask: task, assignedUserId: 'U-2', audit }).ok, false);
  assert.equal(prepareTaskUpdate({ actor, existingTask: task, patch: { status: WORK_STATUS.BLOCKED }, audit }).ok, false);
});

test('completedAt without completed status is blocked', () => {
  const result = prepareTaskUpdate({
    actor: { userId: 'U-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true },
    existingTask: task,
    patch: { completedAt: '2026-08-26T09:00:00+07:00' },
    audit,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DATA_QUALITY_BLOCKED');
});
