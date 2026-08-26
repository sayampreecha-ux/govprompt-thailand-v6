import test from 'node:test';
import assert from 'node:assert/strict';

import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import {
  TASK_PRIORITY,
  TASK_URGENCY,
  assessTaskUrgency,
  buildTaskSummary,
  normalizeTask,
} from '../src/work-tracking/task-model.mjs';

test('normalizes task with tenant and assignment identity', () => {
  const task = normalizeTask({
    id: 'T-1', organizationId: 'ORG-A', departmentId: 'DEP-ENG', projectId: 'P-1',
    title: 'ตรวจหน้างาน', assignedUserId: 'U-1', priority: TASK_PRIORITY.HIGH,
  });
  assert.equal(task.organizationId, 'ORG-A');
  assert.equal(task.departmentId, 'DEP-ENG');
  assert.equal(task.assignedUserId, 'U-1');
});

test('overdue task is urgent', () => {
  const urgency = assessTaskUrgency({
    id: 'T-2', organizationId: 'ORG-A', title: 'ส่งรายงาน', status: WORK_STATUS.IN_PROGRESS,
    dueAt: '2026-08-20T17:00:00+07:00', priority: TASK_PRIORITY.NORMAL,
  }, new Date('2026-08-26T08:00:00+07:00'));
  assert.equal(urgency.level, TASK_URGENCY.URGENT);
  assert.ok(urgency.reasons.some((reason) => reason.includes('เกินกำหนด')));
});

test('completed task is normal even when due date is old', () => {
  const urgency = assessTaskUrgency({
    id: 'T-3', organizationId: 'ORG-A', title: 'ตรวจรับ', status: WORK_STATUS.COMPLETED,
    dueAt: '2026-08-01T17:00:00+07:00', priority: TASK_PRIORITY.URGENT,
  }, new Date('2026-08-26T08:00:00+07:00'));
  assert.equal(urgency.level, TASK_URGENCY.NORMAL);
});

test('task summary creates an executive priority queue', () => {
  const summary = buildTaskSummary([
    { id: 'T-1', status: WORK_STATUS.COMPLETED, title: 'เสร็จ', dueAt: '2026-08-01' },
    { id: 'T-2', status: WORK_STATUS.IN_PROGRESS, title: 'เกินกำหนด', dueAt: '2026-08-20' },
    { id: 'T-3', status: WORK_STATUS.BLOCKED, title: 'ติดปัญหา', dueAt: '2026-09-10' },
  ], new Date('2026-08-26T08:00:00+07:00'));

  assert.equal(summary.counts.total, 3);
  assert.equal(summary.counts.completed, 1);
  assert.equal(summary.counts.urgent, 1);
  assert.equal(summary.counts.attention, 1);
  assert.equal(summary.priority.length, 2);
});
