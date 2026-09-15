(() => {
  'use strict';

  const PROVIDERS = Object.freeze({ chatgpt:'https://chatgpt.com/', gemini:'https://gemini.google.com/' });
  const esc = value => (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(value) : String(value).replace(/["\\]/g,'\\$&');

  function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2600)}
  function getPrompt(){const output=document.getElementById('output');if(!output||output.classList.contains('empty-result'))return '';return String(output.textContent||'').trim()}
  function selectPromptForManualCopy(){const output=document.getElementById('output'),selection=window.getSelection?.(),range=document.createRange?.();if(!output||!selection||!range)return;range.selectNodeContents(output);selection.removeAllRanges();selection.addRange(range)}
  async function copyPrompt(){const prompt=getPrompt();if(!prompt){toast('กรุณาสร้าง Prompt ก่อน');return false}try{if(!navigator.clipboard?.writeText)throw new Error('clipboard-unavailable');await navigator.clipboard.writeText(prompt);return true}catch(_){selectPromptForManualCopy();toast('คัดลอกอัตโนมัติไม่ได้ — เลือก Prompt ให้แล้ว กรุณาคัดลอกด้วยตนเอง');return false}}
  async function openProvider(provider){const url=PROVIDERS[provider],prompt=getPrompt();if(!url)return;if(!prompt){toast('กรุณาสร้าง Prompt ก่อน');return}const copied=await copyPrompt();const opened=window.open(url,'_blank','noopener,noreferrer');if(!opened){toast(copied?'คัดลอก Prompt แล้ว — กรุณาเปิด AI แล้ววางข้อความ':'เปิด AI ไม่สำเร็จ — Prompt ยังอยู่ในหน้านี้');return}toast(copied?'คัดลอก Prompt แล้ว — วางใน AI และกดส่งได้เลย':'เปิด AI แล้ว — กรุณาคัดลอก Prompt จากหน้านี้แล้ววาง')}

  function buildActionLayer(){const result=document.querySelector('.result');if(!result||document.getElementById('externalAiActions'))return;const bar=document.createElement('div');bar.id='externalAiActions';bar.setAttribute('aria-label','ทำงานต่อด้วย AI ภายนอก');bar.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0';bar.innerHTML='<button type="button" data-provider="chatgpt" class="btn primary">ทำต่อใน ChatGPT</button><button type="button" data-provider="gemini" class="btn primary">ทำต่อใน Gemini</button><button type="button" data-copy-external class="btn">คัดลอก Prompt</button>';const pre=result.querySelector('#output');result.insertBefore(bar,pre||null);bar.querySelector('[data-provider="chatgpt"]').onclick=()=>openProvider('chatgpt');bar.querySelector('[data-provider="gemini"]').onclick=()=>openProvider('gemini');bar.querySelector('[data-copy-external]').onclick=async()=>{if(await copyPrompt())toast('คัดลอก Prompt แล้ว')};const media=window.matchMedia('(max-width:680px)');const responsive=()=>bar.style.gridTemplateColumns=media.matches?'1fr':'repeat(3,minmax(0,1fr))';responsive();media.addEventListener?.('change',responsive)}

  function submitExistingPipeline(q){
    const routed=window.GOVPROMPT_ROUTER?.route?.(q);
    if(!routed||routed.fallback||!routed.tool?.id)return false;

    /* routeFrom/render() has already rendered the routed virtual/domain tool when needed.
       Use its existing data-open handler so openTool(), Shared Context and the V7.1 form
       generation path remain the single source of truth. */
    const button=document.querySelector(`[data-open="${esc(routed.tool.id)}"]`);
    if(!button)return false;
    button.click();

    const form=document.getElementById('promptForm');
    if(!form)return false;
    const inputs=[...form.querySelectorAll('textarea,input')].filter(el=>/^f\d+$/.test(el.name||''));
    if(!inputs.length)return false;

    /* A direct natural-language request is complete enough to start the existing pipeline.
       Put it into every required field so native/form semantics cannot block the one-step flow;
       optional context stays blank and the existing gates decide what further facts are needed. */
    inputs.forEach((el,index)=>{if(index===0||el.required)el.value=q});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));

    const output=document.getElementById('output');
    if(output && !output.classList.contains('empty-result')){
      output.scrollIntoView({behavior:'smooth',block:'start'});
      return true;
    }
    return false;
  }

  function enhancePrimaryEntry(){
    const input=document.getElementById('mainPrompt'),send=document.getElementById('mainSend');
    if(!input||!send||send.dataset.externalEnhanced==='1')return;
    send.dataset.externalEnhanced='1';

    /* Existing inline onclick runs routeFrom() first. This listener then converts that routed
       result into a generated Prompt instead of leaving the user at “เครื่องมือที่เกี่ยวข้อง”. */
    send.addEventListener('click',()=>{const q=String(input.value||'').trim();if(!q)return;window.setTimeout(()=>{if(!submitExistingPipeline(q))toast('ยังจัดหมวดอัตโนมัติไม่ได้ — เลือกผู้ช่วยตามงานด้านล่างได้ทันที')},0)});
  }

  function init(){buildActionLayer();enhancePrimaryEntry()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
