import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../work-tracking-pilot.html', import.meta.url), 'utf8');

test('pilot page exposes construction dashboard and local CSV preview without changing main menu', () => {
  assert.match(html, /ติดตามโครงการก่อสร้างกองช่าง/);
  assert.match(html, /id="csvFile"/);
  assert.match(html, /work-tracking-construction-template\.csv/);
  assert.match(html, /importProjectsFromCsv/);
});

test('pilot page does not add persistence or network writes before backend decision', () => {
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket/);
});

test('pilot page states that imported CSV remains browser-local in this phase', () => {
  assert.match(html, /ข้อมูลยังอยู่เฉพาะใน Browser/);
  assert.match(html, /ยังไม่ส่งขึ้นฐานข้อมูลหรือ Server/);
});
