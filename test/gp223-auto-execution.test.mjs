import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const gateSource = readFileSync('procurement-classification-gate.js','utf8');
const engineSource = readFileSync('service-contract-natural-person.js','utf8');

function engine(){
  const context={window:{}};
  vm.createContext(context);
  vm.runInContext(gateSource,context);
  vm.runInContext(engineSource,context);
  return context.window.GOVPROMPT_SERVICE_TOR_ENGINE;
}

test('GP223 auto-execution accepts free-text support-service requests without a form',()=>{
  const result=engine().buildFromFreeText('ร่าง TOR จ้างเหมาบริการบุคคลธรรมดา ช่วยเสริมการปฏิบัติงานด้านข้อมูลและเอกสารการเงินและการเบิกจ่าย');
  assert.match(result,/GP223 AUTO-EXECUTION MODE/);
  assert.match(result,/ไม่เปิดแบบฟอร์มและไม่ถามคำถามต่อเนื่อง/);
  assert.match(result,/มท 0808\.2\/ว 5418/);
  assert.match(result,/มท 0803\.3\/ว 5389/);
  assert.match(result,/ว 727/);
});

test('GP223 does not stop when decisive details are absent',()=>{
  const result=engine().buildFromFreeText('ร่าง TOR จ้างเหมาบริการบุคคลธรรมดา');
  assert.match(result,/\[ให้กำหนดตามภารกิจจริง\]/);
  assert.match(result,/ร่าง TOR \+ จุดเสี่ยง/);
});
