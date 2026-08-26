import { ACCESS_ACTION, authorizeWorkAction } from './access-control.mjs';
import { AUDIT_ACTION, createAuditEvent } from './audit.mjs';
import { normalizeProject } from './model.mjs';
import { validateProjectQuality, DATA_QUALITY_SEVERITY } from './data-quality.mjs';

const MUTABLE_FIELDS = Object.freeze([
  'name', 'projectType', 'ownerUserId', 'owner', 'location', 'contractNo', 'contractor',
  'budget', 'spent', 'plannedProgress', 'actualProgress', 'startDate', 'dueDate',
  'status', 'lastUpdatedAt', 'problem',
]);

export function prepareProjectUpdate({ actor = {}, existingProject = {}, patch = {}, audit = {} } = {}) {
  const existing = normalizeProject(existingProject);
  const authorization = authorizeWorkAction({
    actor,
    action: ACCESS_ACTION.PROJECT_UPDATE,
    resource: {
      organizationId: existing.organizationId,
      departmentId: existing.departmentId,
      ownerUserId: existing.ownerUserId,
    },
  });

  if (!authorization.allowed) {
    return { ok: false, code: authorization.reason, authorization, project: existing, issues: [] };
  }

  const allowedPatch = {};
  for (const field of MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) allowedPatch[field] = patch[field];
  }

  const next = normalizeProject({
    ...existing,
    ...allowedPatch,
    id: existing.id,
    organizationId: existing.organizationId,
    departmentId: existing.departmentId,
    department: existing.department,
  });

  const issues = validateProjectQuality(next);
  const blockingIssues = issues.filter((item) => item.severity === DATA_QUALITY_SEVERITY.ERROR);
  if (blockingIssues.length) {
    return { ok: false, code: 'DATA_QUALITY_BLOCKED', authorization, project: next, issues };
  }

  const changedFields = MUTABLE_FIELDS.filter((field) => existing[field] !== next[field]);
  if (!changedFields.length) {
    return { ok: true, code: 'NO_CHANGE', authorization, project: existing, issues, auditEvent: null };
  }

  const statusChanged = existing.status !== next.status;
  const auditEvent = createAuditEvent({
    eventId: audit.eventId,
    organizationId: existing.organizationId,
    departmentId: existing.departmentId,
    actorUserId: actor.userId,
    action: statusChanged ? AUDIT_ACTION.PROJECT_STATUS_CHANGED : AUDIT_ACTION.PROJECT_UPDATED,
    entityType: 'PROJECT',
    entityId: existing.id,
    occurredAt: audit.occurredAt,
    requestId: audit.requestId,
    metadata: {
      projectId: existing.id,
      changedFields,
      previousStatus: statusChanged ? existing.status : undefined,
      nextStatus: statusChanged ? next.status : undefined,
      source: audit.source || 'WORK_TRACKING',
    },
  });

  return { ok: true, code: 'READY_TO_PERSIST', authorization, project: next, issues, auditEvent };
}
