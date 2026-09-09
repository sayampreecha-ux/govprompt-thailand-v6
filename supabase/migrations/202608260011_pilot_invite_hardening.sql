-- Harden pilot invite claim flow.
-- Direct table access stays denied; claim RPC additionally requires a confirmed email and active target scope.

create index if not exists idx_pilot_invites_organization
  on public.pilot_invites(organization_id);
create index if not exists idx_pilot_invites_department
  on public.pilot_invites(department_id)
  where department_id is not null;
create index if not exists idx_pilot_invites_claimed_by
  on public.pilot_invites(claimed_by)
  where claimed_by is not null;
create unique index if not exists uq_pilot_invites_active_email_org
  on public.pilot_invites(email, organization_id)
  where active = true and claimed_at is null;

-- Explicit deny policy documents the intended posture and satisfies RLS linting.
drop policy if exists pilot_invites_deny_direct_access on public.pilot_invites;
create policy pilot_invites_deny_direct_access on public.pilot_invites
for all to anon, authenticated
using (false)
with check (false);

create or replace function public.claim_work_pilot_invite()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_email_confirmed boolean := false;
  v_invite public.pilot_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select lower(u.email), (u.email_confirmed_at is not null)
  into v_email, v_email_confirmed
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;
  if not v_email_confirmed then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  select i.* into v_invite
  from public.pilot_invites i
  join public.organizations o
    on o.id = i.organization_id and o.active = true
  left join public.departments d
    on d.id = i.department_id
  where i.email = v_email
    and i.active = true
    and i.claimed_at is null
    and (i.expires_at is null or i.expires_at > now())
    and (
      (i.department_id is null and i.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR'))
      or (
        i.department_id is not null
        and i.role in ('DIRECTOR','OFFICER')
        and d.organization_id = i.organization_id
        and d.active = true
      )
    )
  order by i.created_at asc
  limit 1
  for update of i skip locked;

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
    'MEMBERSHIP_CLAIMED', 'ORGANIZATION_MEMBERSHIP', v_uid::text,
    jsonb_build_object(
      'role', v_invite.role,
      'inviteId', v_invite.id::text,
      'source', 'WORK_TRACKING_INVITE_RPC'
    )
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
