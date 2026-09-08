import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const gate = require('../legal-authority-transition-gate.js');

test('blocks precedent decision until later-authority search is completed', () => {
  const r = gate.evaluate({ precedentReliedOn:true, precedentFactDate:'2017-01-01', currentFactDate:'2026-09-08' });
  assert.equal(r.pass, false);
  assert.equal(r.decisionLock, true);
  assert.ok(r.blockers.includes('later-authority-search-not-completed'));
});

test('อ.24/2567 style case remains blocked when ว 0679/2561 transition effect is unresolved', () => {
  const r = gate.evaluate({
    precedentReliedOn:true,
    precedentFactDate:'2017-01-01',
    currentFactDate:'2026-09-08',
    laterAuthoritySearchCompleted:true,
    ruleVersionCheckCompleted:true,
    contraryEvidenceCheckCompleted:true,
    laterAuthorities:[{ id:'มท 0808.2/ว 0679', date:'2018-02-06', relevant:true, transitionResolved:false }]
  });
  assert.equal(r.pass, false);
  assert.ok(r.blockers.includes('later-authority-effect-unresolved'));
});

test('passes only after time/version/transition/contrary checks are resolved', () => {
  const r = gate.evaluate({
    precedentReliedOn:true,
    precedentFactDate:'2017-01-01',
    currentFactDate:'2026-09-08',
    laterAuthoritySearchCompleted:true,
    ruleVersionCheckCompleted:true,
    contraryEvidenceCheckCompleted:true,
    laterAuthorities:[{ id:'มท 0808.2/ว 0679', date:'2018-02-06', relevant:true, transitionResolved:true }]
  });
  assert.equal(r.pass, true);
  assert.equal(r.decisionLock, false);
});
