import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/work-admin-users/index.ts', import.meta.url), 'utf8');

test('admin user provisioning keeps service credential server-side only', () => {
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.doesNotMatch(source, /sb_secret_|service_role\s*[:=]\s*["'][A-Za-z0-9._-]+/i);
  assert.match(source, /admin\.auth\.getUser\(token\)/);
});

test('only authenticated ORG_ADMIN can provision workspace users', () => {
  assert.match(source, /organization_memberships/);
  assert.match(source, /callerMembership\.role !== "ORG_ADMIN"/);
  assert.match(source, /ORG_ADMIN_REQUIRED/);
  assert.doesNotMatch(source, /ALLOWED_ROLES[^\n]*ORG_ADMIN/);
});

test('new accounts use internal username auth and require first-login password change', () => {
  assert.match(source, /workspace\.govprompt\.local/);
  assert.match(source, /auth\.admin\.createUser/);
  assert.match(source, /email_confirm:\s*true/);
  assert.match(source, /app_metadata:[\s\S]*must_change_password:\s*true/);
  assert.match(source, /organization_memberships/);
  assert.match(source, /WORKSPACE_USER_CREATED/);
  assert.match(source, /auth_mode:\s*"admin_created_username_password"/);
  assert.match(source, /initial_password_change_required:\s*true/);
});

test('password value is never written to audit metadata or returned by the function', () => {
  const metadataBlock = source.match(/metadata_json:\s*\{([\s\S]*?)\n\s*\},\n\s*\}\);/i)?.[1] || '';
  assert.doesNotMatch(metadataBlock, /\bpassword\s*[:,]/i);
  const successReturn = source.match(/return reply\(req, 201, \{([^}]+)\}\);/)?.[1] || '';
  assert.doesNotMatch(successReturn, /\bpassword\s*[:,]/i);
});
