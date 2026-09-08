import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const gate=require('../legal-authority-transition-gate.js');

test('v7 blocks decisive precedent use until event-time and later-authority checks are resolved',()=>{
  const result=gate.evaluate({
    precedentReliedOn:true,
    precedentFactDate:'2017-01-01',
    currentFactDate:'2026-09-08',
    laterAuthoritySearchCompleted:true,
    ruleVersionCheckCompleted:true,
    contraryEvidenceCheckCompleted:true,
    laterAuthorities:[{id:'มท 0808.2/ว 0679',date:'2018-02-06',relevant:true,transitionResolved:false}]
  });
  assert.equal(result.status,'BLOCKED_LATER_AUTHORITY_CHECK');
  assert.equal(result.decisionLock,true);
});

test('v7 permits decision only after later authority effect is resolved',()=>{
  const result=gate.evaluate({
    precedentReliedOn:true,
    precedentFactDate:'2017-01-01',
    currentFactDate:'2026-09-08',
    laterAuthoritySearchCompleted:true,
    ruleVersionCheckCompleted:true,
    contraryEvidenceCheckCompleted:true,
    laterAuthorities:[{id:'มท 0808.2/ว 0679',date:'2018-02-06',relevant:true,transitionResolved:true}]
  });
  assert.equal(result.pass,true);
  assert.equal(result.decisionLock,false);
});
