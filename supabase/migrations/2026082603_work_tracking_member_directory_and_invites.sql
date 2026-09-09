-- Privacy-minimal member directory and invite administration for the Work Tracking Pilot.
-- Browser clients never receive auth.users email lists. Assignment lookup returns only display name, role and scoped ids.

alter table public.organization_memberships
  add column if not exists display_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_memberships_display_name_check'
      and conrelid = 'public.organization_memberships'::regclass
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_display_name_check
      check (display_name is null or char_length(btrim(display_name)) between 1 and 120);
  end if;
end
$$;

create or replace function public.set_my_work_display_name(
  p_organization_id uuid,
  p_display_name text
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(p_display_name), '');
  v_membership public.organization_memberships%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;
  if v_name is null or char_length(v_name) > 120 then raise exception 'INVALID_DISPLAY_NAME'; end if;

  select m.* into v_membership
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = v_uid
    and m.active = true
  for update;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if v_membership.display_name is not distinct from v_name then
    return v_membership;
  end if;

  update public.organization_memberships
  set display_name = v_name,
      updated_at = now()
  where id = v_membership.id
  returning * into v_membership;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, metadata_json
  ) values (
    v_membership.organization_id,
    v_membership.department_id,
    v_uid,
    'MEMBERSHIP_PROFILE_UPDATED',
    'ORGANIZATION_MEMBERSHIP',
    v_membership.id::text,
    now(),
    jsonb_build_object('changedFields', jsonb_build_array('displayName'), 'source', 'WORK_TRACKING_RPC')
  );

  return v_membership;
end;
$$;

create or replace function public.list_assignable_work_members(
  p_organization_id uuid,
  p_department_id uuid
)
returns table(
  user_id uuid,
  department_id uuid,
  display_name text,
  role text
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_caller public.organization_memberships%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null or p_department_id is null then raise exception 'SCOPE_REQUIRED'; end if;

  select m.* into v_caller
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = v_uid
    and m.active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if v_caller.role not in ('ORG_ADMIN','DIRECTOR') then raise exception 'ROLE_FORBIDDEN'; end if;
  if v_caller.role = 'DIRECTOR' and v_caller.department_id is distinct from p_department_id then
    raise exception 'DEPARTMENT_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id
      and d.organization_id = p_organization_id
      and d.active = true
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  return query
  select
    m.user_id,
    m.department_id,
    coalesce(nullif(btrim(m.display_name), ''), m.role || ' · ' || left(m.user_id::text, 8)) as display_name,
    m.role
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.department_id = p_department_id
    and m.active = true
    and m.role in ('DIRECTOR','OFFICER')
  order by coalesce(nullif(btrim(m.display_name), ''), m.role), m.created_at;
end;
$$;

create or replace function public.create_work_pilot_invite(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_department_id uuid default null,
  p_expires_at timestamptz default null
)
returns public.pilot_invites
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(btrim(p_email), ''));
  v_caller public.organization_memberships%rowtype;
  v_invite public.pilot_invites%rowtype;
  v_existing_uid uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
  if p_role not in ('EXECUTIVE','DIRECTOR','OFFICER','AUDITOR') then raise exception 'INVITE_ROLE_NOT_ALLOWED'; end if;

  select m.* into v_caller
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = v_uid
    and m.active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if v_caller.role <> 'ORG_ADMIN' then raise exception 'ROLE_FORBIDDEN'; end if;

  if p_role in ('DIRECTOR','OFFICER') then
    if p_department_id is null then raise exception 'DEPARTMENT_REQUIRED'; end if;
    if not exists (
      select 1 from public.departments d
      where d.id = p_department_id
        and d.organization_id = p_organization_id
        and d.active = true
    ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;
  elsif p_department_id is not null then
    raise exception 'DEPARTMENT_NOT_ALLOWED_FOR_ROLE';
  end if;

  select u.id into v_existing_uid
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_existing_uid is not null and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = v_existing_uid
      and m.active = true
  ) then raise exception 'MEMBER_ALREADY_ACTIVE'; end if;

  update public.pilot_invites
  set active = false
  where organization_id = p_organization_id
    and email = v_email
    and active = true
    and claimed_at is null;

  insert into public.pilot_invites(
    organization_id, department_id, email, role, active, expires_at
  ) values (
    p_organization_id,
    case when p_role in ('DIRECTOR','OFFICER') then p_department_id else null end,
    v_email,
    p_role,
    true,
    coalesce(p_expires_at, now() + interval '7 days')
  ) returning * into v_invite;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, metadata_json
  ) values (
    p_organization_id,
    v_invite.department_id,
    v_uid,
    'PILOT_INVITE_CREATED',
    'PILOT_INVITE',
    v_invite.id::text,
    now(),
    jsonb_build_object('role', v_invite.role, 'expiresAt', v_invite.expires_at, 'source', 'WORK_TRACKING_RPC')
  );

  return v_invite;
end;
$$;

revoke all on function public.set_my_work_display_name(uuid,text) from public, anon;
grant execute on function public.set_my_work_display_name(uuid,text) to authenticated;
revoke all on function public.list_assignable_work_members(uuid,uuid) from public, anon;
grant execute on function public.list_assignable_work_members(uuid,uuid) to authenticated;
revoke all on function public.create_work_pilot_invite(uuid,text,text,uuid,timestamptz) from public, anon;
grant execute on function public.create_work_pilot_invite(uuid,text,text,uuid,timestamptz) to authenticated;
