import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('quality-gate.js', 'utf8');
function gate(){const context={window:{}};vm.createContext(context);vm.runInContext(source,context);return context.window.GOVPROMPT_QUALITY_GATE;}

const complete={
  enabled:true,
  factsChecked:true,
  applicableAuthorityChecked:true,
  legalVersionChecked:true,
  ruleChainChecked:true,
  counterCheckCompleted:true,
  primarySourceChecked:true,
  unresolvedPotentialReversals:[],
  conclusionLevel:'ยืนยันได้เมื่อครบเงื่อนไข'
};

const cases=[
  ['ค่าเช่าบ้าน: สิทธิต่อเนื่องข้ามท้องที่', {...complete}],
  ['ค่าเดินทาง: มีข้อยกเว้นฐานอื่น', {...complete, conclusionLevel:'ยืนยันได้'}],
  ['พัสดุ: TOR ดูทำได้แต่มีข้อห้าม', {...complete}],
  ['บุคคล: คุณสมบัติครบแต่มีเหตุห้าม', {...complete}],
  ['สภาท้องถิ่น: มติผ่านแต่ต้องตรวจขั้นตอน', {...complete}],
  ['งบประมาณ: มีเงินแต่ต้องตรวจอำนาจและหมวดจ่าย', {...complete}],
  ['ค่าเช่าบ้าน: ขาด rule chain', {...complete, ruleChainChecked:false}],
  ['ค่าเดินทาง: ขาด counter-check', {...complete, counterCheckCompleted:false}],
  ['พัสดุ: ยังมีฐานกลับผลค้าง', {...complete, unresolvedPotentialReversals:['ตรวจข้อยกเว้นการจัดซื้อเฉพาะกรณี']}],
  ['บุคคล: ยังไม่ได้ตรวจฉบับกฎหมาย', {...complete, legalVersionChecked:false}]
];

test('Decision Integrity Gate regression: 10 cross-domain cases',()=>{
  const api=gate();
  assert.equal(cases.length,10);
  cases.forEach(([name,input],index)=>{
    const result=api.decisionIntegrityCheck(input);
    if(index<6){
      assert.equal(result.pass,true,`${name} should pass when all integrity checks are complete`);
      assert.equal(result.status,'PASS');
    }else{
      assert.equal(result.pass,false,`${name} should block when a material integrity check remains unresolved`);
      assert.equal(result.decisionLock,true);
      assert.ok(result.blockers.length>0);
    }
  });
});

test('only three conclusion levels are accepted',()=>{
  const api=gate();
  for(const level of ['ยืนยันได้','ยืนยันได้เมื่อครบเงื่อนไข','ยังยืนยันไม่ได้']){
    assert.equal(api.decisionIntegrityCheck({...complete,conclusionLevel:level}).pass,true);
  }
  const invalid=api.decisionIntegrityCheck({...complete,conclusionLevel:'ได้แน่นอน'});
  assert.equal(invalid.pass,false);
  assert.ok(invalid.blockers.includes('invalid-or-missing-conclusion-level'));
});

test('search-not-found cannot silently clear unresolved reversal risks',()=>{
  const api=gate();
  const result=api.decisionIntegrityCheck({...complete,unresolvedPotentialReversals:['ค้นแหล่งปฐมภูมิสำคัญยังไม่ครบ']});
  assert.equal(result.pass,false);
  assert.ok(result.blockers.includes('potential-reversal-unresolved'));
});
