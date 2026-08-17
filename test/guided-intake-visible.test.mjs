import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('quality-gate.js', 'utf8');

function harness() {
  const listeners = {};
  const textareas = Array.from({ length: 6 }, () => ({
    value: '', style: {}, attrs: {}, focused: false,
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    focus() { this.focused = true; }
  }));
  const panel = { hidden: true, style: {}, attrs: {}, innerHTML: '', setAttribute(n, v) { this.attrs[n] = v; }, scrollIntoView() {} };
  const form = {
    dataset: {}, noValidate: false,
    addEventListener(type, fn) { listeners[type] = fn; },
    querySelectorAll(selector) { return selector === '#fields textarea' ? textareas : []; },
    insertBefore(el) { this.panel = el; }, prepend(el) { this.panel = el; }
  };
  const fields = { parentNode: form };
  const confirm = { checked: false, focused: false, focus() { this.focused = true; } };
  const output = { textContent: '', classList: { remove() {} } };
  const copyBtn = { disabled: false }, downloadBtn = { disabled: false };
  const document = {
    getElementById(id) {
      if (id === 'promptForm') return form;
      if (id === 'guidedIntakePanel') return form.panel || null;
      return { toolCode: { textContent: 'GP014' }, fields, confirm, output, copyBtn, downloadBtn }[id] || null;
    },
    createElement() { return panel; }
  };
  const context = { window: {
    GOVPROMPT_TOOLS: [{ id: 'GP014', category: 'โครงการ', fields: ['หน่วยงาน', 'ชื่อโครงการ', 'ปัญหา', 'กลุ่มเป้าหมาย', 'ระยะเวลา', 'งบประมาณ'] }],
    GOVPROMPT_CONTEXT: { setUserInputs() {}, setWorkflowState() {} }
  }, document };
  vm.createContext(context); vm.runInContext(source, context);
  return { listeners, textareas, panel, confirm, copyBtn, downloadBtn, form };
}

function event() { return { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } }; }

test('missing information is shown visibly above fields and blocks copy/download', () => {
  const h = harness();
  h.textareas[0].value = 'อบจ.ตัวอย่าง'; h.textareas[1].value = 'โครงการ NCD';
  const e = event(); h.listeners.submit(e);
  assert.equal(e.prevented, true);
  assert.equal(h.panel.hidden, false);
  assert.match(h.panel.innerHTML, /GP ขอข้อมูลเพิ่ม 3 ข้อ/);
  assert.match(h.panel.innerHTML, /กลุ่มเป้าหมาย/);
  assert.equal(h.copyBtn.disabled, true); assert.equal(h.downloadBtn.disabled, true);
  assert.equal(h.form.noValidate, true);
});

test('complete information still requires human confirmation', () => {
  const h = harness();
  ['อบจ.ตัวอย่าง', 'NCD', 'ปัญหา', '100 คน', '1 วัน', '30000'].forEach((v, i) => { h.textareas[i].value = v; });
  const e = event(); h.listeners.submit(e);
  assert.equal(e.prevented, true);
  assert.match(h.panel.innerHTML, /ข้อมูลสำคัญครบแล้ว/);
  assert.equal(h.confirm.focused, true);
});
