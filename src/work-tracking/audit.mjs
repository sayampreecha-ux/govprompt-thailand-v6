export const AUDIT_ACTION = Object.freeze({
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UPDATED: 'TASK_UPDATED',
  IMPORT_PREVIEWED: 'IMPORT_PREVIEWED',
  IMPORT_COMMITTED: 'IMPORT_COMMITTED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
});

const SAFE_METADATA_KEYS = new Set([
  'projectId', 'taskId', 'importBatchId', 'changedFields', 'previousStatus',
  'nextStatus', 'source', 'reasonCode', 'recordCount',
]);

const normalize = (value) => String(value || '').trim();

export function sanitizeAuditMetadata(metadata = {}) {
  const result = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (Array.isArray(value)) result[key] = value.map((item) => String(item)).slice(0, 50);
    else if (['string', 'number', 'boolean'].includes(typeof value)) result[key] = value;
  }
  return result;
}

export function createAuditEvent(input = {}) {
  const eventId = normalize(input.eventId);
  const organizationId = normalize(input.organizationId);
  const departmentId = normalize(input.departmentId);
  const actorUserId = normalize(input.actorUserId);
  const action = normalize(input.action);
  const entityType = normalize(input.entityType);
  const entityId = normalize(input.entityId);
  const occurredAt = normalize(input.occurredAt);

  if (!eventId) throw new Error('AUDIT_EVENT_ID_REQUIRED');
  if (!organizationId) throw new Error('AUDIT_ORGANIZATION_REQUIRED');
  if (!actorUserId) throw new Error('AUDIT_ACTOR_REQUIRED');
  if (!Object.values(AUDIT_ACTION).includes(action)) throw new Error('AUDIT_ACTION_INVALID');
  if (!entityType || !entityId) throw new Error('AUDIT_ENTITY_REQUIRED');
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) throw new Error('AUDIT_TIME_INVALID');

  return Object.freeze({
    eventId,
    organizationId,
    departmentId,
    actorUserId,
    action,
    entityType,
    entityId,
    occurredAt: new Date(occurredAt).toISOString(),
    requestId: normalize(input.requestId),
    metadata: Object.freeze(sanitizeAuditMetadata(input.metadata)),
  });
}
