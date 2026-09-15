(() => {
  'use strict';

  const PROVIDERS = Object.freeze({ chatgpt:'https://chatgpt.com/', gemini:'https://gemini.google.com/' });
  const esc = value => (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(value) : String(value).replace(/["\\]/g,'\\$&');
  let resultView = null;
  let homeScrollY = 0;

  function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2600)}
  function getPrompt(){const output=document.getElementById('output');if(!output||output.classList.contains('empty-result'))return '';return String(output.textContent||'').trim()}
  function selectPromptForManualCopy(){const output=document.getElementById('output'),selection=window.getSelection?.(),range=document.createRange?.();if(!output||!selection||!range)return;range.selectNodeContents(output);selection.removeAllRanges();selection.addRange(range)}
  async function copyPrompt(){const prompt=getPrompt();if(!prompt){toast('กรุณาสร้าง Prompt ก่อน');return false}try{if(!navigator.clipboard?.writeText)throw new Error('clipboard-unavailable');await navigator.clipboard.writeText(prompt);return true}catch(_){selectPromptForManualCopy();toast('คัดลอกอัตโนมัติไม่ได้ — เลือก Prompt ให้แล้ว กรุณาคัดลอกด้วยตนเอง');return false}}
  async function openProvider(provider){const url=PROVIDERS[provider],prompt=getPrompt();if(!url)return;if(!prompt){toast('กรุณาสร้าง Prompt ก่อน');return}const copied=await copyPrompt();const opened=window.open(url,'_blank','noopener,noreferrer');if(!opened){toast(copied?'คัดลอก Prompt แล้ว — กรุณาเปิด AI แล้ววางข้อความ':'เปิด AI ไม่สำเร็จ — Prompt ยังอยู่ในหน้านี้');return}toast(copied?'คัดลอก Prompt แล้ว — วางใน AI และกดส่งได้เลย':'เปิด AI แล้ว — กรุณาคัดลอก Prompt จากหน้านี้แล้ววาง')}

  function ensureResultView(){
    if(resultView)return resultView;
    const view=document.createElement('section');
    view.id='gpResultView';
    view.hidden=true;
    view.style.cssText='max-width:900px;margin:0 auto;padding:18px 16px 96px;min-height:100vh';
    view.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px"><button type="button" id="gpBackHome" class="btn" style="width:auto">← กลับ</button><strong style="font-size:18px">GovPrompt Thailand</strong></div><div class="result" style="margin:0"><div style="font-size:13px;color:var(--muted,#667085);font-weight:700">คำสั่งพร้อมแล้ว</div><h2 id="gpResultTitle" style="margin:6px 0 4px">พร้อมทำงานต่อ</h2><div id="gpResultCategory" style="font-size:14px;color:var(--muted,#667085);margin-bottom:14px"></div><div id="gpResultActions" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0"><button type="button" data-provider="chatgpt" class="btn primary">ทำต่อใน ChatGPT</button><button type="button" data-provider="gemini" class="btn primary">ทำต่อใน Gemini</button><button type="button" data-copy-result class="btn">คัดลอก Prompt</button></div><details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">ดู Prompt / รายละเอียด</summary><pre id="gpResultPrompt" style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:10px"></pre></details></div>`;
    document.body.appendChild(view);
    view.querySelector('#gpBackHome').onclick=showHome;
    view.querySelector('[data-provider="chatgpt"]').onclick=()=>openProvider('chatgpt');
    view.querySelector('[data-provider="gemini"]').onclick=()=>openProvider('gemini');
    view.querySelector('[data-copy-result]').onclick=async()=>{if(await copyPrompt())toast('คัดลอก Prompt แล้ว')};
    const media=window.matchMedia('(max-width:680px)');
    const actions=view.querySelector('#gpResultActions');
    const responsive=()=>actions.style.gridTemplateColumns=media.matches?'1fr':'repeat(3,minmax(0,1fr))';
    responsive();media.addEventListener?.('change',responsive);
    resultView=view;
    return view;
  }

  function showResult(){
    const prompt=getPrompt();if(!prompt)return false;
    const view=ensureResultView();
    homeScrollY=window.scrollY||0;
    [...document.body.children].forEach(el=>{if(el!==view&&el.id!=='toast'&&el.tagName!=='SCRIPT')el.dataset.gpHomeDisplay=el.style.display||''});
    [...document.body.children].forEach(el=>{if(el!==view&&el.id!=='toast'&&el.tagName!=='SCRIPT')el.style.display='none'});
    view.hidden=false;view.style.display='block';
    const name=document.getElementById('toolName')?.textContent?.trim()||'พร้อมทำงานต่อ';
    const category=window.GOVPROMPT_CONTEXT?.get?.()?.category||'';
    view.querySelector('#gpResultTitle').textContent=name;
    view.querySelector('#gpResultCategory').textContent=category;
    view.querySelector('#gpResultPrompt').textContent=prompt;
    document.body.style.overflow='';
    window.scrollTo({top:0,behavior:'instant'});
    return true;
  }

  function showHome(){
    const view=ensureResultView();view.hidden=true;view.style.display='none';
    [...document.body.children].forEach(el=>{if(el!==view&&el.dataset.gpHomeDisplay!==undefined){el.style.display=el.dataset.gpHomeDisplay;delete el.dataset.gpHomeDisplay}});
    const modal=document.getElementById('modal');if(modal)modal.classList.add('hidden');
    document.body.style.overflow='';
    window.scrollTo({top:homeScrollY,behavior:'instant'});
  }

  function buildActionLayer(){const result=document.querySelector('.result');if(!result||document.getElementById('externalAiActions'))return;const bar=document.createElement('div');bar.id='externalAiActions';bar.setAttribute('aria-label','ทำงานต่อด้วย AI ภายนอก');bar.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0';bar.innerHTML='<button type="button" data-provider="chatgpt" class="btn primary">ทำต่อใน ChatGPT</button><button type="button" data-provider="gemini" class="btn primary">ทำต่อใน Gemini</button><button type="button" data-copy-external class="btn">คัดลอก Prompt</button>';const pre=result.querySelector('#output');result.insertBefore(bar,pre||null);bar.querySelector('[data-provider="chatgpt"]').onclick=()=>openProvider('chatgpt');bar.querySelector('[data-provider="gemini"]').onclick=()=>openProvider('gemini');bar.querySelector('[data-copy-external]').onclick=async()=>{if(await copyPrompt())toast('คัดลอก Prompt แล้ว')};const media=window.matchMedia('(max-width:680px)');const responsive=()=>bar.style.gridTemplateColumns=media.matches?'1fr':'repeat(3,minmax(0,1fr))';responsive();media.addEventListener?.('change',responsive)}

  function submitExistingPipeline(q){
    const routed=window.GOVPROMPT_ROUTER?.route?.(q);
    if(!routed||routed.fallback||!routed.tool?.id)return false;
    const button=document.querySelector(`[data-open="${esc(routed.tool.id)}"]`);
    if(!button)return false;
    button.click();
    const form=document.getElementById('promptForm');if(!form)return false;
    const inputs=[...form.querySelectorAll('textarea,input')].filter(el=>/^f\d+$/.test(el.name||''));if(!inputs.length)return false;
    inputs.forEach((el,index)=>{if(index===0||el.required)el.value=q});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return showResult();
  }

  function runPrimaryEntry(){const input=document.getElementById('mainPrompt');const q=String(input?.value||'').trim();if(!q){input?.focus();return}const search=document.getElementById('toolSearch');if(search){search.value=q;search.dispatchEvent(new Event('input',{bubbles:true}))}if(!submitExistingPipeline(q))toast('ยังจัดหมวดอัตโนมัติไม่ได้ — เลือกผู้ช่วยตามงานด้านล่างได้ทันที')}

  function enhancePrimaryEntry(){
    const input=document.getElementById('mainPrompt'),send=document.getElementById('mainSend');if(!input||!send)return;
    /* One controller owns the primary composer. Replace legacy routeFrom onclick instead of
       stacking another listener, so HOME → RESULT is deterministic and regression-safe. */
    send.onclick=e=>{e?.preventDefault?.();runPrimaryEntry()};
    input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runPrimaryEntry()}};
  }

  function init(){buildActionLayer();ensureResultView();enhancePrimaryEntry()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
