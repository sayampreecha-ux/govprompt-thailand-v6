import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('index.html', 'utf8');

test('homepage communicates document capabilities without adding a new section', () => {
  assert.match(html, /ช่วยอ่าน สรุป ตรวจ และเปรียบเทียบเอกสารราชการได้/);
  assert.match(html, /placeholder="ค้นหา เช่น หนังสือราชการ กฎหมาย TOR โครงการ สรุปเอกสาร"/);
});

test('keeps quick actions compact and exposes document summary', () => {
  const quickBlock = html.match(/<div class="quick">([\s\S]*?)<\/div>/)?.[1] || '';
  const buttons = quickBlock.match(/<button\b/g) || [];
  assert.equal(buttons.length, 5);
  assert.match(quickBlock, />สรุปเอกสาร<\/button>/);
  assert.doesNotMatch(quickBlock, />ประชาสัมพันธ์<\/button>/);
});
