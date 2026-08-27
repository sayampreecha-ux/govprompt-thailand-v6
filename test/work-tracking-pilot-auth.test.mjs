import test from 'node:test';
import assert from 'node:assert/strict';

import { PILOT_SUPABASE_PUBLISHABLE_KEY, assertPilotSupabaseConfig } from '../src/work-tracking/pilot-supabase-config.mjs';
import {
  claimPilotInvite,
  describeMagicLinkError,
  getMagicLinkRetrySeconds,
  loadOwnMemberships,
  requestPilotMagicLink,
  resolvePilotLoginEmail,
  signInPilotWithPassword,
} from '../src/work-tracking/pilot-auth.mjs';

test('pilot browser configuration exposes only a publishable key', () => {
  assert.equal(assertPilotSupabaseConfig(), true);
  assert.match(PILOT_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
  assert.doesNotMatch(PILOT_SUPABASE_PUBLISHABLE_KEY, /service_role|sb_secret_/i);
});

test('workspace username maps to internal auth email while legacy email remains compatible', () => {
  assert.equal(resolvePilotLoginEmail('  Somchai_01 '), 'somchai_01@workspace.govprompt.local');
  assert.equal(resolvePilotLoginEmail(' LEGACY@Example.COM '), 'legacy@example.com');
  assert.throws(() => resolvePilotLoginEmail('ก'), /VALID_USERNAME_REQUIRED/);
});

test('magic link request never auto-creates a new account', async () => {
  const calls = [];
  const client = {
    auth: {
      async signInWithOtp(args) { calls.push(args); return { data: { user: null, session: null }, error: null }; },
    },
  };

  const result = await requestPilotMagicLink({
    client,
    email: '  TEST@Example.COM ',
    redirectTo: 'https://example.test/work-pilot-login.html',
  });

  assert.equal(result.email, 'test@example.com');
  assert.deepEqual(calls[0], {
    email: 'test@example.com',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://example.test/work-pilot-login.html' },
  });
});

test('magic-link throttle errors become Thai retry guidance without exposing backend text', () => {
  const raw = { message: 'For security purposes, you can only request this after 13 seconds.', status: 429 };
  assert.equal(getMagicLinkRetrySeconds(raw), 13);
  const described = describeMagicLinkError(raw);
  assert.equal(described.retryAfterSeconds, 13);
  assert.match(described.message, /รออีก 13 วินาที/);
  assert.match(described.message, /ชื่อผู้ใช้และรหัสผ่าน/);
  assert.doesNotMatch(described.message, /security purposes|only request/i);
});

test('password sign-in accepts an admin-created username and does not create an account', async () => {
  const calls = [];
  const client = {
    auth: {
      async signInWithPassword(args) { calls.push(args); return { data: { session: { access_token: 'demo' } }, error: null }; },
    },
  };
  const result = await signInPilotWithPassword({ client, login: 'Somchai', password: 'example-password' });
  assert.equal(result.ok, true);
  assert.equal(result.email, 'somchai@workspace.govprompt.local');
  assert.deepEqual(calls, [{ email: 'somchai@workspace.govprompt.local', password: 'example-password' }]);
});

test('legacy email password sign-in remains supported during pilot migration', async () => {
  const calls = [];
  const client = { auth: { async signInWithPassword(args) { calls.push(args); return { data: {}, error: null }; } } };
  await signInPilotWithPassword({ client, email: ' TEST@Example.COM ', password: 'example-password' });
  assert.deepEqual(calls, [{ email: 'test@example.com', password: 'example-password' }]);
});

test('invite claim helper remains server-RPC only for legacy migration compatibility', async () => {
  const calls = [];
  const client = {
    async rpc(name) { calls.push(name); return { data: { ok: true, role: 'ORG_ADMIN' }, error: null }; },
  };
  const result = await claimPilotInvite(client);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['claim_work_pilot_invite']);
});

test('membership load reads only active memberships', async () => {
  const calls = [];
  const response = [{ organization_id: 'ORG-A', role: 'OFFICER', active: true }];
  const client = {
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return {
            async eq(column, value) { calls.push(['eq', column, value]); return { data: response, error: null }; },
          };
        },
      };
    },
  };
  const memberships = await loadOwnMemberships(client);
  assert.equal(memberships.length, 1);
  assert.deepEqual(calls.at(-1), ['eq', 'active', true]);
});
