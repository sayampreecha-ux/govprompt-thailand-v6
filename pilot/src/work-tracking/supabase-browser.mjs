import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bswokqqhfuvmsomzulyl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZRVlOTC0jJIaFxPJrqYpUA_ZgrTnHOZ';

// Publishable keys are designed for browser use. Security must come from Auth + RLS.
// Privileged server credentials must never be shipped in this client module.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getPilotSessionContext() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session?.user?.id) return { session: null, memberships: [] };

  const appMetadata = session.user.app_metadata || {};
  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select('organization_id, department_id, role, active')
    .eq('user_id', session.user.id)
    .eq('active', true);
  if (error) throw error;

  return {
    session: {
      userId: session.user.id,
      mustChangePassword: appMetadata.must_change_password === true,
      user: { id: session.user.id, app_metadata: appMetadata },
    },
    memberships: (memberships || []).map((item) => ({
      userId: session.user.id,
      organizationId: item.organization_id,
      departmentId: item.department_id,
      role: item.role,
      active: item.active,
    })),
  };
}
