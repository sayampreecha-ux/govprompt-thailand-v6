import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = readFileSync('index.html', 'utf8');
const catalogMatch = indexHtml.match(/window\.GOVPROMPT_TOOLS=(\[.*?\]);/);
const catalog = JSON.parse(catalogMatch?.[1] || '[]');

function router() {
  const context = { window: { GOVPROMPT_TOOLS: structuredClone(catalog) } };
  vm.createContext(context);
  vm.runInContext(readFileSync('gp-router.js', 'utf8'), context);
  return context.window.GOVPROMPT_ROUTER;
}

test('routes a matching procurement query', () => {
  assert.equal(router().route('ตรวจร่าง TOR').selectedGpId, 'GP009');
});

test('routes a query in another category', () => {
  assert.equal(router().route('เขียนข่าวประชาสัมพันธ์').selectedGpId, 'GP016');
});

test('routes finance questions from the primary composer', () => {
  assert.equal(router().route('ค่า K 2% เบิกได้ไหม').selectedGpId, 'DOMAIN_FINANCE');
  assert.equal(router().route('การเงิน การคลัง และเบิกจ่าย').selectedGpId, 'DOMAIN_FINANCE');
});

test('routes uncovered government domains instead of showing zero tools', () => {
  assert.equal(router().route('ช่วยจัดทำแผนอัตรากำลัง').selectedGpId, 'DOMAIN_PERSONNEL');
  assert.equal(router().route('ทำ BOQ ถนน ค.ส.ล.').selectedGpId, 'DOMAIN_ENGINEERING');
  assert.equal(router().route('ระบบเงินบำรุง รพ.สต.').selectedGpId, 'DOMAIN_FINANCE');
  assert.equal(router().route('งานสภาท้องถิ่น').selectedGpId, 'DOMAIN_COUNCIL');
});

test('returns fallback when no government-work domain matches', () => {
  const result = router().route('ทดสอบระบบอวกาศ');
  assert.equal(result.fallback, true);
  assert.equal(result.selectedGpId, null);
});

test('is deterministic and does not mutate the source catalog', () => {
  const route = router();
  const before = structuredClone(catalog);
  assert.equal(catalog.length, 20);
  assert.deepEqual(route.route('ตรวจร่าง TOR'), route.route('ตรวจร่าง TOR'));
  assert.deepEqual(catalog, before);
});
