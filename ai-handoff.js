(function () {
  'use strict';

  const DESTINATIONS = Object.freeze({
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/'
  });

  function legacyCopy(text) {
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
      return false;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange?.(0, textarea.value.length);
    let copied = false;
    try {
      copied = Boolean(document.execCommand?.('copy'));
    } catch (_) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function copyText(text) {
    const value = String(text || '').trim();
    if (!value) throw new Error('ไม่มี Prompt สำหรับคัดลอก');

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_) {
        // Fall through to the legacy copy path for Safari/WebView environments.
      }
    }

    if (legacyCopy(value)) return true;
    throw new Error('คัดลอก Prompt ไม่สำเร็จ');
  }

  function openExternalWindow(url) {
    if (typeof window === 'undefined') return null;

    // Open synchronously during the click gesture. This avoids iOS/Safari
    // blocking the new tab after an awaited clipboard operation.
    let popup = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
    } catch (_) {
      popup = null;
    }

    return {
      navigate() {
        if (popup && !popup.closed) {
          try {
            popup.location.replace(url);
            return 'new-window';
          } catch (_) {
            try {
              popup.location.href = url;
              return 'new-window';
            } catch (_) {
              // Continue to same-window fallback.
            }
          }
        }
        window.location.href = url;
        return 'same-window';
      },
      close() {
        try { popup?.close?.(); } catch (_) {}
      }
    };
  }

  async function copyAndOpen(destination, promptText) {
    const url = DESTINATIONS[destination];
    if (!url) throw new Error('ไม่รู้จัก AI ปลายทาง');

    const external = openExternalWindow(url);
    try {
      await copyText(promptText);
    } catch (error) {
      external?.close();
      throw error;
    }

    const opened = external?.navigate?.() || null;
    return { copied: true, opened, url };
  }

  function install(options = {}) {
    if (typeof document === 'undefined') return false;

    const getPrompt = typeof options.getPrompt === 'function'
      ? options.getPrompt
      : () => String(document.getElementById(options.promptElementId || 'output')?.textContent || '');
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};

    const bindings = [
      [options.chatgptButtonId || 'openChatGPT', 'chatgpt'],
      [options.geminiButtonId || 'openGemini', 'gemini']
    ];

    let installed = false;
    bindings.forEach(([id, destination]) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.aiHandoffInstalled === 'true') return;
      button.dataset.aiHandoffInstalled = 'true';
      button.addEventListener('click', async event => {
        event.preventDefault();
        button.disabled = true;
        try {
          await copyAndOpen(destination, getPrompt());
          onStatus('copied-and-opened', destination);
        } catch (error) {
          onStatus('error', destination, error);
        } finally {
          button.disabled = false;
        }
      });
      installed = true;
    });
    return installed;
  }

  const api = Object.freeze({ DESTINATIONS, copyText, copyAndOpen, install });
  if (typeof window !== 'undefined') window.GOVPROMPT_AI_HANDOFF = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
