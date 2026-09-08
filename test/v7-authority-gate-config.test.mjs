import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync(new URL('../v7/legal-authority-gate-config.json',import.meta.url),'utf8'));

test('v7 authority gate config is enabled and hard-blocks decisive states',()=>{
  assert.equal(config.enabled,true);
  assert.equal(config.mode,'hard-gate');
  assert.ok(config.appliesTo.includes('legal'));
  assert.ok(config.appliesTo.includes('finance'));
  assert.ok(config.forbidDecisiveStatesWhileBlocked.includes('VERIFIED'));
  assert.ok(config.requirements.includes('intervening-authority-search'));
  assert.ok(config.requirements.includes('transition-effect-resolution'));
});
