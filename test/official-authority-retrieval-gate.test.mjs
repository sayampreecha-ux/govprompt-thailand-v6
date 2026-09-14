import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('core-engine.js', 'utf8');
function api(){const context={window:{}};vm.createContext(context);vm.runInContext(source,context);return context.window.GOVPROMPT_CORE_ENGINE.officialAuthorityRetrievalGate;}
function plain(v){return JSON.parse(JSON.stringify(v));}

const searchable = [
  'การเบิกจ่ายค่า K',
  'ค่า K เบิกได้ไหม',
  'ค่า K งานก่อสร้างปี 2569',
  'ค่าเช่าบ้านข้าราชการท้องถิ่น',
  'ย้ายจังหวัดแล้วยังเบิกค่าเช่าซื้อบ้านเดิมได้ไหม',
  'ค่าใช้จ่ายเดินทางไปราชการ',
  'แปรญัตติข้อบัญญัติงบประมาณได้ไหม'
];

test('regression 1-7: identifiable subjects start authority retrieval',()=>{
  const gate=api();
  for(const query of searchable){
    const result=gate.evaluateScope({query});
    assert.equal(result.subjectIdentifiable,true,query);
    assert.equal(result.status,'SEARCH_READY',query);
    assert.equal(result.action,'AUTHORITY_RETRIEVAL',query);
    assert.ok(result.searchVocabulary.length>0,query);
  }
});

test('regression 8: truly ambiguous query clarifies',()=>{
  const result=api().evaluateScope({query:'อันนี้เบิกได้ไหม'});
  assert.equal(result.subjectIdentifiable,false);
  assert.equal(result.status,'BLOCKED_MISSING_SCOPE');
  assert.equal(result.action,'CLARIFY_SUBJECT');
  assert.deepEqual(plain(result.searchVocabulary),[]);
});

test('does not block merely because WHO ORG TIME RULE BEFORE STAGE are absent',()=>{
  const result=api().evaluateScope({query:'ค่า K เบิกได้ไหม'});
  assert.equal(result.status,'SEARCH_READY');
});

test('search vocabulary is derived from the current case and discovered identifiers only',()=>{
  const gate=api();
  const first=plain(gate.buildSearchVocabulary({query:'การเบิกจ่ายค่า K'}));
  const second=plain(gate.buildSearchVocabulary({query:'ค่าเช่าบ้านข้าราชการท้องถิ่น'}));
  assert.ok(first.every(v=>!/(เดินทางไปราชการ|แต่งตั้ง|รับการคัดเลือก)/i.test(v)));
  assert.ok(second.every(v=>!/ค่า\s*K/i.test(v)));
  const withId=plain(gate.buildSearchVocabulary({query:'ค่า K งานก่อสร้างปี 2569',discoveredIdentifiers:['ระเบียบตัวอย่างที่ค้นพบ']}));
  assert.ok(withId.includes('ระเบียบตัวอย่างที่ค้นพบ'));
});

test('retrieval flow preserves later-rule, transition, conflict and contrary checks',()=>{
  const flow=plain(api().retrievalFlow);
  assert.deepEqual(flow,[
    'CURRENT_RULE','LATER_RULE_OR_AMENDMENT','TEMPORARY_MEASURE_OR_EXCEPTION','EXPIRY_OR_TRANSITION',
    'OFFICIAL_GUIDANCE_OR_PRECEDENT_WHEN_RELEVANT','CONFLICT_CHECK','CONTRARY_EVIDENCE_CHECK','APPLICABLE_RULE','DECISION_FACTS','FINAL_DECISION'
  ]);
});

test('authority sufficiency is independent from facts sufficiency',()=>{
  const gate=api();
  const partial=gate.assessDecisionSufficiency({authoritySufficient:true,factsSufficient:false});
  assert.equal(partial.status,'AUTHORITY_SUFFICIENT_FACTS_INSUFFICIENT');
  assert.equal(partial.finalDecisionAllowed,false);
  assert.equal(partial.nextAction,'ANSWER_VERIFIED_GENERAL_RULE_THEN_ASK_DECISIVE_FACTS_ONLY');
  const ready=gate.assessDecisionSufficiency({authoritySufficient:true,factsSufficient:true});
  assert.equal(ready.status,'FINAL_DECISION_READY');
  assert.equal(ready.finalDecisionAllowed,true);
});

test('policy forbids hard-coded permanent case answers and keeps existing gates',()=>{
  const policy=api().promptPolicy({query:'ค่า K เบิกได้ไหม',category:'การเงิน'});
  assert.match(policy,/ห้าม hard-code/);
  assert.match(policy,/Decision Gate, Multi-condition Gate, Legal Version Gate, Evidence Gate, Applicable Authority Check, Contrary Evidence Check และ Human Approval/);
  assert.match(policy,/Current Rule → Later Rule\/Amendment/);
});
