const cleanEmail = (value) => String(value || '').trim().toLowerCase();

export function getMagicLinkRetrySeconds(error) {
  const message = String(error?.message || error || '');
  const explicit = message.match(/after\s+(\d+)\s+seconds?/i)
    || message.match(/retry\s+(?:in|after)\s+(\d+)\s+seconds?/i)
    || message.match(/(\d+)\s*seconds?/i);
  if (explicit) return Math.max(1, Number(explicit[1]));
  if (Number(error?.status) === 429 || /rate\s*limit|too many requests/i.test(message)) return 60;
  return 0;
}

export function describeMagicLinkError(error) {
  const retryAfterSeconds = getMagicLinkRetrySeconds(error);
  if (retryAfterSeconds > 0) {
    return {
      retryAfterSeconds,
      message: `ระบบส่งอีเมลถึงขีดจำกัดชั่วคราว กรุณารออีก ${retryAfterSeconds} วินาที หรือใช้ “เข้าสู่ระบบด้วยรหัสผ่าน (สำรอง)” ด้านล่าง`,
    };
  }

  const code = String(error?.code || '');
  if (code === 'VALID_EMAIL_REQUIRED') {
    return { retryAfterSeconds: 0, message: 'กรุณาตรวจสอบรูปแบบอีเมลให้ถูกต้อง' };
  }

  return {
    retryAfterSeconds: 0,
    message: 'ส่งลิงก์เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หรือใช้การเข้าสู่ระบบด้วยรหัสผ่านสำหรับบัญชีเดิม',
  };
}

export async function requestPilotMagicLink({ client, email, redirectTo } = {}) {
  const normalizedEmail = cleanEmail(email);
  if (!client?.auth?.signInWithOtp) throw new Error('SUPABASE_CLIENT_REQUIRED');
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    const error = new Error('VALID_EMAIL_REQUIRED');
    error.code = 'VALID_EMAIL_REQUIRED';
    throw error;
  }

  const options = { shouldCreateUser: true };
  if (redirectTo) options.emailRedirectTo = String(redirectTo);

  const { data, error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options,
  });
  if (error) throw error;
  return { ok: true, email: normalizedEmail, data };
}

export async function signInPilotWithPassword({ client, email, password } = {}) {
  const normalizedEmail = cleanEmail(email);
  if (!client?.auth?.signInWithPassword) throw new Error('SUPABASE_CLIENT_REQUIRED');
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    const error = new Error('VALID_EMAIL_REQUIRED');
    error.code = 'VALID_EMAIL_REQUIRED';
    throw error;
  }
  if (!String(password || '')) {
    const error = new Error('PASSWORD_REQUIRED');
    error.code = 'PASSWORD_REQUIRED';
    throw error;
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password),
  });
  if (error) throw error;
  return { ok: true, email: normalizedEmail, data };
}

export async function claimPilotInvite(client) {
  if (!client?.rpc) throw new Error('SUPABASE_CLIENT_REQUIRED');
  const { data, error } = await client.rpc('claim_work_pilot_invite');
  if (error) throw error;
  return data || { ok: false, code: 'EMPTY_CLAIM_RESPONSE' };
}

export async function loadOwnMemberships(client) {
  if (!client?.from) throw new Error('SUPABASE_CLIENT_REQUIRED');
  const { data, error } = await client
    .from('organization_memberships')
    .select('organization_id,department_id,role,active,organizations(name),departments(name)')
    .eq('active', true);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPilotSession(client) {
  if (!client?.auth?.getSession) throw new Error('SUPABASE_CLIENT_REQUIRED');
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function signOutPilot(client) {
  if (!client?.auth?.signOut) throw new Error('SUPABASE_CLIENT_REQUIRED');
  const { error } = await client.auth.signOut();
  if (error) throw error;
  return true;
}
