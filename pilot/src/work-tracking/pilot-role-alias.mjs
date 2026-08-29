export const PILOT_TEST_ROLES = Object.freeze([
  Object.freeze({ role: 'EXECUTIVE', suffix: 'gp-executive' }),
  Object.freeze({ role: 'DIRECTOR', suffix: 'gp-director' }),
  Object.freeze({ role: 'OFFICER', suffix: 'gp-officer' }),
  Object.freeze({ role: 'AUDITOR', suffix: 'gp-auditor' }),
]);

const clean = (value) => String(value || '').trim().toLowerCase();

export function buildGmailRoleAlias(baseEmail, role) {
  const normalized = clean(baseEmail);
  const at = normalized.lastIndexOf('@');
  if (at <= 0) throw new Error('VALID_EMAIL_REQUIRED');

  const localRaw = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!['gmail.com', 'googlemail.com'].includes(domain)) {
    throw new Error('GMAIL_ALIAS_REQUIRED');
  }

  const spec = PILOT_TEST_ROLES.find((item) => item.role === role);
  if (!spec) throw new Error('UNKNOWN_ROLE');

  const local = localRaw.split('+')[0];
  if (!local) throw new Error('VALID_EMAIL_REQUIRED');
  return `${local}+${spec.suffix}@${domain}`;
}

export function maskEmail(email) {
  const normalized = clean(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return '';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}
