// 120 deterministic intent-to-policy acceptance scenarios; no official-source or browser claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('internal-control-policy.js','utf8');
const context={window:{}};vm.runInNewContext(js,context);
const policy=context.window.GOVPROMPT_INTERNAL_CONTROL;
const cases=[
['GPIC01','ปค.5'],['GPIC02','ปค.4'],['GPIC03','ปค.1'],
['GPIC04','ปค.6'],['GPIC05','บริหารความเสี่ยง']
];
const prefixes=['จัดทำ ','ช่วยทำ ','ร่าง ','ขอ ','ประเมิน ','เตรียม ','ช่วยจัดทำ ','ตรวจสอบ ','สรุป ','ทำ ','วิเคราะห์ ','ปรับปรุง '];
const suffixes=[' กองคลัง',' สำนักปลัด'];
const routing=html.match(/function routeFrom\(text\)\{[\s\S]*?\}\nfunction openCategory/);
assert.ok(routing,'routeFrom missing');
const sandbox={window:{GOVPROMPT_INTERNAL_CONTROL:policy},document:{getElementById:(id)=>({focus(){},scrollIntoView(){}})},fields:{querySelector:()=>({value:''})},search:{value:''},render(){},openTool(id){sandbox.selected=id}};
vm.runInNewContext(routing[0].replace(/\nfunction openCategory$/,''),sandbox);
let count=0;
for(const [expected,term] of cases)for(const prefix of prefixes)for(const suffix of suffixes){
const query=prefix+term+suffix;
assert.equal(policy.applies(query),true,query);
sandbox.selected=null;
sandbox.routeFrom(query);
assert.equal(sandbox.selected,expected,query);
const generated=policy.augment('BASE',query);
assert.ok(generated.includes('VERIFIED_SOURCE')&&generated.includes('Decision Lock'),query);
count++;
}
assert.equal(count,120);
for(const query of ['TOR จ้างเหมาบริการ','ขอซื้อรถ','ช่วยเหลือน้ำท่วม']){
assert.equal(policy.applies(query),false);
assert.equal(policy.augment('BASE',query),'BASE');
}
for(const id of cases.map(x=>x[0]))assert.ok(html.includes("id:'"+id+"'"),id);
assert.ok(html.includes('ควบคุมภายในและบริหารความเสี่ยง'));
console.log('PASS',count,'deterministic acceptance scenarios');
