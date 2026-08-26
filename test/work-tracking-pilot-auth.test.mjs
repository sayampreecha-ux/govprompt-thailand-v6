import test from 'node:test';
import assert from 'node:assert/strict';

import { PILOT_SUPABASE_PUBLISHABLE_KEY, assertPilotSupabaseConfig } from '../src/work-tracking/pilot-supabase-config.mjs';
import {
  claimPilotInvite,
  describeMagicLinkError,
  getMagicLinkRetrySeconds,
  loadOwnMemberships,
  requestPilotMagicLink,
} from '../src/work-tracking/pilot-auth.mjs';

test('pilot browser configuration exposes only a publishable key', () => {
  assert.equal(assertPilotSupabaseConfig(), true);
  assert.match(PILOT_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
  assert.doesNotMatch(PILOT_SUPABASE_PUBLISHABLE_KEY, /service_role|sb_secret_/i);
});

test('magic link request normalizes email and uses explicit redirect', async () => {
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
    options: { shouldCreateUser: true, emailRedirectTo: 'https://example.test/work-pilot-login.html' },
  });
});

test('magic-link throttle errors become Thai retry guidance without exposing backend text', () => {
  const raw = { message: 'For security purposes, you can only request this after 13 seconds.', status: 429 };
  assert.equal(getMagicLinkRetrySeconds(raw), 13);
  const described = describeMagicLinkError(raw);
  assert.equal(described.retryAfterSeconds, 13);
  assert.match(described.message, /รออีก 13 วินาที/);
  assert.doesNotMatch(described.message, /security purposes|only request/i);
});

test('generic rate-limit response uses a conservative cooldown', () => {
  const described = describeMagicLinkError({ message: 'rate limit exceeded', status: 429 });
  assert.equal(described.retryAfterSeconds, 60);
  assert.match(described.message, /60 วินาที/);
});

test('invite claim is performed only through the audited RPC', async () => {
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
