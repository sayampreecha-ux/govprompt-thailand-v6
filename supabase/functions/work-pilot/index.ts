import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>GovPrompt Work Tracking Pilot</title>
<style>
:root{font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif;color:#17263d;background:#f5f8fc;--navy:#103b70;--muted:#64748b;--line:#dce6f1;--red:#b42318;--green:#16865c}*{box-sizing:border-box}body{margin:0}.top{padding:14px 16px;background:#fff;border-bottom:1px solid var(--line)}.wrap{max-width:760px;margin:auto;padding:28px 16px 64px}.hero h1{margin:5px 0;font-size:clamp(30px,7vw,48px)}.muted{color:var(--muted)}.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field{display:block;margin:10px 0;font-weight:700}.field input{width:100%;padding:11px;border:1px solid #c8d5e3;border-radius:9px;margin-top:5px}.btn{border:0;border-radius:10px;padding:11px 14px;background:var(--navy);color:#fff;font-weight:800;cursor:pointer;width:100%}.status{padding:11px 12px;border-radius:10px;background:#f1f5f9;color:#465970;margin-top:12px;white-space:pre-wrap}.ok{background:#e9f8f1;color:var(--green)}.error{background:#feeceb;color:var(--red)}@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header class="top"><strong>GovPrompt · Work Tracking Pilot</strong></header>
<main class="wrap">
<section class="hero"><div class="muted">INTERNAL PILOT · v3</div><h1>Work Tracking Pilot</h1><p class="muted">หน้าทดสอบโดยตรงจาก Supabase สำหรับทดสอบ Login และ Membership</p></section>
<section class="card"><strong>✅ หากเห็นหน้าตานี้ แสดงว่า HTML render ถูกต้องแล้ว</strong></section>
<section class="card">
<div class="grid">
<div><h2>เข้าสู่ระบบ</h2><label class="field">อีเมล<input id="loginEmail" type="email" autocomplete="email"></label><label class="field">รหัสผ่าน<input id="loginPassword" type="password" autocomplete="current-password"></label><button id="loginBtn" class="btn" type="button">เข้าสู่ระบบ</button></div>
<div><h2>สร้างบัญชี Pilot</h2><label class="field">อีเมล<input id="signupEmail" type="email" autocomplete="email"></label><label class="field">รหัสผ่านใหม่<input id="signupPassword" type="password" minlength="8" autocomplete="new-password"></label><button id="signupBtn" class="btn" type="button">สร้างบัญชี</button></div>
</div>
<div id="status" class="status">ยังไม่ได้เข้าสู่ระบบ</div>
</section>
</main>
<script>
const BASE='https://bswokqqhfuvmsomzulyl.supabase.co';
const KEY='sb_publishable_ZRVlOTC0jJIaFxPJrqYpUA_ZgrTnHOZ';
const $=id=>document.getElementById(id);
const show=(msg,kind='')=>{const n=$('status');n.textContent=msg;n.className='status'+(kind?' '+kind:'')};
async function jsonFetch(url,opts={}){const r=await fetch(url,{...opts,headers:{apikey:KEY,'Content-Type':'application/json',...(opts.headers||{})}});let data=null;try{data=await r.json()}catch{};if(!r.ok)throw new Error((data&&((data.msg)||(data.message)||(data.error_description)||(data.error)))||('HTTP '+r.status));return data;}
async function claim(accessToken){const r=await fetch(BASE+'/rest/v1/rpc/claim_work_pilot_invite',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:'{}'});const data=await r.json();if(!r.ok)throw new Error(data.message||'Claim failed');return data;}
$('signupBtn').onclick=async()=>{const email=$('signupEmail').value.trim(),password=$('signupPassword').value;if(!email)return show('กรุณากรอกอีเมล','error');if(password.length<8)return show('รหัสผ่านอย่างน้อย 8 ตัวอักษร','error');show('กำลังสร้างบัญชี...');try{const data=await jsonFetch(BASE+'/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});if(data.access_token){const c=await claim(data.access_token);show('สร้างบัญชีสำเร็จ และตรวจสิทธิ Pilot แล้ว: '+JSON.stringify(c),'ok')}else show('สร้างบัญชีแล้ว กรุณาตรวจอีเมลเพื่อยืนยัน จากนั้นกลับมาเข้าสู่ระบบ','ok')}catch(e){show('สร้างบัญชีไม่สำเร็จ: '+e.message,'error')}};
$('loginBtn').onclick=async()=>{const email=$('loginEmail').value.trim(),password=$('loginPassword').value;if(!email||!password)return show('กรุณากรอกอีเมลและรหัสผ่าน','error');show('กำลังเข้าสู่ระบบ...');try{const data=await jsonFetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});const c=await claim(data.access_token);show('เข้าสู่ระบบสำเร็จ ✅\nสิทธิ Pilot: '+JSON.stringify(c),'ok')}catch(e){show('เข้าสู่ระบบไม่สำเร็จ: '+e.message,'error')}};
</script>
</body></html>`;

Deno.serve((_req: Request) => {
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://bswokqqhfuvmsomzulyl.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
  return new Response(new TextEncoder().encode(html), { status: 200, headers });
});