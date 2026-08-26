import { ACCESS_ACTION, authorizeWorkAction } from './access-control.mjs';
import { AUDIT_ACTION, createAuditEvent } from './audit.mjs';
import { WORK_STATUS } from './model.mjs';
import { TASK_PRIORITY, normalizeTask } from './task-model.mjs';

const MUTABLE_FIELDS = Object.freeze([
  'title', 'assignedUserId', 'status', 'priority', 'dueAt', 'completedAt', 'lastUpdatedAt',
]);

const validDateOrNull = (value) => !value || !Number.isNaN(new Date(value).getTime());

export function validateTaskQuality(taskInput = {}) {
  const task = normalizeTask(taskInput);
  const issues = [];
  if (!task.organizationId) issues.push({ severity: 'ERROR', code: 'MISSING_ORGANIZATION' });
  if (!task.departmentId) issues.push({ severity: 'ERROR', code: 'MISSING_DEPARTMENT' });
  if (!task.projectId) issues.push({ severity: 'ERROR', code: 'MISSING_PROJECT' });
  if (!task.title) issues.push({ severity: 'ERROR', code: 'MISSING_TITLE' });
  if (task.dueAt && !validDateOrNull(task.dueAt)) issues.push({ severity: 'ERROR', code: 'INVALID_DUE_AT' });
  if (task.completedAt && !validDateOrNull(task.completedAt)) issues.push({ severity: 'ERROR', code: 'INVALID_COMPLETED_AT' });
  if (task.status === WORK_STATUS.COMPLETED && !task.completedAt) {
    issues.push({ severity: 'WARNING', code: 'COMPLETED_AT_MISSING' });
  }
  if (task.status !== WORK_STATUS.COMPLETED && task.completedAt) {
    issues.push({ severity: 'ERROR', code: 'COMPLETED_AT_STATUS_MISMATCH' });
  }
  return issues;
}

export function prepareTaskUpdate({ actor = {}, existingTask = {}, patch = {}, audit = {} } = {}) {
  const existing = normalizeTask(existingTask);
  const authorization = authorizeWorkAction({
    actor,
    action: ACCESS_ACTION.TASK_UPDATE,
    resource: {
      organizationId: existing.organizationId,
      departmentId: existing.departmentId,
      ownerUserId: existing.assignedUserId,
    },
  });

  if (!authorization.allowed) {
    return { ok: false, code: authorization.reason, authorization, task: existing, issues: [] };
  }

  const allowedPatch = {};
  for (const field of MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) allowedPatch[field] = patch[field];
  }

  if (allowedPatch.priority && !Object.values(TASK_PRIORITY).includes(allowedPatch.priority)) {
    return { ok: false, code: 'INVALID_PRIORITY', authorization, task: existing, issues: [] };
  }

  const next = normalizeTask({
    ...existing,
    ...allowedPatch,
    id: existing.id,
    organizationId: existing.organizationId,
    departmentId: existing.departmentId,
    projectId: existing.projectId,
  });

  const issues = validateTaskQuality(next);
  if (issues.some((item) => item.severity === 'ERROR')) {
    return { ok: false, code: 'DATA_QUALITY_BLOCKED', authorization, task: next, issues };
  }

  const changedFields = MUTABLE_FIELDS.filter((field) => existing[field] !== next[field]);
  if (!changedFields.length) {
    return { ok: true, code: 'NO_CHANGE', authorization, task: existing, issues, auditEvent: null };
  }

  const assignmentChanged = existing.assignedUserId !== next.assignedUserId;
  const auditEvent = createAuditEvent({
    eventId: audit.eventId,
    organizationId: existing.organizationId,
    departmentId: existing.departmentId,
    actorUserId: actor.userId,
    action: assignmentChanged ? AUDIT_ACTION.TASK_ASSIGNED : AUDIT_ACTION.TASK_UPDATED,
    entityType: 'TASK',
    entityId: existing.id,
    occurredAt: audit.occurredAt,
    requestId: audit.requestId,
    metadata: {
      taskId: existing.id,
      projectId: existing.projectId,
      changedFields,
      previousStatus: existing.status !== next.status ? existing.status : undefined,
      nextStatus: existing.status !== next.status ? next.status : undefined,
      source: audit.source || 'WORK_TRACKING',
    },
  });

  return { ok: true, code: 'READY_TO_PERSIST', authorization, task: next, issues, auditEvent };
}

export function prepareTaskAssignment({ actor = {}, existingTask = {}, assignedUserId = '', audit = {} } = {}) {
  const existing = normalizeTask(existingTask);
  const authorization = authorizeWorkAction({
    actor,
    action: ACCESS_ACTION.TASK_ASSIGN,
    resource: {
      organizationId: existing.organizationId,
      departmentId: existing.departmentId,
      ownerUserId: existing.assignedUserId,
    },
  });

  if (!authorization.allowed) {
    return { ok: false, code: authorization.reason, authorization, task: existing, issues: [] };
  }

  const next = normalizeTask({ ...existing, assignedUserId });
  if (!next.assignedUserId) {
    return { ok: false, code: 'ASSIGNEE_REQUIRED', authorization, task: existing, issues: [] };
  }

  const auditEvent = createAuditEvent({
    eventId: audit.eventId,
    organizationId: existing.organizationId,
    departmentId: existing.departmentId,
    actorUserId: actor.userId,
    action: AUDIT_ACTION.TASK_ASSIGNED,
    entityType: 'TASK',
    entityId: existing.id,
    occurredAt: audit.occurredAt,
    requestId: audit.requestId,
    metadata: {
      taskId: existing.id,
      projectId: existing.projectId,
      changedFields: ['assignedUserId'],
      source: audit.source || 'WORK_TRACKING',
    },
  });

  return { ok: true, code: 'READY_TO_PERSIST', authorization, task: next, issues: [], auditEvent };
}
