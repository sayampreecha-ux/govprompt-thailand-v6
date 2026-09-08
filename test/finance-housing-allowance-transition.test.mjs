import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gate = require('../legal-authority-transition-gate.js');

const resolvedCase = (overrides = {}) => ({
  precedentReliedOn: true,
  precedentFactDate: '2017-01-01',
  currentFactDate: '2026-09-08',
  laterAuthoritySearchCompleted: true,
  ruleVersionCheckCompleted: true,
  contraryEvidenceCheckCompleted: true,
  laterAuthorities: [
    {
      id: 'มท 0808.2/ว 0679',
      date: '2018-02-06',
      relevant: true,
      transitionResolved: true
    }
  ],
  ...overrides
});

test('1. housing-purchase allowance case passes only after later authority is resolved', () => {
  const r = gate.evaluate(resolvedCase());
  assert.equal(r.pass, true);
  assert.equal(r.decisionLock, false);
  assert.equal(r.status, 'PASS');
});

test('2. blocks when later-authority search has not been completed', () => {
  const r = gate.evaluate(resolvedCase({ laterAuthoritySearchCompleted: false }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('later-authority-search-not-completed'));
});

test('3. blocks when applicable rule-version check is incomplete', () => {
  const r = gate.evaluate(resolvedCase({ ruleVersionCheckCompleted: false }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('rule-version-check-not-completed'));
});

test('4. blocks when contrary-evidence check is incomplete', () => {
  const r = gate.evaluate(resolvedCase({ contraryEvidenceCheckCompleted: false }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('contrary-evidence-check-not-completed'));
});

test('5. blocks when effect of relevant later authority remains unresolved', () => {
  const r = gate.evaluate(resolvedCase({
    laterAuthorities: [{
      id: 'มท 0808.2/ว 0679',
      date: '2018-02-06',
      relevant: true,
      transitionResolved: false
    }]
  }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('later-authority-effect-unresolved'));
});

test('6. ignores an unresolved later authority explicitly found irrelevant to the case', () => {
  const r = gate.evaluate(resolvedCase({
    laterAuthorities: [{
      id: 'unrelated-authority',
      date: '2020-01-01',
      relevant: false,
      transitionResolved: false
    }]
  }));
  assert.equal(r.pass, true);
});

test('7. blocks when one of multiple relevant later authorities is unresolved', () => {
  const r = gate.evaluate(resolvedCase({
    laterAuthorities: [
      { id: 'มท 0808.2/ว 0679', date: '2018-02-06', relevant: true, transitionResolved: true },
      { id: 'later-current-rule', date: '2024-01-01', relevant: true, transitionResolved: false }
    ]
  }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('later-authority-effect-unresolved'));
});

test('8. blocks an impossible timeline where current facts predate precedent facts', () => {
  const r = gate.evaluate(resolvedCase({ currentFactDate: '2016-12-31' }));
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('timeline-not-resolved'));
});

test('9. does not invoke transition gate when no precedent is relied on', () => {
  const r = gate.evaluate({ precedentReliedOn: false });
  assert.equal(r.pass, true);
  assert.equal(r.status, 'NOT_APPLICABLE');
  assert.equal(r.decisionLock, false);
});

test('10. enforcement locks legal/finance decision while later-authority transition is unresolved', () => {
  const state = gate.enforceDecisionState(
    { workflow: 'gov.finance', decision: 'เบิกค่าเช่าซื้อบ้าน' },
    resolvedCase({
      laterAuthorities: [{
        id: 'มท 0808.2/ว 0679',
        date: '2018-02-06',
        relevant: true,
        transitionResolved: false
      }]
    })
  );
  assert.equal(state.decisionLock, true);
  assert.equal(state.qualityStatus, 'UNVERIFIED');
  assert.equal(state.workflowStatus, gate.BLOCKED_STATUS);
  assert.equal(state.nextAction, 'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK');
});

test('11. enforcement preserves decision state after all transition checks pass', () => {
  const state = gate.enforceDecisionState(
    { workflow: 'gov.finance', decision: 'เบิกค่าเช่าซื้อบ้าน', qualityStatus: 'VERIFIED' },
    resolvedCase()
  );
  assert.equal(state.decisionLock, undefined);
  assert.equal(state.qualityStatus, 'VERIFIED');
  assert.equal(state.transitionGate.pass, true);
});
