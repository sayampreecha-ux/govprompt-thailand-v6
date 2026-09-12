(() => {
  'use strict';

  const FORMATS = Object.freeze([
    Object.freeze({
      id: 'easy-summary',
      label: 'สรุปเนื้อหาเข้าใจง่าย',
      icon: '🧾',
      description: 'คัดเฉพาะสาระสำคัญ เรียงจากภาพรวมไปสู่รายละเอียด',
      structure: Object.freeze(['พาดหัวหลัก', 'สาระสำคัญ 3–5 ประเด็น', 'สิ่งที่ต้องดำเนินการ', 'แหล่งอ้างอิง/วันที่ข้อมูล'])
    }),
    Object.freeze({
      id: 'step-by-step',
      label: 'ขั้นตอน Step-by-Step',
      icon: '🔢',
      description: 'แปลงกระบวนการเป็นลำดับ 1–6 ขั้นที่ทำตามได้',
      structure: Object.freeze(['ชื่อกระบวนการ', 'ขั้นตอน 1–6', 'ผู้รับผิดชอบหรือผลลัพธ์แต่ละขั้น', 'จุดตรวจสอบก่อนจบ'])
    }),
    Object.freeze({
      id: 'timeline',
      label: 'Timeline ลำดับเวลา',
      icon: '🗓️',
      description: 'เรียงเหตุการณ์ วัน เวลา หรือหมุดหมายสำคัญ',
      structure: Object.freeze(['จุดเริ่มต้น', 'เหตุการณ์ตามลำดับเวลา', 'สถานะปัจจุบัน', 'กำหนดการถัดไป'])
    }),
    Object.freeze({
      id: 'comparison',
      label: 'เปรียบเทียบ A–B',
      icon: '⚖️',
      description: 'เปรียบเทียบสองทางเลือกด้วยเกณฑ์เดียวกัน',
      structure: Object.freeze(['เกณฑ์เปรียบเทียบ', 'ทางเลือก A', 'ทางเลือก B', 'ข้อจำกัด', 'ข้อสรุปแบบมีเงื่อนไข'])
    }),
    Object.freeze({
      id: 'workflow',
      label: 'Workflow กระบวนงาน',
      icon: '🔄',
      description: 'แสดง Input → Process → Decision → Action → Output',
      structure: Object.freeze(['ข้อมูลนำเข้า', 'กระบวนการ', 'จุดตัดสินใจ', 'การดำเนินการ', 'ผลลัพธ์'])
    }),
    Object.freeze({
      id: 'checklist',
      label: 'Checklist ตรวจงาน',
      icon: '✅',
      description: 'ทำรายการตรวจ 8–10 ข้อที่นำไปใช้หน้างานได้',
      structure: Object.freeze(['รายการตรวจ', 'หลักฐานที่ต้องมี', 'ผู้ตรวจ/ช่วงเวลาตรวจ', 'ผลผ่าน–ไม่ผ่าน'])
    }),
    Object.freeze({
      id: 'do-dont',
      label: 'ควรทำ / ไม่ควรทำ',
      icon: '🚦',
      description: 'แบ่งแนวปฏิบัติเป็นสองฝั่งอย่างละไม่เกิน 5 ข้อ',
      structure: Object.freeze(['ควรทำ 3–5 ข้อ', 'ไม่ควรทำ 3–5 ข้อ', 'เหตุผลสั้น', 'ตัวอย่างที่ไม่เปิดเผยข้อมูลส่วนบุคคล'])
    }),
    Object.freeze({
      id: 'framework',
      label: 'Framework กรอบความคิด',
      icon: '🧩',
      description: 'จัดกลุ่มแนวคิดหลักเป็น 4–6 หมวดและอธิบายความเชื่อมโยง',
      structure: Object.freeze(['หัวข้อหลัก', 'หมวดแนวคิด 4–6 หมวด', 'ความสัมพันธ์ระหว่างหมวด', 'แนวทางนำไปใช้'])
    }),
    Object.freeze({
      id: 'key-insights',
      label: 'ตัวเลขและ Key Insights',
      icon: '📊',
      description: 'เลือกตัวเลขจริง 5–8 ค่า พร้อมความหมายและข้อสังเกต',
      structure: Object.freeze(['ตัวเลขสำคัญ', 'หน่วย/ช่วงเวลา', 'ความหมายของแต่ละค่า', 'Insight ที่มีหลักฐานรองรับ'])
    }),
    Object.freeze({
      id: 'quick-guide',
      label: 'คู่มือฉบับย่อ',
      icon: '📘',
      description: 'สรุปสิ่งนี้คืออะไร ใช้ทำอะไร วิธีใช้ ข้อควรระวัง และเคล็ดลับ',
      structure: Object.freeze(['สิ่งนี้คืออะไร', 'ใช้ทำอะไร', 'วิธีใช้งาน', 'สิ่งที่ควรระวัง', 'Tips สำหรับใช้จริง'])
    })
  ]);

  const BY_ID = new Map(FORMATS.map(format => [format.id, format]));
  const SAFE_DEFAULT = 'easy-summary';

  function resolve(id) {
    return BY_ID.get(String(id || '')) || BY_ID.get(SAFE_DEFAULT);
  }

  function buildPromptBlock(id) {
    const format = resolve(id);
    const sections = format.structure.map((item, index) => `${index + 1}. ${item}`).join('\n');
    return `รูปแบบการนำเสนอ: ${format.label}\nเป้าหมาย: ${format.description}\n\nโครงสร้างที่ต้องมี\n${sections}\n\nข้อกำกับสำหรับงานราชการและอินโฟกราฟิก\n- ใช้เฉพาะข้อเท็จจริง ตัวเลข วันที่ และชื่อหน่วยงานที่พบในข้อมูลต้นทาง\n- หากข้อมูลใดไม่มีหรือยืนยันไม่ได้ ให้ระบุ [ต้องตรวจสอบ/เพิ่มเติม] และห้ามแต่งเติม\n- ข้อความต้องสั้น อ่านง่ายบนโทรศัพท์ และจัดลำดับจากสาระสำคัญที่สุด\n- งานกฎหมาย/พัสดุต้องระบุชื่อแหล่งอ้างอิง ฉบับ และวันที่ตรวจสอบข้อมูล\n- ปกปิดข้อมูลส่วนบุคคลหรือข้อมูลสุขภาพที่ไม่จำเป็น\n- ส่งมอบทั้ง (1) ข้อความพร้อมจัดวาง และ (2) คำแนะนำโครงสร้างภาพ โดยไม่สร้างตราสัญลักษณ์หรือคำรับรองที่ไม่มีต้นฉบับ`;
  }

  function suggestForTool(tool) {
    const id = String(tool?.id || '');
    const category = String(tool?.category || '');
    if (id === 'GP004') return 'timeline';
    if (['GP009', 'GP010', 'GP011', 'GP012'].includes(id)) return 'checklist';
    if (id === 'GP015' || id === 'GP019') return 'key-insights';
    if (id === 'GP018') return 'quick-guide';
    if (category === 'กฎหมาย') return 'comparison';
    return SAFE_DEFAULT;
  }

  window.GOVPROMPT_OUTPUT_FORMATS = Object.freeze({
    formats: FORMATS,
    defaultId: SAFE_DEFAULT,
    resolve,
    buildPromptBlock,
    suggestForTool
  });

  // No-API external AI handoff. Keep GovPrompt as the preparation layer,
  // then hand the finished Prompt to the user's own ChatGPT/Gemini session.
  const AI_DESTINATIONS = Object.freeze({
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/'
  });

  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange?.(0, area.value.length);
    let ok = false;
    try { ok = Boolean(document.execCommand?.('copy')); } catch (_) { ok = false; }
    area.remove();
    return ok;
  }

  async function copyPrompt(text) {
    const value = String(text || '').trim();
    if (!value || value === 'Prompt จะแสดงที่นี่') throw new Error('ยังไม่มี Prompt พร้อมใช้');
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_) {}
    }
    if (legacyCopy(value)) return true;
    throw new Error('คัดลอก Prompt ไม่สำเร็จ');
  }

  function showHandoffStatus(message, isError = false) {
    let status = document.getElementById('aiHandoffStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'aiHandoffStatus';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.marginTop = '8px';
      status.style.fontSize = '12px';
      status.style.fontWeight = '700';
      const result = document.querySelector('.result');
      result?.appendChild(status);
    }
    status.textContent = message;
    status.style.color = isError ? '#b42318' : '#176fd1';
    clearTimeout(showHandoffStatus.timer);
    showHandoffStatus.timer = setTimeout(() => { status.textContent = ''; }, 3500);
  }

  async function copyAndOpen(destination) {
    const url = AI_DESTINATIONS[destination];
    const output = document.getElementById('output');
    if (!url || !output) return;

    // Reserve a new tab synchronously inside the click gesture so iPhone/iPad
    // Safari does not block it after the asynchronous Clipboard API call.
    let popup = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
    } catch (_) { popup = null; }

    try {
      await copyPrompt(output.textContent);
      if (popup && !popup.closed) {
        try { popup.location.replace(url); }
        catch (_) { popup.location.href = url; }
      } else {
        window.location.href = url;
      }
      showHandoffStatus('คัดลอก Prompt แล้ว — วางใน AI แล้วส่งได้เลย');
    } catch (error) {
      try { popup?.close?.(); } catch (_) {}
      showHandoffStatus(error?.message || 'ส่งต่อไป AI ไม่สำเร็จ', true);
    }
  }

  function installExternalAiHandoff() {
    const resultHead = document.querySelector('.result-head');
    const actionBox = resultHead?.querySelector('div');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    if (!resultHead || !actionBox || !copyBtn || document.getElementById('openChatGPT')) return;

    actionBox.style.display = 'flex';
    actionBox.style.flexWrap = 'wrap';
    actionBox.style.gap = '8px';
    actionBox.style.alignItems = 'center';

    const makeButton = (id, label, destination, primary) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.textContent = label;
      button.disabled = copyBtn.disabled;
      button.style.border = primary ? '1px solid #176fd1' : '1px solid #dce6f1';
      button.style.background = primary ? '#176fd1' : '#fff';
      button.style.color = primary ? '#fff' : '#103b70';
      button.style.borderRadius = '10px';
      button.style.padding = '8px 11px';
      button.style.fontWeight = '800';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await copyAndOpen(destination); }
        finally { button.disabled = copyBtn.disabled; }
      });
      return button;
    };

    const chatgpt = makeButton('openChatGPT', '🤖 คัดลอก + เปิด ChatGPT', 'chatgpt', true);
    const gemini = makeButton('openGemini', '✨ คัดลอก + เปิด Gemini', 'gemini', true);
    actionBox.insertBefore(chatgpt, copyBtn);
    actionBox.insertBefore(gemini, copyBtn);

    copyBtn.textContent = '📋 คัดลอกไปใช้กับ AI อื่น';
    copyBtn.title = 'คัดลอก Prompt เพื่อไปวางใน AI อื่น เช่น Claude หรือ Copilot';
    if (downloadBtn) downloadBtn.style.display = 'none';

    const syncState = () => {
      chatgpt.disabled = copyBtn.disabled;
      gemini.disabled = copyBtn.disabled;
    };
    new MutationObserver(syncState).observe(copyBtn, { attributes: true, attributeFilter: ['disabled'] });
    syncState();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installExternalAiHandoff, { once: true });
    } else {
      installExternalAiHandoff();
    }
  }
})();
