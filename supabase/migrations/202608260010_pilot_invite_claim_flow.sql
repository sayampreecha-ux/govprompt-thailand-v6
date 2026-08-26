-- Pilot invitation claim flow.
-- Invitations are provisioned by a trusted admin/server path; signed-in users may only claim an invite matching their verified identity.

create table if not exists public.pilot_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  email text not null check (email = lower(email)),
  role text not null check (role in ('ORG_ADMIN','EXECUTIVE','DIRECTOR','OFFICER','AUDITOR')),
  active boolean not null default true,
  expires_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (role in ('ORG_ADMIN','EXECUTIVE','AUDITOR') and department_id is null)
    or (role in ('DIRECTOR','OFFICER') and department_id is not null)
  )
);

alter table public.pilot_invites enable row level security;
revoke all on public.pilot_invites from anon, authenticated;

create index if not exists idx_pilot_invites_email_active
  on public.pilot_invites(email, active)
  where claimed_at is null;

create or replace function public.claim_work_pilot_invite()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.pilot_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select * into v_invite
  from public.pilot_invites i
  where i.email = v_email
    and i.active = true
    and i.claimed_at is null
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at asc
  limit 1
  for update skip locked;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'code', 'NO_ACTIVE_INVITE');
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, department_id, role, active
  ) values (
    v_invite.organization_id, v_uid, v_invite.department_id, v_invite.role, true
  )
  on conflict (organization_id, user_id)
  do update set
    department_id = excluded.department_id,
    role = excluded.role,
    active = true,
    updated_at = now();

  update public.pilot_invites
  set claimed_by = v_uid,
      claimed_at = now(),
      active = false
  where id = v_invite.id;

  insert into public.audit_events (
    organization_id, department_id, actor_user_id,
    action, entity_type, entity_id, metadata_json
  ) values (
    v_invite.organization_id, v_invite.department_id, v_uid,
    'MEMBERSHIP_CLAIMED', 'organization_membership', v_uid::text,
    jsonb_build_object('role', v_invite.role, 'invite_id', v_invite.id)
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_invite.organization_id,
    'department_id', v_invite.department_id,
    'role', v_invite.role
  );
end;
$$;

revoke all on function public.claim_work_pilot_invite() from public, anon;
grant execute on function public.claim_work_pilot_invite() to authenticated;
