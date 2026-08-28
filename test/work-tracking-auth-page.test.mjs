import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-login-pilot.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/work-tracking/supabase-browser.mjs', import.meta.url), 'utf8');

test('organization login is username and password only for new accounts', () => {
  assert.match(html, /signInPilotWithPassword/);
  assert.match(html, /ชื่อผู้ใช้ \+ รหัสผ่าน/);
  assert.match(html, /id="loginName" type="text"/);
  assert.match(html, /id="passwordValue" type="password"/);
  assert.match(html, /signInPilotWithPassword\(\{client:supabase,login,password\}\)/);
  assert.match(html, /resolveWorkSession/);
  assert.match(client, /organization_memberships/);
  assert.doesNotMatch(html, /signInWithOtp|requestPilotMagicLink|claim_work_pilot_invite|auth\.signUp/i);
  assert.doesNotMatch(html, /id="magicBtn"|type="email"/i);
});

test('login page tells users they do not need to register or wait for email', () => {
  assert.match(html, /ไม่ต้องสมัครสมาชิก/);
  assert.match(html, /ไม่ต้องรออีเมล/);
  assert.match(html, /ไม่ต้องใส่อีเมลสำหรับบัญชีที่ผู้ดูแลสร้างใหม่/);
});

test('visible navigation uses plain Thai terms', () => {
  assert.match(html, />พื้นที่ทำงานองค์กร</);
  assert.match(html, />ภาพรวมงาน</);
  assert.match(html, />ศูนย์ติดตามและสั่งการ</);
  assert.match(html, />นำเข้าตารางข้อมูล</);
  assert.match(html, />ส่งออกสำเนาข้อมูล</);
  assert.match(html, />ทดลองใช้งาน</);
  assert.doesNotMatch(html, />Dashboard</);
  assert.doesNotMatch(html, />Command Center</);
  assert.doesNotMatch(html, />UAT</);
});

test('role codes are converted to understandable Thai labels before display', () => {
  assert.match(html, /ORG_ADMIN:'ผู้ดูแลระบบ'/);
  assert.match(html, /EXECUTIVE:'ผู้บริหาร'/);
  assert.match(html, /DIRECTOR:'ผอ\.\/หัวหน้าหน่วย'/);
  assert.match(html, /OFFICER:'เจ้าหน้าที่'/);
  assert.match(html, /AUDITOR:'ผู้ตรวจสอบ'/);
  assert.match(html, /role\.textContent=roleLabel\(resolved\.actor\.role\)/);
});

test('browser client contains only publishable credential class, never server secret', () => {
  assert.match(client, /sb_publishable_/);
  assert.doesNotMatch(client, /service_role/i);
  assert.doesNotMatch(client, /sb_secret_/i);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE/i);
});

test('membership is required before organization links are shown', () => {
  assert.match(html, /ยังไม่มีสิทธิองค์กร/);
  assert.match(html, /โปรดติดต่อผู้ดูแลระบบ/);
  assert.match(html, /classList\.toggle\('hidden',!resolved\.ok\)/);
  assert.match(html, /resolveWorkSession/);
});

test('ORG_ADMIN alone receives the account management entry', () => {
  assert.match(html, /id="adminUsersLink"/);
  assert.match(html, /resolved\.actor\.role==='ORG_ADMIN'/);
  assert.match(html, /href="work-members-live-pilot\.html">จัดการผู้ใช้/);
});

test('login safely renders context and links organization area back to production GP', () => {
  assert.match(html, /box\.replaceChildren\(\)/);
  assert.match(html, /textContent=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /พื้นที่ทำงานองค์กร/);
  assert.match(html, /href="https:\/\/sayampreecha-ux\.github\.io\/-ai-local-government-assistant\/">GP หลัก/);
  assert.match(html, /href="https:\/\/sayampreecha-ux\.github\.io\/-ai-local-government-assistant\/automation-pilot\.html">งานอัตโนมัติ/);
  assert.match(html, /noindex,nofollow/);
});
