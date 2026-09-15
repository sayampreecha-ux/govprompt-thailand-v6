(() => {
  'use strict';

  const PROVIDERS = Object.freeze({
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/'
  });

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), 2600);
  }

  function getPrompt() {
    const output = document.getElementById('output');
    if (!output || output.classList.contains('empty-result')) return '';
    return String(output.textContent || '').trim();
  }

  function selectPromptForManualCopy() {
    const output = document.getElementById('output');
    if (!output) return;
    const selection = window.getSelection?.();
    const range = document.createRange?.();
    if (!selection || !range) return;
    range.selectNodeContents(output);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyPrompt() {
    const prompt = getPrompt();
    if (!prompt) {
      toast('กรุณาสร้าง Prompt ก่อน');
      return false;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(prompt);
      return true;
    } catch (_) {
      selectPromptForManualCopy();
      toast('คัดลอกอัตโนมัติไม่ได้ — เลือก Prompt ให้แล้ว กรุณาคัดลอกด้วยตนเอง');
      return false;
    }
  }

  async function openProvider(provider) {
    const url = PROVIDERS[provider];
    if (!url) return;
    const prompt = getPrompt();
    if (!prompt) {
      toast('กรุณาสร้าง Prompt ก่อน');
      return;
    }

    // Privacy-first progressive enhancement: never put the prompt in a URL.
    // Copy locally first, then open the provider's real service after explicit user action.
    const copied = await copyPrompt();
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      toast(copied ? 'คัดลอก Prompt แล้ว — เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาเปิด AI แล้ววางข้อความ' : 'เปิด AI ไม่สำเร็จ — Prompt ยังอยู่ในหน้านี้');
      return;
    }
    toast(copied ? 'คัดลอก Prompt แล้ว — วางใน AI และกดส่งได้เลย' : 'เปิด AI แล้ว — กรุณาคัดลอก Prompt จากหน้านี้แล้ววาง');
  }

  function buildActionLayer() {
    const result = document.querySelector('.result');
    if (!result || document.getElementById('externalAiActions')) return;

    const bar = document.createElement('div');
    bar.id = 'externalAiActions';
    bar.setAttribute('aria-label', 'ทำงานต่อด้วย AI ภายนอก');
    bar.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0';
    bar.innerHTML = `
      <button type="button" data-provider="chatgpt" class="btn primary">ทำต่อใน ChatGPT</button>
      <button type="button" data-provider="gemini" class="btn primary">ทำต่อใน Gemini</button>
      <button type="button" data-copy-external class="btn">คัดลอก Prompt</button>`;

    const pre = result.querySelector('#output');
    result.insertBefore(bar, pre || null);

    bar.querySelector('[data-provider="chatgpt"]').addEventListener('click', () => openProvider('chatgpt'));
    bar.querySelector('[data-provider="gemini"]').addEventListener('click', () => openProvider('gemini'));
    bar.querySelector('[data-copy-external]').addEventListener('click', async () => {
      const copied = await copyPrompt();
      if (copied) toast('คัดลอก Prompt แล้ว');
    });

    const media = window.matchMedia('(max-width: 680px)');
    const applyMobile = () => {
      bar.style.gridTemplateColumns = media.matches ? '1fr' : 'repeat(3,minmax(0,1fr))';
    };
    applyMobile();
    media.addEventListener?.('change', applyMobile);
  }

  function enhancePrimaryEntry() {
    const input = document.getElementById('mainPrompt');
    const send = document.getElementById('mainSend');
    if (!input || !send || send.dataset.externalEnhanced === '1') return;
    send.dataset.externalEnhanced = '1';

    // Keep the existing router/pipeline as the single source of truth.
    // This enhancement only makes the routed tool easier to enter; it does not add a second router.
    send.addEventListener('click', () => {
      const q = String(input.value || '').trim();
      if (!q) return;
      window.setTimeout(() => {
        const routed = window.GOVPROMPT_ROUTER?.route?.(q);
        if (!routed || routed.fallback || !routed.tool?.id) return;
        const button = document.querySelector(`[data-open="${CSS.escape(routed.tool.id)}"]`);
        if (button) button.focus({ preventScroll: true });
      }, 0);
    }, { capture: true });
  }

  function init() {
    buildActionLayer();
    enhancePrimaryEntry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
