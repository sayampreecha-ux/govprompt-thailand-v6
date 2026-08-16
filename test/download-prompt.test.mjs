import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const handler = html.match(/document\.getElementById\('downloadBtn'\)\.onclick=(\(\)=>\{.*?\});/s)?.[1];

test('download handler produces a named UTF-8 text file from the generated prompt', () => {
  assert.ok(handler, 'download handler is present');
  const blobs = new Map();
  const revoked = [];
  let clicked;
  let counter = 0;
  const button = {};
  const context = {
    active: { id: 'GP009', name: 'ตรวจร่าง TOR' },
    prompt: 'Prompt ทดสอบสำหรับดาวน์โหลด',
    Blob: class {
      constructor(parts, options) {
        this.text = parts.join('');
        this.type = options.type;
      }
    },
    URL: {
      createObjectURL(blob) {
        const url = `blob:test-${++counter}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      }
    },
    document: {
      getElementById(id) {
        assert.equal(id, 'downloadBtn');
        return button;
      },
      createElement(tag) {
        assert.equal(tag, 'a');
        return { click() { clicked = { href: this.href, download: this.download }; } };
      }
    }
  };

  vm.runInNewContext(`document.getElementById('downloadBtn').onclick=${handler};document.getElementById('downloadBtn').onclick();`, context);

  assert.deepEqual(clicked, { href: 'blob:test-1', download: 'GP009-ตรวจร่าง TOR.txt' });
  const blob = blobs.get(clicked.href);
  assert.equal(blob.type, 'text/plain;charset=utf-8');
  const file = join(tmpdir(), `govprompt-download-${Date.now()}.txt`);
  try {
    writeFileSync(file, blob.text, 'utf8');
    assert.equal(readFileSync(file, 'utf8'), context.prompt);
  } finally {
    rmSync(file, { force: true });
  }
  assert.deepEqual(revoked, ['blob:test-1']);
});
