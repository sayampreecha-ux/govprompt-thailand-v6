import test from 'node:test';
import assert from 'node:assert/strict';

import { WORK_STATUS } from '../src/work-tracking/model.mjs';
import {
  DATA_QUALITY_SEVERITY,
  validateProjectBatch,
  validateProjectQuality,
} from '../src/work-tracking/data-quality.mjs';

test('flags completed project below 100 percent as an error', () => {
  const issues = validateProjectQuality({
    id: 'PJ-1',
    organizationId: 'ORG-PILOT',
    name: 'โครงการทดสอบ',
    department: 'กองช่าง',
    owner: 'เจ้าหน้าที่',
    budget: 1000000,
    actualProgress: 90,
    status: WORK_STATUS.COMPLETED,
  });

  assert.ok(issues.some((item) => item.code === 'COMPLETED_PROGRESS_MISMATCH' && item.severity === DATA_QUALITY_SEVERITY.ERROR));
});

test('warns when spent exceeds budget without silently rejecting the record', () => {
  const result = validateProjectBatch([{
    id: 'PJ-2',
    organizationId: 'ORG-PILOT',
    name: 'โครงการงบประมาณ',
    department: 'กองช่าง',
    owner: 'เจ้าหน้าที่',
    budget: 1000000,
    spent: 1200000,
    dueDate: '2026-12-31',
    status: WORK_STATUS.IN_PROGRESS,
  }]);

  assert.equal(result.summary.errors, 0);
  assert.ok(result.summary.warnings >= 1);
  assert.equal(result.validProjects.length, 1);
  assert.ok(result.issues.some((item) => item.code === 'SPENT_OVER_BUDGET'));
});

test('rejects duplicate project ids from the valid batch', () => {
  const result = validateProjectBatch([
    { id: 'DUP-1', organizationId: 'ORG-PILOT', name: 'งาน A', dueDate: '2026-12-01' },
    { id: 'DUP-1', organizationId: 'ORG-PILOT', name: 'งาน B', dueDate: '2026-12-02' },
  ]);

  assert.equal(result.validProjects.length, 0);
  assert.equal(result.issues.filter((item) => item.code === 'DUPLICATE_ID').length, 2);
});

test('flags invalid date order as an error', () => {
  const issues = validateProjectQuality({
    id: 'PJ-3',
    organizationId: 'ORG-PILOT',
    name: 'โครงการวันที่',
    startDate: '2026-12-31',
    dueDate: '2026-01-01',
    status: WORK_STATUS.IN_PROGRESS,
  });

  assert.ok(issues.some((item) => item.code === 'DATE_ORDER' && item.severity === DATA_QUALITY_SEVERITY.ERROR));
});
