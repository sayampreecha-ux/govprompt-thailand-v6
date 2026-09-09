import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { buildGmailRoleAlias, maskEmail } from '../src/work-tracking/pilot-role-alias.mjs';

test('builds deterministic Gmail plus aliases for each pilot role', () => {
  assert.equal(buildGmailRoleAlias('owner@gmail.com','EXECUTIVE'),'owner+gp-executive@gmail.com');
  assert.equal(buildGmailRoleAlias('owner+old@gmail.com','DIRECTOR'),'owner+gp-director@gmail.com');
  assert.equal(buildGmailRoleAlias('owner@gmail.com','OFFICER'),'owner+gp-officer@gmail.com');
  assert.equal(buildGmailRoleAlias('owner@gmail.com','AUDITOR'),'owner+gp-auditor@gmail.com');
});

test('rejects non-Gmail addresses for plus-alias helper', () => {
  assert.throws(()=>buildGmailRoleAlias('owner@example.com','EXECUTIVE'),/GMAIL_ALIAS_REQUIRED/);
});

test('maskEmail does not expose full local part', () => {
  const masked=maskEmail('owner+gp-director@gmail.com');
  assert.equal(masked.endsWith('@gmail.com'),true);
  assert.equal(masked.includes('owner+gp-director'),false);
});

test('role test page keeps email ephemeral and does not hard-code personal role aliases', async () => {
  const html=await fs.readFile(new URL('../work-role-test-accounts.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem|removeItem|clear)\s*\(/);
  assert.doesNotMatch(html,/[A-Za-z0-9._%+-]+\+gp-(?:executive|director|officer|auditor)@gmail\.com/i);
  assert.doesNotMatch(html,/<input[^>]+value=["'][^"']+@gmail\.com/i);
  assert.match(html,/requestPilotMagicLink/);
  assert.match(html,/ORG_ADMIN/);
});
