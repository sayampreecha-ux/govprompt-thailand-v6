(() => {
  'use strict';
  const MINIMUM_SCORE=0.18;
  const STOP_TERMS=new Set(['ช่วย','ต้องการ','เกี่ยวกับ','สำหรับ','และ','หรือ','การ','งาน','เรื่อง','ให้','ด้วย']);
  const DOMAIN_TOOLS=Object.freeze([
    {id:'DOMAIN_FINANCE',icon:'💰',category:'การเงิน การคลัง และเบิกจ่าย',name:'วิเคราะห์การเงิน การคลัง และการเบิกจ่าย',desc:'ตรวจสิทธิ เงื่อนไข ฐานอำนาจ หลักฐาน ขั้นตอน รายได้ ภาษี ค่าธรรมเนียม ลูกหนี้ และการจัดเก็บด้านการเงินการคลัง',fields:['คำถามหรือเรื่องที่ต้องการตรวจสอบ','ข้อเท็จจริงที่มี','หน่วยงาน/ผู้เกี่ยวข้อง','ช่วงเวลา/วันที่เกี่ยวข้อง','เอกสารหรือหลักฐานที่มี']},
    {id:'DOMAIN_PERSONNEL',icon:'👥',category:'งานบุคคล',name:'วิเคราะห์งานบุคคลท้องถิ่น',desc:'ช่วยเรื่องอัตรากำลัง ตำแหน่ง แต่งตั้ง โอน ย้าย เลื่อนระดับ และสิทธิบุคลากร',fields:['คำถามหรือภารกิจ','ข้อเท็จจริงที่มี','หน่วยงาน/ตำแหน่ง','ช่วงเวลา','เอกสารที่มี']},
    {id:'DOMAIN_ENGINEERING',icon:'🏗️',category:'งานช่างและวิศวกรรม',name:'ช่วยงานช่างและวิศวกรรม',desc:'ช่วย BOQ แบบ ปริมาณงาน งานก่อสร้าง ตรวจงาน ซ่อมแซม และข้อมูลทางวิศวกรรม',fields:['งานที่ต้องการ','รายละเอียด/ขนาด/ปริมาณ','ข้อเท็จจริงหรือสภาพพื้นที่','งบประมาณหรือสัญญา','เอกสาร/แบบ/BOQ ที่มี']},
    {id:'DOMAIN_HEALTH',icon:'🩺',category:'สาธารณสุขและ รพ.สต.',name:'ช่วยงานสาธารณสุขและ รพ.สต.',desc:'ช่วยงานบริหาร รพ.สต. เงินบำรุง แผน บุคลากร โครงการ และบริการสาธารณสุข',fields:['งานที่ต้องการ','หน่วยงาน/รพ.สต.','ข้อเท็จจริงที่มี','งบประมาณ/แผน','เอกสารที่มี']},
    {id:'DOMAIN_EDUCATION',icon:'🎓',category:'การศึกษา เยาวชน และการอบรม',name:'ช่วยงานการศึกษา เยาวชน และการอบรม',desc:'ช่วยโครงการ การศึกษา เยาวชน กีฬา การฝึกอบรม และกิจกรรมพัฒนาศักยภาพ',fields:['งานที่ต้องการ','กลุ่มเป้าหมาย','ข้อเท็จจริง','ระยะเวลา','งบประมาณ/เอกสาร']},
    {id:'DOMAIN_COUNCIL',icon:'🏛️',category:'สภาท้องถิ่น',name:'ช่วยงานสภาท้องถิ่น',desc:'ช่วยญัตติ ข้อบัญญัติ การประชุมสภา กระทู้ และขั้นตอนงานสภาท้องถิ่น',fields:['เรื่องที่ต้องการ','ข้อเท็จจริง','องค์กรปกครองส่วนท้องถิ่น','ขั้นตอนปัจจุบัน','เอกสารที่มี']}
  ]);
  const DOMAIN_INTENTS=Object.freeze([
    {tool:'DOMAIN_FINANCE',pattern:/เบิก|เบิกจ่าย|การเงิน|การคลัง|คลัง|ค่าใช้จ่าย|ค่าตอบแทน|เงิน|รายได้|ภาษี|ค่าธรรมเนียม|จัดเก็บ|เรียกเก็บ|ค้างชำระ|ลูกหนี้|เจ้าหนี้|ฎีกา|ค่าเช่า|เช่าซื้อ|ค่า\s*k|เงินบำรุง/i},
    {tool:'DOMAIN_PERSONNEL',pattern:/บุคคล|บุคลากร|อัตรากำลัง|ตำแหน่ง|แต่งตั้ง|โอน|ย้าย|เลื่อนระดับ|เงินเดือน|สรรหา|คัดเลือก|ประเมิน/i},
    {tool:'DOMAIN_ENGINEERING',pattern:/งานช่าง|วิศวกรรม|ก่อสร้าง|ถนน|สะพาน|อาคาร|boq|แบบก่อสร้าง|ปริมาณงาน|ซ่อมแซม|คสล|ค\.ส\.ล/i},
    {tool:'DOMAIN_HEALTH',pattern:/สาธารณสุข|รพ\.?สต|โรงพยาบาลส่งเสริมสุขภาพ|สุขภาพ|เงินบำรุง/i},
    {tool:'DOMAIN_EDUCATION',pattern:/การศึกษา|โรงเรียน|นักเรียน|เยาวชน|อบรม|ฝึกอบรม|กีฬา|ทุนการศึกษา/i},
    {tool:'DOMAIN_COUNCIL',pattern:/สภาท้องถิ่น|สภาอบจ|สภาเทศบาล|สภาอบต|ญัตติ|ข้อบัญญัติ|กระทู้|แปรญัตติ/i}
  ]);
  function normalize(value){return String(value??'').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()}
  function compact(value){return normalize(value).replace(/\s/g,'')}
  function unique(values){return [...new Set(values.filter(Boolean))]}
  function queryTerms(query){const text=normalize(query);const words=text.split(' ').filter(term=>term.length>1&&!STOP_TERMS.has(term));const thaiRuns=text.match(/[\u0E00-\u0E7F]{4,}/g)||[];const fragments=thaiRuns.flatMap(run=>{const terms=[];for(let length=4;length<=Math.min(run.length,8);length+=1){for(let start=0;start<=run.length-length;start+=1)terms.push(run.slice(start,start+length))}return terms});return unique([...words,...fragments])}
  function scoreTool(terms,query,tool){const name=compact(tool.name),description=compact(tool.desc),category=compact(tool.category),fields=compact((tool.fields||[]).join(' '));const matchedTerms=terms.filter(term=>[name,description,category,fields].some(text=>text.includes(term)));const score=matchedTerms.reduce((total,term)=>total+(name.includes(term)?.12:0)+(description.includes(term)?.08:0)+(category.includes(term)?.04:0)+(fields.includes(term)?.03:0),0);const exactNameBonus=compact(query).includes(name)?.55:0;return{tool,matchedTerms:unique(matchedTerms).slice(0,3),score:Math.min(1,score+exactNameBonus)}}
  function fallback(){return Object.freeze({selectedGpId:null,score:0,confidence:0,matchedReason:'ไม่พบ GP ที่ตรงกับคำค้นอย่างเพียงพอ',fallback:true})}
  function domainCandidate(query){const match=DOMAIN_INTENTS.find(intent=>intent.pattern.test(query));if(!match)return null;const tool=DOMAIN_TOOLS.find(item=>item.id===match.tool);return tool?{tool,matchedTerms:['domain-intent'],score:1}:null}
  function route(query){const text=normalize(query);const tools=Array.isArray(window.GOVPROMPT_TOOLS)?window.GOVPROMPT_TOOLS:[];if(!text||!tools.length)return fallback();const terms=queryTerms(text);const ranked=tools.map(tool=>scoreTool(terms,text,tool));const domain=domainCandidate(text);if(domain)ranked.push(domain);ranked.sort((left,right)=>right.score-left.score||left.tool.id.localeCompare(right.tool.id));const selected=ranked[0];if(!selected||selected.score<MINIMUM_SCORE)return fallback();return Object.freeze({selectedGpId:selected.tool.id,score:Number(selected.score.toFixed(2)),confidence:Number(selected.score.toFixed(2)),matchedReason:`ตรงกับ ${selected.tool.id}: ${selected.matchedTerms.join(', ')}`,fallback:false,tool:selected.tool})}
  window.GOVPROMPT_ROUTER=Object.freeze({route});
})();
