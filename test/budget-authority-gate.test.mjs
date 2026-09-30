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


test('reserved budget with commitment is not routed to rule 30 automatically', () => {
  const result = gate().evaluate({
    query: 'อบจ เงินกันกรณีมิได้ก่อหนี้ผูกพัน ต่อมาทำสัญญาแล้ว ก่อหนี้ผูกพันแล้ว'
  });
  assert.equal(result.budgetStatus, 'COMMITTED');
  assert.equal(result.authorityRoute.primaryRuleCandidate, 'CHECK_RULE_31_FIRST');
  assert.equal(result.authorityRoute.rule30.applicableByKeyword, false);
});

test('reserved budget without commitment requires status-aware rule selection', () => {
  const result = gate().evaluate({
    query: 'อบจ เงินกันกรณีมิได้ก่อหนี้ผูกพัน'
  });
  assert.equal(result.budgetStatus, 'UNCOMMITTED');
  assert.equal(result.authorityRoute.primaryRuleCandidate, 'CHECK_RULE_30_IF_BUDGET_STATEMENT_CHANGE');
});

test('council procedure is not automatic from budget keyword', () => {
  const result = gate().evaluate({
    query: 'อบจ เงินกัน ก่อหนี้ผูกพันแล้ว'
  });
  assert.equal(result.authorityRoute.councilProcedure.candidate, 'NOT_AUTOMATIC');
});

test('rule 38 is treated as procedure, not substantive budget authority', () => {
  const result = gate().evaluate({
    query: 'อบจ ญัตติแก้ไขมติสภาเรื่องเงินกัน ก่อหนี้ผูกพันแล้ว'
  });
  assert.equal(result.authorityRoute.councilProcedure.rule38.includes('กระบวนการเสนอญัตติ'), true);
});


test('RPH maintenance fund non-committed reservation routes through rule 9 to financial rule 61 and council approval', () => {
  const result = gate().evaluate({
    query: 'อบจ เงินบำรุง รพ.สต. กันเงินกรณีมิได้ก่อหนี้ผูกพัน รายการค่าครุภัณฑ์'
  });
  assert.equal(result.rphMaintenanceFund, true);
  assert.equal(result.rphReservationRoute.initialWithholding.trigger, true);
  assert.match(result.rphReservationRoute.initialWithholding.authorityChain[0], /ข้อ 9/);
  assert.equal(result.rphReservationRoute.initialWithholding.authorityChain[1], 'ระเบียบการเงิน อปท. พ.ศ. 2566 ข้อ 61');
  assert.equal(result.rphReservationRoute.initialWithholding.authorityChain[2], 'เสนอขออนุมัติต่อสภาท้องถิ่น');
});

test('RPH maintenance fund reserved item amendment routes to rule 30', () => {
  const result = gate().evaluate({
    query: 'อบจ แก้ไขมติสภา เงินบำรุง รพ.สต. รายการที่กันเงินไว้แล้ว แก้ไขคำชี้แจง'
  });
  assert.equal(result.rphMaintenanceFund, true);
  assert.equal(result.rphReservationRoute.amendReservedItem.trigger, true);
  assert.match(result.rphReservationRoute.amendReservedItem.authorityChain[0], /ข้อ 30/);
  assert.equal(result.rphReservationRoute.amendReservedItem.authorityChain.some(x => /ข้อ 29 ประกอบข้อ 30/.test(x)), true);
});

test('RPH reserved investment item substantive change requires rule 29 with rule 30', () => {
  const result = gate().evaluate({
    query: 'อบจ แก้ไขมติสภา เงินบำรุง รพ.สต. รายการที่กันเงินไว้แล้ว เปลี่ยนปริมาณ'
  });
  assert.equal(result.rphMaintenanceFund, true);
  assert.equal(result.rphReservationRoute.amendReservedItem.trigger, true);
  assert.equal(result.rphReservationRoute.decisionLock, true);
  assert.equal(result.rphReservationRoute.amendReservedItem.authorityChain.some(x => /ข้อ 29 ประกอบข้อ 30/.test(x)), true);
});
