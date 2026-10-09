import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
function harness(){
 const state={selected:null,notice:'',field:{value:''},search:{value:''}};
 const sandbox={window:{},document:{getElementById:()=>({focus(){},classList:{add(){}},scrollIntoView(){}})},fields:{querySelector:()=>state.field},search:state.search,render(){},openTool(id){state.selected=id},toast(x){state.notice=x}};
 vm.runInNewContext(fs.readFileSync('internal-control-policy.js','utf8'),sandbox);
 const route=html.match(/function routeFrom\(text\)\{[\s\S]*?\}\nfunction openCategory/)[0].replace(/\nfunction openCategory$/,'');
 vm.runInNewContext(route,sandbox);return {state,sandbox};
}
test('production keeps the established primary composer and send wiring',()=>{
 assert.equal((html.match(/id="mainPrompt"/g)||[]).length,1);
 assert.equal((html.match(/id="sendBtn"/g)||[]).length,1);
 assert.ok(html.includes("document.getElementById('sendBtn').onclick="));
 assert.ok(html.includes('form.dispatchEvent(new Event(\'submit\''));
 assert.ok(!fs.readFileSync('external-ai-actions.js','utf8').includes("document.getElementById('tools')?.classList.add('hidden')"));
});
test('primary entry preserves report type, user facts and year',()=>{
 for(const [q,id] of [['จัดทำ ปค.5 กองคลัง ปี 2570','GPIC01'],['ร่าง ปค 4 สำนักปลัด','GPIC02'],['ทำ ปค.1 ปี2570','GPIC03'],['ข้อมูล ปค6 ผู้ตรวจสอบภายใน','GPIC04'],['RISK REGISTER กองคลัง','GPIC05']]){
 const {state,sandbox}=harness();sandbox.routeFrom(q);assert.equal(state.selected,id);assert.equal(state.field.value,q);
 }
});
test('unsupported official forms never silently become PK5',()=>{
 for(const q of ['ร่าง ปค.2','ทำ ปค.3','แบบ วค.1','แบบ วค.2']){const {state,sandbox}=harness();sandbox.routeFrom(q);assert.equal(state.selected,null);assert.ok(state.notice);}
});
test('unrelated and out of range requests do not select internal control',()=>{
 for(const q of ['ทำ ปค.50','เลข ปค.15','ร่าง TOR รถยนต์','ช่วยน้ำท่วม','สรุปรายงานประชุม','ติดตามผลโครงการถนน','สวัสดีตอนเช้า']){const {state,sandbox}=harness();sandbox.routeFrom(q);assert.equal(state.selected,null,q);assert.equal(state.search.value,q);}
});
test('TOR wrapper accepts the existing immutable engine without mutation',()=>{
 const original=Object.freeze({build:()=> 'TOR draft',buildFromFreeText:()=> 'free draft'});
 const sandbox={window:{GOVPROMPT_SERVICE_TOR_ENGINE:original}};
 vm.runInNewContext(fs.readFileSync('tor-v159-gate.js','utf8'),sandbox);
 assert.equal(original.build(),'TOR draft');
 assert.ok(sandbox.window.GOVPROMPT_SERVICE_TOR_ENGINE.build({}).includes('TOR GOVERNANCE GATE'));
 assert.ok(sandbox.window.GOVPROMPT_SERVICE_TOR_ENGINE.buildFromFreeText('x').includes('Human Approval'));
});
