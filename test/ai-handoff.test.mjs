import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('ai-handoff.js', 'utf8');

function harness({ popupBlocked = false, clipboardFails = false } = {}) {
  const events = [];
  const popup = popupBlocked ? null : {
    closed: false,
    opener: {},
    location: {
      replace(url) { events.push(['popup', url]); }
    },
    close() { this.closed = true; events.push(['close']); }
  };
  const window = {
    location: { href: 'https://gp.example/' },
    open(url, target) {
      events.push(['open', url, target]);
      return popup;
    }
  };
  const navigator = {
    clipboard: {
      async writeText(text) {
        events.push(['copy', text]);
        if (clipboardFails) throw new Error('clipboard denied');
      }
    }
  };
  const context = { window, navigator, console, module: { exports: {} } };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { api: context.module.exports, window, popup, events };
}

test('ChatGPT handoff opens a window during the gesture, copies, then navigates externally', async () => {
  const h = harness();
  const result = await h.api.copyAndOpen('chatgpt', 'Prompt พร้อมใช้');
  assert.deepEqual(h.events[0], ['open', 'about:blank', '_blank']);
  assert.deepEqual(h.events[1], ['copy', 'Prompt พร้อมใช้']);
  assert.deepEqual(h.events[2], ['popup', 'https://chatgpt.com/']);
  assert.equal(h.popup.opener, null);
  assert.equal(result.copied, true);
  assert.equal(result.url, 'https://chatgpt.com/');
});

test('Gemini uses the official external destination', async () => {
  const h = harness();
  const result = await h.api.copyAndOpen('gemini', 'ทดสอบ');
  assert.equal(result.url, 'https://gemini.google.com/');
  assert.deepEqual(h.events.at(-1), ['popup', 'https://gemini.google.com/']);
});

test('popup blocker falls back to leaving GP in the current window after copy', async () => {
  const h = harness({ popupBlocked: true });
  const result = await h.api.copyAndOpen('chatgpt', 'ทดสอบ');
  assert.equal(result.opened, 'same-window');
  assert.equal(h.window.location.href, 'https://chatgpt.com/');
});

test('failed copy does not send the user away and closes the temporary popup', async () => {
  const h = harness({ clipboardFails: true });
  await assert.rejects(() => h.api.copyAndOpen('gemini', 'ทดสอบ'), /คัดลอก Prompt ไม่สำเร็จ/);
  assert.equal(h.popup.closed, true);
  assert.equal(h.window.location.href, 'https://gp.example/');
});
