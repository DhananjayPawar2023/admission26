-- ==============================================================================
-- MGM UNIVERSITY - IICT ADMISSIONS
-- Migration 006: Inquiry Privacy Hardening & Single-Key RPC Deprecation
-- ==============================================================================
-- NOTE: Additive security hardening migration.
-- Preserves existing tables, applications, and migration 004/005 data.
-- Revokes public/anon access to single-key inquiry lookups that exposed candidate names.

-- ── 1. Revoke and Deprecate Single-Factor get_my_inquiry_status ───────────────
-- In Migration 001, public.get_my_inquiry_status(p_reference_code text) was granted
-- to anon/authenticated and returned student_name with only reference_code known.
-- We revoke public execution and replace it with a secure exception handler directing
-- clients to the privacy-preserving dual-factor track_inquiry_status function.

revoke execute on function public.get_my_inquiry_status(text) from public, anon;

create or replace function public.get_my_inquiry_status(p_reference_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Restrict legacy function to authenticated staff only
  if not (public.is_staff()) then
    raise exception 'Single-factor inquiry lookup is deprecated for applicant privacy. Please use track_inquiry_status(p_reference_code, p_phone) with registered mobile number verification.';
  end if;

  return (
    select json_build_object(
      'reference_code', reference_code,
      'program_interest', program_interest,
      'status', status,
      'created_at', created_at
    )
    from public.inquiries
    where upper(trim(reference_code)) = upper(trim(p_reference_code))
  );
end;
$$;

revoke all on function public.get_my_inquiry_status(text) from public, anon;
grant execute on function public.get_my_inquiry_status(text) to authenticated;

-- ── 2. Ensure Dual-Factor Trackers are Permitted for Public Verification ───────
grant execute on function public.track_inquiry_status(text, text) to anon, authenticated;
grant execute on function public.track_application_status(text, text) to anon, authenticated;
grant execute on function public.submit_direct_application(
  text, text, text, text, text, date, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ── 3. Verify Table Read Restrictions ──────────────────────────────────────────
-- Ensure unauthenticated/anon callers cannot perform direct SELECT queries on inquiries or applications
revoke select on table public.inquiries from anon;
revoke select on table public.applications from anon;
revoke select on table public.staff_profiles from anon;
revoke select on table public.pending_staff_invites from anon;

-- Ensure authenticated staff retain authorized operational access
grant select, update on table public.inquiries to authenticated;
grant select, update on table public.applications to authenticated;
grant select on table public.staff_profiles to authenticated;
