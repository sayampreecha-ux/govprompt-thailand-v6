import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const gate = require('../legal-authority-transition-gate.js');

test('blocks precedent-based decision until later authority is searched', () => {
  const r = gate.evaluate({
    precedentReliedOn: true,
    precedentFactDate: '2017-01-01',
    currentFactDate: '2026-09-08',
    laterAuthoritySearchCompleted: false,
    laterAuthorities: []
  });
  assert.equal(r.pass, false);
  assert.equal(r.decisionLock, true);
  assert.ok(r.blockers.includes('later-authority-search-not-completed'));
});

test('A.24/2567-style regression: later 6 Feb 2018 authority must be resolved before decision', () => {
  const r = gate.evaluate({
    precedentReliedOn: true,
    precedentFactDate: '2017-01-01',
    currentFactDate: '2026-09-08',
    laterAuthoritySearchCompleted: true,
    laterAuthorities: [{
      id: 'มท 0808.2/ว 0679',
      date: '2018-02-06',
      relevant: true,
      transitionResolved: false
    }]
  });
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('later-authority-effect-unresolved'));
});

test('allows decision only after relevant later authority effect is resolved', () => {
  const r = gate.evaluate({
    precedentReliedOn: true,
    precedentFactDate: '2017-01-01',
    currentFactDate: '2026-09-08',
    laterAuthoritySearchCompleted: true,
    laterAuthorities: [{
      id: 'มท 0808.2/ว 0679',
      date: '2018-02-06',
      relevant: true,
      transitionResolved: true
    }]
  });
  assert.equal(r.pass, true);
  assert.equal(r.decisionLock, false);
});

test('enforcement strips premature VERIFIED/HIGH_MATCH state', () => {
  const s = gate.enforceDecisionState({ qualityStatus: 'VERIFIED', caseMatch: 'HIGH_MATCH' }, {
    precedentReliedOn: true,
    precedentFactDate: '2017-01-01',
    currentFactDate: '2026-09-08',
    laterAuthoritySearchCompleted: true,
    laterAuthorities: [{ id: 'later-rule', relevant: true, transitionResolved: false }]
  });
  assert.equal(s.decisionLock, true);
  assert.equal(s.qualityStatus, 'UNVERIFIED');
  assert.equal(s.caseMatch, 'NOT_ASSESSED');
  assert.equal(s.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});
