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

test('returns fallback when no GP matches', () => {
  const result = router().route('ทดสอบระบบอวกาศ');
  assert.equal(result.fallback, true);
  assert.equal(result.selectedGpId, null);
});

test('is deterministic and does not mutate the catalog', () => {
  const route = router();
  const before = structuredClone(catalog);
  assert.equal(catalog.length, 20);
  assert.deepEqual(route.route('ตรวจร่าง TOR'), route.route('ตรวจร่าง TOR'));
  assert.deepEqual(catalog, before);
});
