export const ORG_ROLE = Object.freeze({
  ORG_ADMIN: 'ORG_ADMIN',
  EXECUTIVE: 'EXECUTIVE',
  DIRECTOR: 'DIRECTOR',
  OFFICER: 'OFFICER',
  AUDITOR: 'AUDITOR',
});

export const ACCESS_ACTION = Object.freeze({
  DASHBOARD_READ: 'DASHBOARD_READ',
  PROJECT_READ: 'PROJECT_READ',
  PROJECT_CREATE: 'PROJECT_CREATE',
  PROJECT_ASSIGN: 'PROJECT_ASSIGN',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  PROJECT_DELETE: 'PROJECT_DELETE',
  TASK_READ: 'TASK_READ',
  TASK_CREATE: 'TASK_CREATE',
  TASK_ASSIGN: 'TASK_ASSIGN',
  TASK_UPDATE: 'TASK_UPDATE',
  AUDIT_READ: 'AUDIT_READ',
  IMPORT_PREVIEW: 'IMPORT_PREVIEW',
  IMPORT_COMMIT: 'IMPORT_COMMIT',
  USER_MANAGE: 'USER_MANAGE',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ORG_ROLE.ORG_ADMIN]: new Set(Object.values(ACCESS_ACTION)),
  [ORG_ROLE.EXECUTIVE]: new Set([
    ACCESS_ACTION.DASHBOARD_READ,
    ACCESS_ACTION.PROJECT_READ,
    ACCESS_ACTION.TASK_READ,
    ACCESS_ACTION.AUDIT_READ,
    ACCESS_ACTION.IMPORT_PREVIEW,
  ]),
  [ORG_ROLE.DIRECTOR]: new Set([
    ACCESS_ACTION.DASHBOARD_READ,
    ACCESS_ACTION.PROJECT_READ,
    ACCESS_ACTION.PROJECT_CREATE,
    ACCESS_ACTION.PROJECT_ASSIGN,
    ACCESS_ACTION.PROJECT_UPDATE,
    ACCESS_ACTION.TASK_READ,
    ACCESS_ACTION.TASK_CREATE,
    ACCESS_ACTION.TASK_ASSIGN,
    ACCESS_ACTION.TASK_UPDATE,
    ACCESS_ACTION.AUDIT_READ,
    ACCESS_ACTION.IMPORT_PREVIEW,
    ACCESS_ACTION.IMPORT_COMMIT,
  ]),
  [ORG_ROLE.OFFICER]: new Set([
    ACCESS_ACTION.DASHBOARD_READ,
    ACCESS_ACTION.PROJECT_READ,
    ACCESS_ACTION.PROJECT_CREATE,
    ACCESS_ACTION.PROJECT_UPDATE,
    ACCESS_ACTION.TASK_READ,
    ACCESS_ACTION.TASK_CREATE,
    ACCESS_ACTION.TASK_UPDATE,
    ACCESS_ACTION.IMPORT_PREVIEW,
  ]),
  [ORG_ROLE.AUDITOR]: new Set([
    ACCESS_ACTION.DASHBOARD_READ,
    ACCESS_ACTION.PROJECT_READ,
    ACCESS_ACTION.TASK_READ,
    ACCESS_ACTION.AUDIT_READ,
  ]),
});

const normalize = (value) => String(value || '').trim();

export function authorizeWorkAction({ actor = {}, action = '', resource = {} } = {}) {
  const userId = normalize(actor.userId);
  const organizationId = normalize(actor.organizationId);
  const role = normalize(actor.role);
  const departmentId = normalize(actor.departmentId);
  const resourceOrganizationId = normalize(resource.organizationId);
  const resourceDepartmentId = normalize(resource.departmentId);
  const resourceOwnerUserId = normalize(resource.ownerUserId);

  if (!userId || !organizationId || actor.active === false) {
    return { allowed: false, reason: 'INVALID_ACTOR' };
  }

  if (!Object.values(ORG_ROLE).includes(role)) {
    return { allowed: false, reason: 'UNKNOWN_ROLE' };
  }

  if (!Object.values(ACCESS_ACTION).includes(action)) {
    return { allowed: false, reason: 'UNKNOWN_ACTION' };
  }

  if (!resourceOrganizationId || resourceOrganizationId !== organizationId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  if (!ROLE_PERMISSIONS[role].has(action)) {
    return { allowed: false, reason: 'ROLE_FORBIDDEN' };
  }

  if (role === ORG_ROLE.ORG_ADMIN || role === ORG_ROLE.EXECUTIVE || role === ORG_ROLE.AUDITOR) {
    return { allowed: true, reason: 'ROLE_ALLOWED' };
  }

  if (resourceDepartmentId && (!departmentId || resourceDepartmentId !== departmentId)) {
    return { allowed: false, reason: 'DEPARTMENT_MISMATCH' };
  }

  if (role === ORG_ROLE.OFFICER && [ACCESS_ACTION.PROJECT_UPDATE, ACCESS_ACTION.TASK_UPDATE].includes(action)) {
    if (!resourceOwnerUserId || resourceOwnerUserId !== userId) {
      return { allowed: false, reason: 'NOT_ASSIGNED_OWNER' };
    }
  }

  return { allowed: true, reason: 'ROLE_ALLOWED' };
}

export function canWorkAction(input) {
  return authorizeWorkAction(input).allowed;
}
