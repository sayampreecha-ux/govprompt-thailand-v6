import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCESS_ACTION,
  ORG_ROLE,
  authorizeWorkAction,
} from '../src/work-tracking/access-control.mjs';

const actor = (overrides = {}) => ({
  userId: 'U-1',
  organizationId: 'ORG-A',
  departmentId: 'DEP-ENGINEERING',
  role: ORG_ROLE.OFFICER,
  active: true,
  ...overrides,
});

const resource = (overrides = {}) => ({
  organizationId: 'ORG-A',
  departmentId: 'DEP-ENGINEERING',
  ownerUserId: 'U-1',
  ...overrides,
});

test('denies cross-organization access before role permissions are considered', () => {
  const result = authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.ORG_ADMIN }),
    action: ACCESS_ACTION.PROJECT_READ,
    resource: resource({ organizationId: 'ORG-B' }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'TENANT_MISMATCH');
});

test('executive can read organization dashboard but cannot update a project', () => {
  assert.equal(authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.EXECUTIVE }),
    action: ACCESS_ACTION.DASHBOARD_READ,
    resource: resource(),
  }).allowed, true);

  assert.equal(authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.EXECUTIVE }),
    action: ACCESS_ACTION.PROJECT_UPDATE,
    resource: resource(),
  }).reason, 'ROLE_FORBIDDEN');
});

test('director is restricted to their department for operational changes', () => {
  const result = authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.DIRECTOR }),
    action: ACCESS_ACTION.PROJECT_UPDATE,
    resource: resource({ departmentId: 'DEP-HEALTH' }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'DEPARTMENT_MISMATCH');
});

test('officer cannot update another assigned owner project', () => {
  const result = authorizeWorkAction({
    actor: actor(),
    action: ACCESS_ACTION.PROJECT_UPDATE,
    resource: resource({ ownerUserId: 'U-OTHER' }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'NOT_ASSIGNED_OWNER');
});

test('auditor is read-only and can read audit events', () => {
  const auditRead = authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.AUDITOR }),
    action: ACCESS_ACTION.AUDIT_READ,
    resource: resource(),
  });
  const update = authorizeWorkAction({
    actor: actor({ role: ORG_ROLE.AUDITOR }),
    action: ACCESS_ACTION.PROJECT_UPDATE,
    resource: resource(),
  });
  assert.equal(auditRead.allowed, true);
  assert.equal(update.allowed, false);
});
