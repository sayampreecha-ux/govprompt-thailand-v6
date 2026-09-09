import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('automation-pilot.js', 'utf8');

function api() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_AUTOMATION_PILOT;
}

test('offers a bounded internal-work pilot rather than arbitrary cloud actions', () => {
  assert.deepEqual([...api().workflows].map(item => item.id), [
    'PROJECT_DAILY_BRIEF', 'DEADLINE_WATCH', 'TASK_WEEKLY_SUMMARY'
  ]);
});

test('requires human approval for every automation definition', () => {
  const result = api().validate({
    name: 'สรุปโครงการประจำวัน', workflowType: 'PROJECT_DAILY_BRIEF',
    cadence: 'DAILY', runTime: '07:30', outputFormatId: 'easy-summary',
    requiresHumanApproval: false
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /ตรวจและอนุมัติ/);
});

test('accepts a complete safe definition and normalizes fields', () => {
  const result = api().validate({
    name: ' สรุปงานค้างทุกวัน ', workflow_type: 'PROJECT_DAILY_BRIEF',
    cadence: 'DAILY', run_time: '08:00:00', output_format_id: 'key-insights'
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, 'สรุปงานค้างทุกวัน');
  assert.equal(result.value.runTime, '08:00');
  assert.equal(result.value.requiresHumanApproval, true);
});

test('contains no browser persistence, credentials, or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source, /service[_-]?role|secret[_-]?key/i);
});
