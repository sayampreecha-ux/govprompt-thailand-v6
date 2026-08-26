import test from 'node:test';
import assert from 'node:assert/strict';

import { ORG_ROLE } from '../src/work-tracking/access-control.mjs';
import { resolveWorkSession } from '../src/work-tracking/session-context.mjs';

test('requires authenticated user', () => {
  const result = resolveWorkSession({ memberships: [] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTH_REQUIRED');
});

test('resolves a single active membership without trusting browser role fields', () => {
  const result = resolveWorkSession({
    session: { user: { id: 'U-1' }, role: 'ORG_ADMIN', organizationId: 'ORG-FAKE' },
    memberships: [{ user_id: 'U-1', organization_id: 'ORG-A', department_id: 'DEP-ENG', role: ORG_ROLE.OFFICER, active: true }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.organizationId, 'ORG-A');
  assert.equal(result.actor.role, ORG_ROLE.OFFICER);
});

test('requires explicit organization selection for multiple memberships', () => {
  const memberships = [
    { userId: 'U-1', organizationId: 'ORG-A', role: ORG_ROLE.EXECUTIVE, active: true },
    { userId: 'U-1', organizationId: 'ORG-B', role: ORG_ROLE.AUDITOR, active: true },
  ];
  const unresolved = resolveWorkSession({ session: { userId: 'U-1' }, memberships });
  const selected = resolveWorkSession({ session: { userId: 'U-1' }, memberships, requestedOrganizationId: 'ORG-B' });
  assert.equal(unresolved.code, 'ORGANIZATION_SELECTION_REQUIRED');
  assert.equal(selected.ok, true);
  assert.equal(selected.actor.organizationId, 'ORG-B');
  assert.equal(selected.actor.role, ORG_ROLE.AUDITOR);
});

test('rejects organization not present in active memberships', () => {
  const result = resolveWorkSession({
    session: { userId: 'U-1' },
    memberships: [{ userId: 'U-1', organizationId: 'ORG-A', role: ORG_ROLE.EXECUTIVE, active: true }],
    requestedOrganizationId: 'ORG-B',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ORGANIZATION_NOT_ALLOWED');
});
