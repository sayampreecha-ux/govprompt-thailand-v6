import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('budget-authority-gate.js', 'utf8');

function gate() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_BUDGET_AUTHORITY_GATE;
}

test('FY2569 PAO is routed as a direct budget unit', () => {
  const result = gate().evaluate({ query: 'อบจ ขอรับเงินอุดหนุนเฉพาะกิจ ปี 2569' });
  assert.equal(result.status, 'DIRECT_UNIT_RULE_READY');
  assert.equal(result.budgetUnitStatus, 'DIRECT_BUDGET_UNIT');
  assert.equal(result.governorApproval.automatic, false);
  assert.equal(result.decisionLock, false);
});

test('FY2569 municipality is routed as a direct budget unit', () => {
  for (const org of ['เทศบาลนคร', 'เทศบาลเมือง', 'เทศบาลตำบล']) {
    const result = gate().evaluate({ query: org + ' ขอรับเงินอุดหนุนเฉพาะกิจ ปี 2569' });
    assert.equal(result.budgetUnitStatus, 'DIRECT_BUDGET_UNIT');
    assert.equal(result.governorApproval.automatic, false);
    assert.equal(result.decisionLock, false);
  }
});

test('subdistrict administrative organization requires direct-status verification', () => {
  const result = gate().evaluate({ query: 'อบต ขอรับเงินอุดหนุนเฉพาะกิจ ปี 2569' });
  assert.equal(result.status, 'VERIFY_BUDGET_AUTHORITY');
  assert.equal(result.budgetUnitStatus, 'VERIFY_DIRECT_STATUS_BY_OFFICIAL_SOURCE');
  assert.equal(result.decisionLock, true);
});

test('budget terminology alone never creates an automatic governor route', () => {
  const result = gate().evaluate({ query: 'อบจ เปลี่ยนแปลงเงินจัดสรร' });
  assert.equal(result.governorApproval.automatic, false);
  assert.equal(result.governorApproval.determination, 'NO_AUTO_ROUTE');
});

test('non-budget questions are not intercepted', () => {
  const result = gate().evaluate({ query: 'ตรวจ TOR ถนน คสล.' });
  assert.equal(result.applicable, false);
  assert.equal(result.status, 'NOT_APPLICABLE');
});
