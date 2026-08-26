import test from 'node:test';
import assert from 'node:assert/strict';

import { RISK_LEVEL, WORK_STATUS } from '../src/work-tracking/model.mjs';
import {
  buildOrganizationDashboard,
  filterProjects,
  scopeProjectsToOrganization,
} from '../src/work-tracking/dashboard.mjs';
import {
  PILOT_ORGANIZATION_ID,
  constructionPilotProjects,
} from '../src/work-tracking/pilot-data.mjs';

const NOW = new Date('2026-08-26T00:00:00+07:00');

test('organization scope excludes projects from another tenant', () => {
  const scoped = scopeProjectsToOrganization(
    constructionPilotProjects,
    PILOT_ORGANIZATION_ID,
  );

  assert.equal(scoped.length, 7);
  assert.ok(scoped.every((project) => project.organizationId === PILOT_ORGANIZATION_ID));
  assert.ok(!scoped.some((project) => project.id === 'CON-OTHER-001'));
});

test('missing organization id returns no rows instead of leaking all projects', () => {
  const scoped = scopeProjectsToOrganization(constructionPilotProjects, '');
  assert.deepEqual(scoped, []);
});

test('construction dashboard creates executive summary and priority queue', () => {
  const dashboard = buildOrganizationDashboard(
    constructionPilotProjects,
    PILOT_ORGANIZATION_ID,
    { now: NOW },
  );

  assert.equal(dashboard.summary.counts.total, 7);
  assert.equal(dashboard.summary.counts.completed, 1);
  assert.equal(dashboard.summary.counts.blocked, 1);
  assert.ok(dashboard.summary.counts.red >= 2);
  assert.ok(dashboard.priorityRows.length >= 3);
  assert.equal(dashboard.priorityRows[0].id, 'CON-2569-004');
});

test('risk and status filters can narrow projects for executive review', () => {
  const red = filterProjects(constructionPilotProjects, {
    riskLevel: RISK_LEVEL.RED,
  }, NOW);
  assert.ok(red.some((project) => project.id === 'CON-2569-001'));
  assert.ok(red.some((project) => project.id === 'CON-2569-004'));

  const waitingReview = filterProjects(constructionPilotProjects, {
    status: WORK_STATUS.WAITING_REVIEW,
  }, NOW);
  assert.equal(waitingReview.length, 1);
  assert.equal(waitingReview[0].id, 'CON-2569-007');
});

test('search covers contract, contractor and location fields', () => {
  const byContract = filterProjects(constructionPilotProjects, {
    query: 'สญ.ตัวอย่าง-003',
  }, NOW);
  assert.equal(byContract.length, 1);
  assert.equal(byContract[0].id, 'CON-2569-003');

  const byLocation = filterProjects(constructionPilotProjects, {
    query: 'ตำบล F',
  }, NOW);
  assert.equal(byLocation.length, 1);
  assert.equal(byLocation[0].id, 'CON-2569-006');
});
