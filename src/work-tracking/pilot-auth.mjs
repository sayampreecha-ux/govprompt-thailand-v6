const cleanEmail = (value) => String(value || '').trim().toLowerCase();

export async function requestPilotMagicLink({ client, email, redirectTo } = {}) {
  const normalizedEmail = cleanEmail(email);
  if (!client?.auth?.signInWithOtp) throw new Error('SUPABASE_CLIENT_REQUIRED');
  if (!normalizedEmail || !normalizedEmail.includes('@')) throw new Error('VALID_EMAIL_REQUIRED');

  const options = { shouldCreateUser: true };
  if (redirectTo) options.emailRedirectTo = String(redirectTo);

  const { data, error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options,
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
