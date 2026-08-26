export const PILOT_SUPABASE_URL = 'https://bswokqqhfuvmsomzulyl.supabase.co';
export const PILOT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZRVlOTC0jJIaFxPJrqYpUA_ZgrTnHOZ';

export function assertPilotSupabaseConfig() {
  if (!PILOT_SUPABASE_URL.startsWith('https://')) throw new Error('PILOT_SUPABASE_URL_INVALID');
  if (!PILOT_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    throw new Error('PILOT_SUPABASE_PUBLISHABLE_KEY_INVALID');
  }
  if (/service_role|sb_secret_/i.test(PILOT_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('SERVER_SECRET_MUST_NOT_BE_EXPOSED');
  }
  return true;
}
