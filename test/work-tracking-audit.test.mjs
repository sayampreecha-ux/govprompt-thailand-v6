import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIT_ACTION,
  createAuditEvent,
  sanitizeAuditMetadata,
} from '../src/work-tracking/audit.mjs';

test('audit metadata keeps only approved operational fields', () => {
  const metadata = sanitizeAuditMetadata({
    projectId: 'P-1',
    changedFields: ['status', 'actualProgress'],
    phone: '0800000000',
    citizenName: 'ข้อมูลไม่ควรเข้า audit metadata',
  });
  assert.equal(metadata.projectId, 'P-1');
  assert.deepEqual(metadata.changedFields, ['status', 'actualProgress']);
  assert.equal('phone' in metadata, false);
  assert.equal('citizenName' in metadata, false);
});

test('creates immutable audit event with organization boundary', () => {
  const event = createAuditEvent({
    eventId: 'AE-1',
    organizationId: 'ORG-A',
    actorUserId: 'U-1',
    action: AUDIT_ACTION.PROJECT_STATUS_CHANGED,
    entityType: 'PROJECT',
    entityId: 'P-1',
    occurredAt: '2026-08-26T07:00:00+07:00',
    requestId: 'REQ-1',
    metadata: { previousStatus: 'IN_PROGRESS', nextStatus: 'COMPLETED' },
  });
  assert.equal(event.organizationId, 'ORG-A');
  assert.equal(event.actorUserId, 'U-1');
  assert.equal(event.metadata.nextStatus, 'COMPLETED');
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.metadata), true);
});

test('rejects audit event without required actor or valid action', () => {
  assert.throws(() => createAuditEvent({
    eventId: 'AE-2', organizationId: 'ORG-A', actorUserId: '',
    action: AUDIT_ACTION.PROJECT_UPDATED, entityType: 'PROJECT', entityId: 'P-1',
    occurredAt: '2026-08-26T07:00:00+07:00',
  }), /AUDIT_ACTOR_REQUIRED/);

  assert.throws(() => createAuditEvent({
    eventId: 'AE-3', organizationId: 'ORG-A', actorUserId: 'U-1',
    action: 'UNKNOWN', entityType: 'PROJECT', entityId: 'P-1',
    occurredAt: '2026-08-26T07:00:00+07:00',
  }), /AUDIT_ACTION_INVALID/);
});
