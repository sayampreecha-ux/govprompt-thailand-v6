// Run: node tests/internal-control-policy.test.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('internal-control-policy.js','utf8');
const sandbox={window:{}};vm.runInNewContext(code,sandbox);
const p=sandbox.window.GOVPROMPT_INTERNAL_CONTROL;
const yes=['ทำ ปค.5','ประเมิน ปค.4','รายงาน ปค.1','ทำ ปค.6','แบบ วค.1','บริหารความเสี่ยง','ควบคุมภายใน','risk register'];
const no=['ทำ TOR','จัดซื้อจัดจ้าง','ช่วยเหลือน้ำท่วม','ร่างหนังสือราชการ','ประชุมสภา'];
let n=0;
for(const x of yes){assert.equal(p.applies(x),true,x);assert.match(p.augment('ฐาน',x),/Evidence|VERIFIED_SOURCE/);n+=2;}
for(const x of no){assert.equal(p.applies(x),false,x);assert.equal(p.augment('ฐาน',x),'ฐาน');n+=2;}
assert.equal(p.augment(p.augment('ฐาน','ปค.5'),'ปค.5'),p.augment('ฐาน','ปค.5'));n++;
const html=fs.readFileSync('index.html','utf8');assert.ok(html.includes('<script src="internal-control-policy.js"></script>'));n++;
assert.ok(html.includes('GOVPROMPT_INTERNAL_CONTROL?.augment'));n++;
console.log('PASS',n,'isolated policy checks');
