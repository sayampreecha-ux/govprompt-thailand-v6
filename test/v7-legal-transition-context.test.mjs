import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadContext(){
  const code=fs.readFileSync(new URL('../shared-context.js',import.meta.url),'utf8');
  const sandbox={window:{}};
  vm.createContext(sandbox);
  vm.runInContext(code,sandbox);
  return sandbox.window.GOVPROMPT_CONTEXT;
}

test('v7 detects precedent-based user input and engages transition hard gate state',()=>{
  const ctx=loadContext();
  ctx.selectTool({id:'GP005',category:'กฎหมาย'});
  ctx.setUserInputs({ข้อเท็จจริง:'อ้างคำพิพากษาศาลปกครองสูงสุดที่ อ.24/2567 และ ว 0679/2561'});
  const state=ctx.get();
  assert.equal(state.legalTransition.precedentReliedOn,true);
  assert.equal(state.legalTransition.laterAuthoritySearchCompleted,false);
  assert.equal(state.legalTransition.ruleVersionCheckCompleted,false);
  assert.equal(state.legalTransition.contraryEvidenceCheckCompleted,false);
});

test('v7 context exposes setter for resolved transition analysis',()=>{
  const ctx=loadContext();
  ctx.setLegalTransition({precedentReliedOn:true,precedentFactDate:'2017-01-01',currentFactDate:'2026-09-08',laterAuthoritySearchCompleted:true,ruleVersionCheckCompleted:true,contraryEvidenceCheckCompleted:true,laterAuthorities:[{id:'มท 0808.2/ว 0679',transitionResolved:true}]});
  const state=ctx.get();
  assert.equal(state.legalTransition.laterAuthoritySearchCompleted,true);
  assert.equal(state.legalTransition.laterAuthorities[0].transitionResolved,true);
});
