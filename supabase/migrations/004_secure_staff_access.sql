-- ==============================================================================
-- Migration 004: Secure Staff Access & Remediate Role Vulnerabilities
-- ==============================================================================
-- Non-destructive corrective migration that:
-- 1. Drops unsafe trigger that automatically granted staff roles to all public signups.
-- 2. Revokes public/anonymous execute permissions on staff management procedures.
-- 3. Enforces Super Admin authorization on grant/revoke functions using trusted database state.
-- 4. Corrects claim_or_sync_staff_profile so uninvited users never receive staff roles.
-- 5. Safely cleans up uninvited accounts auto-granted teacher roles by migration 003.
-- 6. Preserves all existing applicant/inquiry data without modification.
-- ==============================================================================

-- ── 1. Drop Dangerous Automatic Trigger on auth.users ────────────────────────
drop trigger if exists on_auth_user_created_staff on auth.users;
drop function if exists public.handle_new_staff_user();

-- ── 2. Ensure Authoritative is_super_admin and is_staff Functions ─────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and role = 'super_admin'
  ) or (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'dp844771@gmail.com'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid()
  ) or (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'dp844771@gmail.com'
  );
$$;

-- ── 3. Secure claim_or_sync_staff_profile ─────────────────────────────────────
-- Does NOT automatically grant staff roles to uninvited users.
create or replace function public.claim_or_sync_staff_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_profile record;
  v_invite record;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  -- A. Super Admin automatic guarantee
  if v_email = 'dp844771@gmail.com' then
    insert into public.staff_profiles (user_id, email, display_name, role, department)
    values (
      v_uid,
      v_email,
      'Dhananjay Pawar (Super Admin)',
      'super_admin',
      'Admissions Directorate'
    )
    on conflict (user_id) do update set
      role = 'super_admin',
      email = v_email,
      display_name = 'Dhananjay Pawar (Super Admin)';
  end if;

  -- B. Check if there is an explicit pending invite for this email
  select * into v_invite
  from public.pending_staff_invites
  where lower(email) = v_email
  limit 1;

  if v_invite is not null then
    insert into public.staff_profiles (user_id, email, display_name, role, department, created_by)
    values (
      v_uid,
      v_email,
      v_invite.display_name,
      v_invite.role,
      coalesce(v_invite.department, 'IICT Faculty'),
      v_invite.created_by
    )
    on conflict (user_id) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      department = excluded.department,
      email = excluded.email,
      created_by = excluded.created_by;

    delete from public.pending_staff_invites where lower(email) = v_email;
  end if;

  -- C. Check if user already exists in staff_profiles
  select * into v_profile
  from public.staff_profiles
  where user_id = v_uid or lower(email) = v_email
  limit 1;

  if v_profile is not null then
    if v_profile.user_id <> v_uid then
      update public.staff_profiles
      set user_id = v_uid
      where lower(email) = v_email;
    end if;

    return jsonb_build_object(
      'status', 'active',
      'role', v_profile.role,
      'display_name', v_profile.display_name,
      'email', v_email,
      'user_id', v_uid
    );
  end if;

  -- Uninvited / non-staff users receive not_staff status (NO automatic role assignment)
  return jsonb_build_object('status', 'not_staff', 'email', v_email);
end;
$$;

revoke all on function public.claim_or_sync_staff_profile() from public, anon;
grant execute on function public.claim_or_sync_staff_profile() to authenticated;

-- ── 4. Secure grant_staff_access_by_email ─────────────────────────────────────
-- Strictly requires Super Admin caller and revokes public/anon execution
create or replace function public.grant_staff_access_by_email(
  p_email text,
  p_display_name text,
  p_role text default 'teacher',
  p_department text default 'IICT Faculty'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_email text := lower(trim(p_email));
  v_target_user_id uuid;
  v_assigned_role text := coalesce(nullif(trim(p_role), ''), 'teacher');
  v_display text := coalesce(nullif(trim(p_display_name), ''), 'Faculty Member');
  v_dept text := coalesce(nullif(trim(p_department), ''), 'IICT Faculty');
begin
  -- Strict Super Admin authorization check from database state
  if not public.is_super_admin() then
    raise exception 'Permission denied: Only Super Admin can grant staff access';
  end if;

  if length(v_clean_email) < 5 or v_clean_email not like '%@%' then
    raise exception 'Please provide a valid email address';
  end if;

  if v_assigned_role not in ('super_admin', 'teacher', 'counsellor', 'manager', 'admin') then
    v_assigned_role := 'teacher';
  end if;

  -- Look up target user in Supabase auth.users
  select id into v_target_user_id
  from auth.users
  where lower(email) = v_clean_email
  limit 1;

  if v_target_user_id is not null then
    insert into public.staff_profiles (user_id, email, display_name, role, department, created_by)
    values (
      v_target_user_id,
      v_clean_email,
      v_display,
      v_assigned_role,
      v_dept,
      auth.uid()
    )
    on conflict (user_id) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      department = excluded.department,
      email = excluded.email,
      created_by = coalesce(public.staff_profiles.created_by, excluded.created_by);

    delete from public.pending_staff_invites where lower(email) = v_clean_email;

    return jsonb_build_object(
      'status', 'granted_immediately',
      'message', format('Access granted! %s (%s) has been activated as %s.', v_display, v_clean_email, v_assigned_role),
      'user_id', v_target_user_id,
      'email', v_clean_email,
      'role', v_assigned_role
    );
  else
    insert into public.pending_staff_invites (email, display_name, role, department, created_by)
    values (
      v_clean_email,
      v_display,
      v_assigned_role,
      v_dept,
      auth.uid()
    )
    on conflict (email) do update set
      display_name = excluded.display_name,
      role = excluded.role,
      department = excluded.department,
      created_by = coalesce(public.pending_staff_invites.created_by, excluded.created_by);

    return jsonb_build_object(
      'status', 'pre_authorized',
      'message', format('Invitation recorded! %s has been pre-authorized. When they register with %s, their staff access will activate automatically.', v_display, v_clean_email),
      'email', v_clean_email,
      'role', v_assigned_role
    );
  end if;
end;
$$;

revoke all on function public.grant_staff_access_by_email(text, text, text, text) from public, anon;
grant execute on function public.grant_staff_access_by_email(text, text, text, text) to authenticated;

-- ── 5. Secure revoke_staff_access ─────────────────────────────────────────────
create or replace function public.revoke_staff_access(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_email text := lower(trim(p_email));
begin
  if not public.is_super_admin() then
    raise exception 'Permission denied: Only Super Admin can revoke staff access';
  end if;

  if v_clean_email = 'dp844771@gmail.com' then
    raise exception 'Cannot revoke Super Admin access';
  end if;

  delete from public.staff_profiles where lower(email) = v_clean_email;
  delete from public.pending_staff_invites where lower(email) = v_clean_email;

  return jsonb_build_object(
    'status', 'revoked',
    'message', format('Access for %s has been revoked.', v_clean_email)
  );
end;
$$;

revoke all on function public.revoke_staff_access(text) from public, anon;
grant execute on function public.revoke_staff_access(text) to authenticated;

-- ── 6. Safely Remediate Unintended Role Grants from Migration 003 ─────────────
-- Preserve Super Admin, accounts with explicit delegation (created_by is set),
-- and accounts in pending_staff_invites. Remove uninvited accounts that were
-- mass-assigned teacher roles by migration 003.
delete from public.staff_profiles
where lower(email) <> 'dp844771@gmail.com'
  and role <> 'super_admin'
  and created_by is null
  and lower(email) not in (select lower(email) from public.pending_staff_invites);

-- ── 7. Reinforce Inquiries and Staff Profiles RLS ─────────────────────────────
alter table public.inquiries enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.pending_staff_invites enable row level security;

-- Inquiries: ONLY staff can view or modify inquiries.
drop policy if exists "staff can read inquiries" on public.inquiries;
create policy "staff can read inquiries" on public.inquiries
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff can update inquiries" on public.inquiries;
create policy "staff can update inquiries" on public.inquiries
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Staff Profiles: Staff can view; only Super Admin can modify
drop policy if exists "staff can read staff profiles" on public.staff_profiles;
create policy "staff can read staff profiles" on public.staff_profiles
  for select to authenticated
  using (public.is_staff());

drop policy if exists "super admin can manage staff profiles" on public.staff_profiles;
create policy "super admin can manage staff profiles" on public.staff_profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Pending Staff Invites: Staff can view; only Super Admin can manage
drop policy if exists "staff can read pending invites" on public.pending_staff_invites;
create policy "staff can read pending invites" on public.pending_staff_invites
  for select to authenticated
  using (public.is_staff());

drop policy if exists "super admin can manage pending invites" on public.pending_staff_invites;
create policy "super admin can manage pending invites" on public.pending_staff_invites
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
