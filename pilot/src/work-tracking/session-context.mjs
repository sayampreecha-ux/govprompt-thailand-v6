import { ORG_ROLE } from './access-control.mjs';

const normalize = (value) => String(value || '').trim();

export function resolveWorkSession({ session = {}, memberships = [], requestedOrganizationId = '' } = {}) {
  const userId = normalize(session.userId || session.user?.id);
  if (!userId) {
    return { ok: false, code: 'AUTH_REQUIRED', actor: null, availableOrganizations: [] };
  }

  const mustChangePassword = session.mustChangePassword === true
    || session.must_change_password === true
    || session.user?.app_metadata?.must_change_password === true;
  if (mustChangePassword) {
    return { ok: false, code: 'PASSWORD_CHANGE_REQUIRED', actor: null, availableOrganizations: [] };
  }

  const active = memberships
    .filter((item) => item && item.active !== false)
    .filter((item) => normalize(item.userId || item.user_id) === userId)
    .map((item) => ({
      organizationId: normalize(item.organizationId || item.organization_id),
      departmentId: normalize(item.departmentId || item.department_id),
      role: normalize(item.role),
      active: true,
    }))
    .filter((item) => item.organizationId && Object.values(ORG_ROLE).includes(item.role));

  const availableOrganizations = [...new Set(active.map((item) => item.organizationId))];
  if (!active.length) {
    return { ok: false, code: 'MEMBERSHIP_REQUIRED', actor: null, availableOrganizations };
  }

  const requested = normalize(requestedOrganizationId);
  let membership;
  if (requested) {
    membership = active.find((item) => item.organizationId === requested);
    if (!membership) {
      return { ok: false, code: 'ORGANIZATION_NOT_ALLOWED', actor: null, availableOrganizations };
    }
  } else if (active.length === 1) {
    [membership] = active;
  } else {
    return { ok: false, code: 'ORGANIZATION_SELECTION_REQUIRED', actor: null, availableOrganizations };
  }

  return {
    ok: true,
    code: 'READY',
    actor: Object.freeze({
      userId,
      organizationId: membership.organizationId,
      departmentId: membership.departmentId,
      role: membership.role,
      active: true,
    }),
    availableOrganizations,
  };
}
