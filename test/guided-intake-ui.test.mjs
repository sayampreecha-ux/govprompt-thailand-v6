import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('quality-gate.js', 'utf8');

function buildHarness() {
  const listener = { submit: null };
  const textareas = Array.from({ length: 6 }, () => ({
    value: '', style: {}, attrs: {}, focused: false,
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    focus() { this.focused = true; }
  }));
  const form = {
    dataset: {}, noValidate: false,
    addEventListener(type, fn) { listener[type] = fn; },
    querySelectorAll(selector) { return selector === '#fields textarea' ? textareas : []; }
  };
  const nodes = {
    promptForm: form,
    toolCode: { textContent: 'GP014' },
    output: { textContent: '', classList: { remove() {} } },
    copyBtn: { disabled: false },
    downloadBtn: { disabled: false },
    confirm: { checked: true, focused: false, focus() { this.focused = true; } }
  };
  const contextCalls = [];
  const context = {
    window: {
      GOVPROMPT_TOOLS: [{ id: 'GP014', category: 'โครงการ', fields: ['หน่วยงาน', 'ชื่อโครงการ', 'ปัญหา', 'กลุ่มเป้าหมาย', 'ระยะเวลา', 'งบประมาณ'] }],
      GOVPROMPT_CONTEXT: {
        setUserInputs(values) { contextCalls.push(['inputs', values]); },
        setWorkflowState(value) { contextCalls.push(['state', value]); }
      }
    },
    document: { getElementById(id) { return nodes[id] || null; } }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { listener, textareas, nodes, contextCalls, form };
}

test('browser guard blocks generation, disables copy/download, and highlights missing fields', () => {
  const h = buildHarness();
  assert.equal(h.form.noValidate, true);
  h.textareas[0].value = 'อบจ.ตัวอย่าง';
  h.textareas[1].value = 'โครงการ NCD';
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  h.listener.submit(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.nodes.copyBtn.disabled, true);
  assert.equal(h.nodes.downloadBtn.disabled, true);
  assert.match(h.nodes.output.textContent, /ยังขาดข้อมูลสำคัญ 3 ข้อ/);
  assert.equal(h.textareas[2].attrs['aria-invalid'], 'true');
  assert.equal(h.textareas[2].focused, true);
  assert.deepEqual(h.contextCalls.at(-1), ['state', 'collecting-input']);
});

test('browser guard allows existing submit handler after priority data is complete', () => {
  const h = buildHarness();
  ['อบจ.ตัวอย่าง', 'โครงการ NCD', 'ปัญหา NCD', 'ผู้สูงอายุ 100 คน', '1 วัน', '30000'].forEach((value, index) => { h.textareas[index].value = value; });
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  h.listener.submit(event);
  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
});

test('browser guard requires human confirmation after priority data is complete', () => {
  const h = buildHarness();
  ['อบจ.ตัวอย่าง', 'โครงการ NCD', 'ปัญหา NCD', 'ผู้สูงอายุ 100 คน', '1 วัน', '30000'].forEach((value, index) => { h.textareas[index].value = value; });
  h.nodes.confirm.checked = false;
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  h.listener.submit(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(h.nodes.confirm.focused, true);
  assert.match(h.nodes.output.textContent, /กรุณายืนยัน/);
  assert.equal(h.nodes.copyBtn.disabled, true);
  assert.equal(h.nodes.downloadBtn.disabled, true);
});
