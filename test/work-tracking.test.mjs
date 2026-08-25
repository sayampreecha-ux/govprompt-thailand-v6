import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORK_STATUS,
  RISK_LEVEL,
  assessProjectRisk,
  buildDashboardSummary,
  normalizeProject,
} from '../src/work-tracking/model.mjs';

test('normalizeProject keeps organization boundary and normalizes numeric values', () => {
  const project = normalizeProject({
    id: 'PJ-001',
    organizationId: 'ORG-PHAYAO',
    budget: '4500000',
    spent: '1250000',
    plannedProgress: 60,
    actualProgress: 48,
  });

  assert.equal(project.organizationId, 'ORG-PHAYAO');
  assert.equal(project.budget, 4500000);
  assert.equal(project.spent, 1250000);
  assert.equal(project.plannedProgress, 60);
  assert.equal(project.actualProgress, 48);
});

test('project far behind plan is red risk', () => {
  const risk = assessProjectRisk({
    id: 'PJ-002',
    organizationId: 'ORG-PHAYAO',
    name: 'ปรับปรุงถนน',
    status: WORK_STATUS.IN_PROGRESS,
    plannedProgress: 80,
    actualProgress: 52,
    dueDate: '2026-09-30',
  }, new Date('2026-08-26T00:00:00+07:00'));

  assert.equal(risk.level, RISK_LEVEL.RED);
  assert.equal(risk.metrics.variance, -28);
});

test('near deadline with low progress is escalated', () => {
  const risk = assessProjectRisk({
    id: 'PJ-003',
    organizationId: 'ORG-PHAYAO',
    status: WORK_STATUS.IN_PROGRESS,
    plannedProgress: 75,
    actualProgress: 50,
    dueDate: '2026-09-05',
  }, new Date('2026-08-26T00:00:00+07:00'));

  assert.equal(risk.level, RISK_LEVEL.RED);
  assert.ok(risk.reasons.some((reason) => reason.includes('เหลือ')));
});

test('completed project remains green', () => {
  const risk = assessProjectRisk({
    id: 'PJ-004',
    organizationId: 'ORG-PHAYAO',
    status: WORK_STATUS.COMPLETED,
    plannedProgress: 100,
    actualProgress: 100,
    dueDate: '2026-08-01',
  }, new Date('2026-08-26T00:00:00+07:00'));

  assert.equal(risk.level, RISK_LEVEL.GREEN);
});

test('dashboard summary aggregates status, budget, progress and priorities', () => {
  const summary = buildDashboardSummary([
    {
      id: 'PJ-101', organizationId: 'ORG-PHAYAO', status: WORK_STATUS.COMPLETED,
      budget: 1000000, spent: 1000000, plannedProgress: 100, actualProgress: 100,
    },
    {
      id: 'PJ-102', organizationId: 'ORG-PHAYAO', status: WORK_STATUS.IN_PROGRESS,
      budget: 2000000, spent: 800000, plannedProgress: 80, actualProgress: 50,
      dueDate: '2026-09-01',
    },
  ], new Date('2026-08-26T00:00:00+07:00'));

  assert.equal(summary.counts.total, 2);
  assert.equal(summary.counts.completed, 1);
  assert.equal(summary.counts.inProgress, 1);
  assert.equal(summary.finance.totalBudget, 3000000);
  assert.equal(summary.finance.totalSpent, 1800000);
  assert.equal(summary.averageProgress, 75);
  assert.equal(summary.priority.length, 1);
  assert.equal(summary.priority[0].project.id, 'PJ-102');
});
