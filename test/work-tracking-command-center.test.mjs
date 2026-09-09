import test from 'node:test';
import assert from 'node:assert/strict';

import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import { TASK_PRIORITY } from '../src/work-tracking/task-model.mjs';
import { buildCommandCenter } from '../src/work-tracking/command-center.mjs';

const now = new Date('2026-08-26T08:00:00+07:00');

test('command center scopes projects and tasks to one organization', () => {
  const result = buildCommandCenter({
    organizationId: 'ORG-A',
    now,
    projects: [
      { id: 'P-A', organizationId: 'ORG-A', name: 'ถนน A', status: WORK_STATUS.IN_PROGRESS, plannedProgress: 80, actualProgress: 40, dueDate: '2026-09-05' },
      { id: 'P-B', organizationId: 'ORG-B', name: 'ถนน B', status: WORK_STATUS.BLOCKED, plannedProgress: 80, actualProgress: 10, dueDate: '2026-08-30' },
    ],
    tasks: [
      { id: 'T-A', organizationId: 'ORG-A', projectId: 'P-A', title: 'สำรวจ', status: WORK_STATUS.IN_PROGRESS, dueAt: '2026-08-25', priority: TASK_PRIORITY.HIGH },
      { id: 'T-B', organizationId: 'ORG-B', projectId: 'P-B', title: 'งานอีกองค์กร', status: WORK_STATUS.BLOCKED, dueAt: '2026-08-20' },
    ],
  });

  assert.equal(result.projectSummary.counts.total, 1);
  assert.equal(result.taskSummary.counts.total, 1);
  assert.ok(result.actionQueue.every((item) => item.id !== 'P-B' && item.id !== 'T-B'));
});

test('urgent action queue puts urgent work before attention work', () => {
  const result = buildCommandCenter({
    organizationId: 'ORG-A',
    now,
    projects: [
      { id: 'P-1', organizationId: 'ORG-A', name: 'เสี่ยงเล็กน้อย', status: WORK_STATUS.IN_PROGRESS, plannedProgress: 60, actualProgress: 49, dueDate: '2026-10-30' },
    ],
    tasks: [
      { id: 'T-1', organizationId: 'ORG-A', projectId: 'P-1', title: 'เกินกำหนด', status: WORK_STATUS.IN_PROGRESS, dueAt: '2026-08-20' },
    ],
  });

  assert.equal(result.actionQueue[0].type, 'TASK');
  assert.equal(result.actionQueue[0].level, 'URGENT');
  assert.equal(result.counts.totalActionItems, 2);
});

test('missing organization context fails closed with empty command center', () => {
  const result = buildCommandCenter({
    projects: [{ id: 'P-1', organizationId: 'ORG-A', name: 'ห้ามรั่ว' }],
    tasks: [{ id: 'T-1', organizationId: 'ORG-A', title: 'ห้ามรั่ว' }],
    now,
  });
  assert.equal(result.actionQueue.length, 0);
  assert.equal(result.projectSummary.counts.total, 0);
  assert.equal(result.taskSummary.counts.total, 0);
});
