import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('automation-pilot.html', 'utf8');

test('automation pilot remains hidden from search and uses existing organization auth', () => {
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /organization_memberships/);
  assert.match(html, /claim_work_pilot_invite/);
  assert.doesNotMatch(html, /service[_-]?role/i);
});

test('all generated reports stop for human approval', () => {
  assert.match(html, /HUMAN APPROVAL/);
  assert.match(html, /WAITING_APPROVAL/);
  assert.match(html, /review_automation_run/);
  assert.match(html, /ไม่มีการส่งอีเมล เผยแพร่ หรืออนุมัติแทนผู้มีอำนาจ/);
});

test('uses RPC mutations and has no arbitrary connector or secret fields', () => {
  assert.match(html, /create_automation_definition/);
  assert.match(html, /set_automation_definition_status/);
  assert.match(html, /run_automation_now/);
  assert.doesNotMatch(html, /client_secret|access_token|refresh_token/i);
});
