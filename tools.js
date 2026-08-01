(() => {
const tools=window.GOVPROMPT_TOOLS||[];
const grid=document.getElementById('toolGrid'),search=document.getElementById('toolSearch'),count=document.getElementById('count'),empty=document.getElementById('empty');
const modal=document.getElementById('modal'),fields=document.getElementById('fields'),form=document.getElementById('promptForm'),output=document.getElementById('output');
let category='ทั้งหมด',active=null,prompt='';

const norm=v=>String(v||'').toLowerCase().trim();
function render(){
 const q=norm(search.value);
 const list=tools.filter(t=>(category==='ทั้งหมด'||t.category===category)&&(!q||norm([t.id,t.name,t.desc,t.category].join(' ')).includes(q)));
 grid.innerHTML=list.map(t=>`<article class="tool-card"><div class="tool-top"><span class="tool-icon">${t.icon}</span><span class="tool-code">${t.id}</span></div><h3>${t.name}</h3><p>${t.desc}</p><button data-open="${t.id}">เริ่มใช้เครื่องมือนี้</button></article>`).join('');
 count.textContent=`${list.length} เครื่องมือ`; empty.classList.toggle('hidden',list.length>0); grid.classList.toggle('hidden',list.length===0);
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTool(b.dataset.open));
}
function openTool(id){
 active=tools.find(t=>t.id===id); if(!active)return;
 document.getElementById('toolCode').textContent=active.id; document.getElementById('toolName').textContent=active.name; document.getElementById('toolDesc').textContent=active.desc;
 fields.innerHTML=active.fields.map((f,i)=>`<label>${f}<textarea name="f${i}" ${i<2?'required':''} placeholder="ระบุข้อมูลจริง หากไม่ทราบให้เว้นว่าง"></textarea></label>`).join('');
 form.reset(); output.textContent='Prompt จะแสดงที่นี่'; output.classList.add('empty-result'); document.getElementById('copyBtn').disabled=true; document.getElementById('downloadBtn').disabled=true;
 modal.classList.remove('hidden'); document.body.classList.add('lock');
}
function close(){modal.classList.add('hidden');document.body.classList.remove('lock')}
form.onsubmit=e=>{
 e.preventDefault(); const fd=new FormData(form);
 const info=active.fields.map((f,i)=>`- ${f}: ${String(fd.get('f'+i)||'').trim()||'[ยังไม่ได้ระบุ]'}`).join('\n');
 prompt=`บทบาท\nคุณเป็น Government AI Copilot ผู้เชี่ยวชาญงานราชการไทย\n\nภารกิจ\n${active.name}\n\nข้อมูลจากผู้ใช้\n${info}\n\nรูปแบบผลลัพธ์\n- ใช้${document.getElementById('tone').value}\n- จัดหัวข้อและลำดับเนื้อหาให้เหมาะสม\n- แยกข้อเท็จจริง การวิเคราะห์ ความเสี่ยง และข้อเสนอแนะเมื่อเกี่ยวข้อง\n- ระบุข้อมูลที่ยังขาดก่อนนำไปใช้จริง\n\nข้อกำหนดสำคัญ\n1. ยึดข้อเท็จจริงและเอกสารที่ผู้ใช้ให้เป็นหลัก\n2. ห้ามสมมติชื่อบุคคล วันที่ เลขหนังสือ วงเงิน หรือข้อกฎหมาย\n3. หากข้อมูลไม่ครบ ให้ใช้คำว่า [ต้องตรวจสอบ/เพิ่มเติม]\n4. ห้ามอ้างกฎหมายหรือแหล่งข้อมูลที่ไม่สามารถยืนยันได้\n5. ตรวจชื่อ วันที่ ตัวเลข หน่วยงาน และข้อเสนอ ก่อนจบคำตอบ\n6. ผลลัพธ์เป็นร่าง ผู้ใช้ต้องตรวจทานก่อนนำไปใช้จริง\n\nโปรดดำเนินการทันที`;
 output.textContent=prompt; output.classList.remove('empty-result'); document.getElementById('copyBtn').disabled=false; document.getElementById('downloadBtn').disabled=false;
};
document.getElementById('copyBtn').onclick=async()=>{await navigator.clipboard.writeText(prompt);toast('คัดลอก Prompt แล้ว')};
document.getElementById('downloadBtn').onclick=()=>{const b=new Blob([prompt],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`${active.id}-${active.name}.txt`;a.click();URL.revokeObjectURL(u)};
document.getElementById('closeModal').onclick=close; modal.onclick=e=>{if(e.target===modal)close()}; document.onkeydown=e=>{if(e.key==='Escape')close()};
search.oninput=render;
document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;document.querySelectorAll('[data-cat]').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()});
function heroFind(){search.value=document.getElementById('heroSearch').value;category='ทั้งหมด';document.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('active',x.dataset.cat==='ทั้งหมด'));render();document.getElementById('tools').scrollIntoView({behavior:'smooth'})}
document.getElementById('heroSearchBtn').onclick=heroFind;document.getElementById('heroSearch').onkeydown=e=>{if(e.key==='Enter')heroFind()};
document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{document.getElementById('heroSearch').value=b.dataset.q;heroFind()});
document.getElementById('menuBtn').onclick=()=>document.getElementById('nav').classList.toggle('open');
document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>document.getElementById('nav').classList.remove('open'));
document.getElementById('proBtn').onclick=()=>toast('Professional กำลังพัฒนาอย่างต่อเนื่อง');
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000)}
render();
})();