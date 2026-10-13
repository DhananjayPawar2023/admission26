-- ==============================================================================
-- MGM UNIVERSITY - IICT ADMISSIONS
-- Migration 005: Additive Direct Applications Storage, Security & Privacy Tracking
-- ==============================================================================
-- NOTE: Additive migration. Migration 004 has already been applied.
-- Do NOT drop existing tables or alter existing staff records.

-- ── 1. Create Dedicated Applications Table ─────────────────────────────────────
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text unique not null,
  student_name text not null,
  email text not null,
  phone text not null,
  dob date,
  gender text,
  category text default 'General',
  program_choice text not null,
  degree_level text default 'Undergraduate',
  qualifying_exam text,
  marks_percentage numeric,
  entrance_exam text,
  entrance_roll_no text,
  entrance_score text,
  address text,
  city text,
  state text default 'Maharashtra',
  pincode text,
  guardian_name text,
  guardian_phone text,
  status text not null default 'submitted',
  scrutiny_notes text,
  assigned_to uuid references public.staff_profiles(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for high-performance lookup and staff filtering
create index if not exists idx_applications_app_number on public.applications (upper(trim(application_number)));
create index if not exists idx_applications_phone on public.applications (phone);
create index if not exists idx_applications_email on public.applications (lower(trim(email)));
create index if not exists idx_applications_status on public.applications (status);
create index if not exists idx_applications_created_at on public.applications (created_at desc);
create index if not exists idx_applications_program on public.applications (program_choice);

-- ── 2. Enable Row-Level Security on Applications ───────────────────────────────
alter table public.applications enable row level security;

-- Authorized Staff can view all applications
drop policy if exists "staff can read applications" on public.applications;
create policy "staff can read applications" on public.applications
  for select to authenticated
  using (public.is_staff());

-- Authorized Staff can update application statuses and scrutiny notes
drop policy if exists "staff can update applications" on public.applications;
create policy "staff can update applications" on public.applications
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Public can submit direct applications with field integrity validation
drop policy if exists "anyone can insert applications" on public.applications;
create policy "anyone can insert applications" on public.applications
  for insert to anon, authenticated
  with check (
    length(trim(student_name)) >= 2
    and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and length(regexp_replace(phone, '\D', '', 'g')) = 10
    and length(trim(program_choice)) >= 2
  );

-- ── 3. Stored Procedure: Direct Application Submission ─────────────────────────
create or replace function public.submit_direct_application(
  p_application_number text,
  p_student_name text,
  p_email text,
  p_phone text,
  p_program_choice text,
  p_dob date default null,
  p_gender text default null,
  p_category text default 'General',
  p_degree_level text default 'Undergraduate',
  p_qualifying_exam text default null,
  p_marks_percentage numeric default null,
  p_entrance_exam text default null,
  p_entrance_roll_no text default null,
  p_entrance_score text default null,
  p_address text default null,
  p_city text default null,
  p_state text default 'Maharashtra',
  p_pincode text default null,
  p_guardian_name text default null,
  p_guardian_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
begin
  if length(trim(p_student_name)) < 2 then
    raise exception 'Candidate name is required (minimum 2 characters)';
  end if;
  if p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'A valid email address is required';
  end if;
  if length(regexp_replace(p_phone, '\D', '', 'g')) <> 10 then
    raise exception 'A valid 10-digit mobile number is required';
  end if;
  if length(trim(p_program_choice)) < 2 then
    raise exception 'Deliberate program selection is required';
  end if;

  insert into public.applications (
    application_number,
    student_name,
    email,
    phone,
    dob,
    gender,
    category,
    program_choice,
    degree_level,
    qualifying_exam,
    marks_percentage,
    entrance_exam,
    entrance_roll_no,
    entrance_score,
    address,
    city,
    state,
    pincode,
    guardian_name,
    guardian_phone,
    status
  ) values (
    trim(p_application_number),
    trim(p_student_name),
    lower(trim(p_email)),
    regexp_replace(p_phone, '\D', '', 'g'),
    p_dob,
    p_gender,
    coalesce(p_category, 'General'),
    trim(p_program_choice),
    coalesce(p_degree_level, 'Undergraduate'),
    p_qualifying_exam,
    p_marks_percentage,
    p_entrance_exam,
    p_entrance_roll_no,
    p_entrance_score,
    p_address,
    p_city,
    coalesce(p_state, 'Maharashtra'),
    p_pincode,
    p_guardian_name,
    p_guardian_phone,
    'submitted'
  )
  returning id into v_app_id;

  return jsonb_build_object(
    'success', true,
    'id', v_app_id,
    'application_number', trim(p_application_number),
    'message', 'Application received by IICT Admissions Portal for committee review.'
  );
end;
$$;

revoke all on function public.submit_direct_application from public;
grant execute on function public.submit_direct_application to anon, authenticated;

-- ── 4. Privacy-Preserving Tracker: Application Status Verification ─────────────
-- Requires BOTH Application Number and Registered Mobile Number.
-- Does NOT expose private address, marks, or personal contact info.
create or replace function public.track_application_status(
  p_application_number text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_clean_phone text := regexp_replace(p_phone, '\D', '', 'g');
begin
  if length(v_clean_phone) < 10 then
    return jsonb_build_object(
      'found', false,
      'error', 'Please enter your 10-digit registered mobile number for verification.'
    );
  end if;

  select
    application_number,
    program_choice,
    status,
    created_at,
    updated_at
  into v_rec
  from public.applications
  where upper(trim(application_number)) = upper(trim(p_application_number))
    and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(v_clean_phone, 10);

  if not found then
    return jsonb_build_object(
      'found', false,
      'error', 'No matching application found for this reference number and registered mobile number.'
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'type', 'application',
    'application_number', v_rec.application_number,
    'program_choice', v_rec.program_choice,
    'status', v_rec.status,
    'created_at', v_rec.created_at,
    'updated_at', v_rec.updated_at
  );
end;
$$;

revoke all on function public.track_application_status(text, text) from public;
grant execute on function public.track_application_status(text, text) to anon, authenticated;

-- ── 5. Privacy-Preserving Tracker: Inquiry Status Verification ─────────────────
-- Requires BOTH Inquiry Reference Code and Registered Mobile Number.
-- Prevents public guessing of inquiry reference codes.
create or replace function public.track_inquiry_status(
  p_reference_code text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_clean_phone text := regexp_replace(p_phone, '\D', '', 'g');
begin
  if length(v_clean_phone) < 10 then
    return jsonb_build_object(
      'found', false,
      'error', 'Please enter your 10-digit registered mobile number for verification.'
    );
  end if;

  select
    reference_code,
    program_interest,
    status,
    created_at
  into v_rec
  from public.inquiries
  where upper(trim(reference_code)) = upper(trim(p_reference_code))
    and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(v_clean_phone, 10);

  if not found then
    return jsonb_build_object(
      'found', false,
      'error', 'No matching inquiry found for this reference code and registered mobile number.'
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'type', 'inquiry',
    'reference_code', v_rec.reference_code,
    'program_interest', v_rec.program_interest,
    'status', v_rec.status,
    'created_at', v_rec.created_at
  );
end;
$$;

revoke all on function public.track_inquiry_status(text, text) from public;
grant execute on function public.track_inquiry_status(text, text) to anon, authenticated;
