import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const template = fs.readFileSync(new URL('../work-tracking-template-th.csv', import.meta.url), 'utf8');

test('Thai CSV template starts with UTF-8 BOM for Excel compatibility', () => {
  assert.equal(template.charCodeAt(0), 0xFEFF);
});

test('Thai CSV template contains only live-persisted import headers and no sample data row', () => {
  const lines = template.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'รหัสโครงการ,ชื่อโครงการ,กอง,ประเภทโครงการ,ผู้รับผิดชอบ,พื้นที่,เลขที่สัญญา,ผู้รับจ้าง,งบประมาณ,เบิกจ่าย,แผน,ผลจริง,วันเริ่ม,กำหนดเสร็จ,สถานะ,ปัญหา');
  assert.doesNotMatch(lines[0], /วันที่อัปเดต/);
});
