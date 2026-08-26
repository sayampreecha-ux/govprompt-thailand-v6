import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard = fs.readFileSync(new URL('../work-dashboard-live-pilot.html', import.meta.url), 'utf8');
const commandCenter = fs.readFileSync(new URL('../work-command-center-pilot.html', import.meta.url), 'utf8');

test('live dashboard reads Supabase data and avoids innerHTML rendering of project data', () => {
  assert.match(dashboard, /supabase\.from\('projects'\)/);
  assert.match(dashboard, /textContent\s*=/);
  assert.doesNotMatch(dashboard, /innerHTML\s*=/);
  assert.match(dashboard, /work-operations-live-pilot\.html/);
});

test('command center is live Supabase + RLS, not mock pilot data', () => {
  assert.match(commandCenter, /getPilotSessionContext/);
  assert.match(commandCenter, /resolveWorkSession/);
  assert.match(commandCenter, /supabase\.from\('projects'\)/);
  assert.match(commandCenter, /supabase\.from\('tasks'\)/);
  assert.doesNotMatch(commandCenter, /constructionPilotProjects/);
  assert.doesNotMatch(commandCenter, /constructionPilotTasks/);
  assert.doesNotMatch(commandCenter, /pilot-data\.mjs/);
  assert.doesNotMatch(commandCenter, /pilot-task-data\.mjs/);
});

test('live pages expose production GP root separately from /pilot/', () => {
  assert.match(dashboard, /href="\.\.\/">GP หลัก/);
  assert.match(commandCenter, /href="\.\.\/">GP หลัก/);
});
