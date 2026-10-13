-- ==============================================================================
-- MGM UNIVERSITY - IICT ADMISSIONS
-- Migration 007: Additive Email Notification Tracking & Audit Logs
-- ==============================================================================
-- NOTE: 100% additive migration. Preserves migrations 004, 005, and 006.
-- Adds notification tracking metadata columns and an audit log table.
-- Do NOT drop existing tables or alter existing applicant records.

-- ── 1. Notification Tracking Columns on Applications ───────────────────────────
alter table public.applications
  add column if not exists last_notification_status text default null,
  add column if not exists last_notification_error text default null,
  add column if not exists last_notification_at timestamptz default null,
  add column if not exists notified_status text default null;

-- ── 2. Notification Tracking Columns on Inquiries ──────────────────────────────
alter table public.inquiries
  add column if not exists last_reply_sent_at timestamptz default null,
  add column if not exists last_reply_email_status text default null,
  add column if not exists last_reply_email_error text default null;

-- ── 3. Dedicated Notification Audit Logs Table ─────────────────────────────────
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  notification_type text not null, -- 'application_status_update' | 'inquiry_counsellor_reply'
  reference_id text not null,     -- application_number or reference_code
  subject text not null,
  body_preview text,
  status text not null default 'pending', -- 'sent', 'failed', 'not_configured', 'skipped_duplicate', 'mock_sent'
  provider text,                  -- 'resend', 'smtp', 'mock'
  error_message text,
  sent_by uuid references public.staff_profiles(user_id),
  created_at timestamptz default now()
);

-- Indexes for performance and lookup
create index if not exists idx_notification_logs_ref on public.notification_logs(reference_id);
create index if not exists idx_notification_logs_created on public.notification_logs(created_at desc);
create index if not exists idx_notification_logs_status on public.notification_logs(status);

-- Enable Row-Level Security
alter table public.notification_logs enable row level security;

-- Authorized Staff can view notification audit logs
drop policy if exists "staff can read notification logs" on public.notification_logs;
create policy "staff can read notification logs" on public.notification_logs
  for select to authenticated
  using (public.is_staff());

grant select on table public.notification_logs to authenticated;
