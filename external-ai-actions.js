(() => {
  'use strict';

  const PROVIDERS=Object.freeze({chatgpt:'https://chatgpt.com/',gemini:'https://gemini.google.com/'});
  const esc=value=>(window.CSS&&typeof CSS.escape==='function')?CSS.escape(value):String(value).replace(/["\\]/g,'\\$&');
  let resultView=null;

  function toast(message){const el=document.getElementById('toast');if(!el)return;el.style.zIndex='10001';el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
  function getPrompt(){const output=document.getElementById('output');return(!output||output.classList.contains('empty-result'))?'':String(output.textContent||'').trim()}
  function selectPrompt(){const visible=resultView&&!resultView.hidden?resultView.querySelector('#gpResultPrompt'):null;const output=visible||document.getElementById('output'),selection=window.getSelection?.(),range=document.createRange?.();if(!output||!selection||!range)return;range.selectNodeContents(output);selection.removeAllRanges();selection.addRange(range)}
  async function copyPrompt(){const text=getPrompt();if(!text){toast('กรุณาสร้าง Prompt ก่อน');return false}try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text);return true}catch(_){selectPrompt();toast('เลือก Prompt ให้แล้ว กรุณาคัดลอกด้วยตนเอง');return false}}
  async function openProvider(provider){const url=PROVIDERS[provider];if(!url||!getPrompt())return;const opened=window.open('about:blank','_blank');if(opened)opened.opener=null;const copied=await copyPrompt();if(opened){try{opened.location.replace(url)}catch(_){opened.location.href=url}toast(copied?'คัดลอก Prompt แล้ว — วางใน AI และกดส่งได้เลย':'เปิด AI แล้ว — กรุณาคัดลอก Prompt จากหน้านี้');return}toast(copied?'คัดลอก Prompt แล้ว — เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาเปิด AI แล้ววางข้อความ':'เบราว์เซอร์บล็อกหน้าต่างใหม่')}

  function ensureResultView(){
    if(resultView)return resultView;
    const view=document.createElement('section');
    view.id='gpResultView';view.hidden=true;view.style.display='none';
    view.style.cssText+=';position:fixed;inset:0;z-index:9999;overflow:auto;background:var(--bg,#f7f8fa);padding:0;margin:0';
    view.innerHTML=`<div style="max-width:900px;margin:0 auto;padding:18px 16px 96px"><header style="display:flex;align-items:center;gap:10px;margin-bottom:22px"><button type="button" id="gpBackHome" class="btn" style="width:auto">← กลับ</button><strong style="font-size:18px">GovPrompt Thailand</strong></header><main class="result" style="margin:0"><div style="font-size:13px;color:var(--muted,#667085);font-weight:700">คำสั่งพร้อมแล้ว</div><h2 id="gpResultTitle" style="margin:6px 0 4px">พร้อมทำงานต่อ</h2><div id="gpResultCategory" style="font-size:14px;color:var(--muted,#667085);margin-bottom:16px"></div><div id="gpResultActions" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px"><button type="button" data-provider="chatgpt" class="btn primary">ทำต่อใน ChatGPT</button><button type="button" data-provider="gemini" class="btn primary">ทำต่อใน Gemini</button><button type="button" data-copy-result class="btn">คัดลอก Prompt</button></div><details style="margin-top:18px"><summary style="cursor:pointer;font-weight:700">ดู Prompt / รายละเอียด</summary><pre id="gpResultPrompt" style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px"></pre></details></main></div>`;
    document.body.appendChild(view);
    view.querySelector('#gpBackHome').onclick=showHome;
    view.querySelector('[data-provider="chatgpt"]').onclick=()=>openProvider('chatgpt');
    view.querySelector('[data-provider="gemini"]').onclick=()=>openProvider('gemini');
    view.querySelector('[data-copy-result]').onclick=async()=>{if(await copyPrompt())toast('คัดลอก Prompt แล้ว')};
    const actions=view.querySelector('#gpResultActions'),media=matchMedia('(max-width:680px)');
    const responsive=()=>actions.style.gridTemplateColumns=media.matches?'1fr':'repeat(3,minmax(0,1fr))';responsive();media.addEventListener?.('change',responsive);
    resultView=view;return view;
  }

  function showResult(){
    const text=getPrompt();if(!text)return false;
    const view=ensureResultView();
    view.querySelector('#gpResultTitle').textContent=document.getElementById('toolName')?.textContent?.trim()||'พร้อมทำงานต่อ';
    const ctx=window.GOVPROMPT_CONTEXT?.get?.();
    const category=typeof ctx?.category==='string'?ctx.category:(ctx?.category?.name||'');
    view.querySelector('#gpResultCategory').textContent=category;
    view.querySelector('#gpResultPrompt').textContent=text;
    document.getElementById('modal')?.classList.add('hidden');
    document.body.style.overflow='hidden';view.hidden=false;view.style.display='block';view.scrollTop=0;return true;
  }
  function showHome(){const view=ensureResultView();view.hidden=true;view.style.display='none';document.body.style.overflow='';document.getElementById('modal')?.classList.add('hidden')}

  function submitExistingPipeline(q){
    const routed=window.GOVPROMPT_ROUTER?.route?.(q);if(!routed||routed.fallback||!routed.tool?.id)return false;
    const button=document.querySelector(`[data-open="${esc(routed.tool.id)}"]`);if(!button)return false;button.click();
    const form=document.getElementById('promptForm');if(!form)return false;
    const inputs=[...form.querySelectorAll('textarea,input')].filter(el=>/^f\d+$/.test(el.name||''));if(!inputs.length)return false;
    inputs.forEach((el,index)=>{if(index===0||el.required)el.value=q});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return showResult();
  }
  function runPrimary(){const input=document.getElementById('mainPrompt'),q=String(input?.value||'').trim();if(!q){input?.focus();return}const search=document.getElementById('toolSearch');if(search){search.value=q;search.dispatchEvent(new Event('input',{bubbles:true}))}if(!submitExistingPipeline(q))toast('ยังจัดหมวดอัตโนมัติไม่ได้ — เลือกผู้ช่วยตามงานด้านล่างได้ทันที')}
  function init(){
    ensureResultView();
    document.getElementById('tools')?.classList.add('hidden');
    const input=document.getElementById('mainPrompt'),send=document.getElementById('mainSend');if(!input||!send)return;
    send.onclick=e=>{e?.preventDefault?.();runPrimary()};
    input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runPrimary()}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
