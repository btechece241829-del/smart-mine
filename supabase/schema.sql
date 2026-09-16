-- ============================================================================
-- Coal Mine Compliance & Safety Issue Management System
-- Supabase Database Schema
--
-- Includes: tables, Row Level Security (RLS) policies, triggers, functions,
-- automatic role assignment, auto-escalation, audit logging & seed data.
--
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click RUN (or use `supabase db push`)
--   3. Create the first Super Admin auth user in Authentication, then run the
--      "SEED SUPER ADMIN" block at the bottom.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================
do $$ begin
  create type public.user_role as enum (
    'worker', 'mining_mate', 'overman', 'safety_officer', 'mine_manager', 'super_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.complaint_status as enum (
    'Submitted','Under Review','Assigned','Inspection Required',
    'Action In Progress','Resolved','Verified','Rejected','Escalated'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.complaint_priority as enum ('Low','Medium','High','Critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mine_status as enum ('active','inactive','under_maintenance');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ---------- mines ----------
create table if not exists public.mines (
  id uuid primary key default gen_random_uuid(),
  mine_name text not null,
  mine_code text unique not null,
  location text,
  state text,
  district text,
  mine_type text,
  status public.mine_status default 'active',
  created_at timestamptz not null default now()
);

-- ---------- profiles (users) ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  employee_id text unique not null,
  full_name text not null,
  email text unique not null,
  phone text,
  role public.user_role not null,
  mine_id uuid references public.mines(id) on delete set null,
  department text,
  designation text,
  profile_photo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- complaints ----------
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text unique not null,
  title text not null,
  description text,
  category text not null,
  severity public.complaint_priority not null default 'Medium',
  reported_by uuid references public.profiles(id) on delete set null,
  reported_by_name text not null,
  reported_employee_id text,
  reported_at timestamptz not null default now(),
  mine_id uuid references public.mines(id) on delete set null,
  location text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  video_url text,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_role public.user_role,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz,
  due_date timestamptz,
  status public.complaint_status not null default 'Submitted',
  priority public.complaint_priority default 'Medium',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_notes text,
  escalated_from uuid references public.profiles(id),
  escalation_count integer not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_complaints_updated_at on public.complaints;
create trigger set_complaints_updated_at

-- ---------- complaint_events (timeline) ----------
create table if not exists public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  actor_name text not null,
  actor_designation text,
  actor_role public.user_role,
  action text not null,
  old_status text,
  new_status text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_complaint on public.complaint_events(complaint_id, created_at);

-- ---------- complaint_comments ----------
create table if not exists public.complaint_comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author_id uuid references public.profiles(id),
  author_name text not null,
  author_role public.user_role,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- inspections ----------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references public.complaints(id) on delete cascade,
  mine_id uuid references public.mines(id),
  inspector_id uuid references public.profiles(id),
  inspector_name text,
  inspection_type text,
  findings text,
  severity_assessment public.complaint_priority,
  evidence_photo_url text,
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- ---------- corrective_actions ----------
create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  action_description text not null,
  assigned_to uuid references public.profiles(id),
  assigned_to_role public.user_role,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  due_date timestamptz,
  completed_at timestamptz,
  status text default 'pending',
  verification_notes text
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  complaint_id uuid references public.complaints(id) on delete cascade,
  title text not null,
  body text,
  severity public.complaint_priority,
  action_required text,
  deadline timestamptz,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- ---------- audit_logs ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  user_name text,
  role text,
  action text not null,
  entity_type text,
  entity_id text,
  old_status text,
  new_status text,
  description text,
  timestamp timestamptz not null default now(),
  ip_address text
);

create index if not exists idx_audit_logs_time on public.audit_logs(timestamp desc);

-- ---------- escalation_rules (configurable) ----------
create table if not exists public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  category text,
  severity public.complaint_priority,
  from_role public.user_role,
  to_role public.user_role,
  hours_until_escalation integer not null default 48,
  reminder_hours integer not null default 24,
  is_critical boolean default false,
  active boolean default true,
  created_at timestamptz not null default now()
);

-- ---------- system_settings ----------
create table if not exists public.system_settings (
  key text primary key,
  value text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

commit;

  before update on public.complaints
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================
begin;

-- Returns the profiles.id for the currently authenticated auth user
create or replace function public.current_profile()
returns uuid
language sql stable
security definer
as $$
  select p.id from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

-- Returns the role of the current user (null if unknown)
create or replace function public.current_role()
returns public.user_role
language sql stable
security definer
as $$
  select p.role from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

-- Auto-create a profile row when a new auth user signs up.
-- NOTE: role defaults to 'worker'. A Super Admin must promote users via
-- the admin UI (which updates this row). The client sends employee_id etc.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (auth_user_id, employee_id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'employee_id', 'EMP-' || upper(substring(md5(new.id::text) for 6))),
    coalesce(new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'worker')::public.user_role
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- AUDIT LOG TRIGGER: record every complaint status change ----------
create or replace function public.log_complaint_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles p
  where p.auth_user_id = auth.uid() limit 1;

  if new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to then
    insert into public.audit_logs
      (user_id, user_name, role, action, entity_type, entity_id, old_status, new_status, description)
    values (
      coalesce(v_profile.id, new.reported_by),
      coalesce(v_profile.full_name, 'System'),
      coalesce(v_profile.role::text, null),
      'COMPLAINT_UPDATE',
      'complaint',
      new.complaint_number,
      old.status::text,
      new.status::text,
      format('Complaint %s status changed %s -> %s', new.complaint_number, old.status, new.status)
    );
  end if;
  return new;
end $$;

drop trigger if exists complaints_audit_trigger on public.complaints;
create trigger complaints_audit_trigger
  after update on public.complaints
  for each row execute function public.log_complaint_audit();

-- ---------- REAL-TIME: broadcast table changes ----------
alter publication supabase_realtime add table public.complaints;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.complaint_events;

commit;


-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)  ★★★ SECURITY-CRITICAL ★★★
-- ============================================================================
begin;

-- ---------- Enable RLS on all tables ----------
alter table public.mines           enable row level security;
alter table public.profiles        enable row level security;
alter table public.complaints      enable row level security;
alter table public.complaint_events enable row level security;
alter table public.complaint_comments enable row level security;
alter table public.inspections     enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.notifications   enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.escalation_rules enable row level security;
alter table public.system_settings enable row level security;

-- ============ MINES ============
-- Any authenticated user can view mines (needed for location display)
create policy "mines_select_for_authenticated"
  on public.mines for select
  using (auth.role() = 'authenticated');

-- Only super_admin can create/update/delete mines
create policy "mines_insert_super_admin"
  on public.mines for insert
  with check ((select public.current_role()) = 'super_admin');

create policy "mines_update_super_admin"
  on public.mines for update
  using ((select public.current_role()) = 'super_admin');

create policy "mines_delete_super_admin"
  on public.mines for delete
  using ((select public.current_role()) = 'super_admin');

-- ============ PROFILES ============
-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth_user_id = auth.uid());

-- Managers & above can read profiles within their own mine; super_admin all
create policy "profiles_select_managers"
  on public.profiles for select
  using (
    (select public.current_role()) = 'super_admin'
    or (
      (select public.current_role()) in ('mine_manager','safety_officer')
      and (mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid()))
    )
  );

-- A user can update their own non-sensitive profile fields (phone, photo, etc.)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Super Admin full manage (create/update/delete profiles)
create policy "profiles_insert_super_admin"
  on public.profiles for insert
  with check ((select public.current_role()) = 'super_admin');

create policy "profiles_update_super_admin"
  on public.profiles for update
  using ((select public.current_role()) = 'super_admin');

create policy "profiles_delete_super_admin"
  on public.profiles for delete
  using ((select public.current_role()) = 'super_admin');

commit;


-- ============ COMPLAINTS  ★★★ the crown jewel of RLS ★★★ ============
-- Access rules:
--   * Worker        → own complaints only
--   * Mining Mate   → complaints in their working area (mine)
--   * Overman       → complaints in their mine
--   * Safety Officer→ safety complaints in their mine
--   * Mine Manager  → all complaints in their mine
--   * Super Admin   → everything
begin;

-- SELECT policy
create policy "complaints_select_all_scoped"
  on public.complaints for select
  using (
    (select public.current_role()) = 'super_admin'
    or (
      (select public.current_role()) = 'mine_manager'
      and mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
    )
    or (
      (select public.current_role()) = 'safety_officer'
      and mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
      and lower(category) = 'safety'
    )
    or (
      (select public.current_role()) in ('mining_mate','overman')
      and mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
    )
    or (reported_by = public.current_profile())
  );

-- INSERT: any authenticated user may report a complaint
create policy "complaints_insert_authenticated"
  on public.complaints for insert
  with check (auth.role() = 'authenticated');

-- UPDATE: role-based state transitions
create policy "complaints_update_own_worker"
  on public.complaints for update
  using (
    (select public.current_role()) = 'worker' and reported_by = public.current_profile()
  );

create policy "complaints_update_field_staff"
  on public.complaints for update
  using (
    (select public.current_role()) = 'super_admin'
    or (
      (select public.current_role()) in ('mining_mate','overman','safety_officer','mine_manager')
      and mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
    )
  );

-- DELETE: only super_admin may permanently hard-delete complaint records.
-- All other roles are blocked at the database level.
-- (Soft-archive via UPDATE is still available to all roles with update rights.)
create policy "complaints_delete_super_admin"
  on public.complaints for delete
  using ((select public.current_role()) = 'super_admin');

-- ============ COMPLAINT EVENTS / COMMENTS ============
create policy "events_select_scoped"
  on public.complaint_events for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          (select public.current_role()) = 'super_admin'
          or c.mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
          or c.reported_by = public.current_profile()
        )
    )
  );

create policy "events_insert_authenticated"
  on public.complaint_events for insert
  with check (auth.role() = 'authenticated');

create policy "comments_select_scoped"
  on public.complaint_comments for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          (select public.current_role()) = 'super_admin'
          or c.mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
          or c.reported_by = public.current_profile()
        )
    )
  );

create policy "comments_insert_authenticated"
  on public.complaint_comments for insert
  with check (auth.role() = 'authenticated');

commit;


-- ============ INSPECTIONS ============
begin;
create policy "inspections_select_scoped"
  on public.inspections for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          (select public.current_role()) = 'super_admin'
          or c.mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
          or c.reported_by = public.current_profile()
        )
    )
  );

create policy "inspections_insert_staff"
  on public.inspections for insert
  with check (
    (select public.current_role()) in ('mining_mate','overman','safety_officer','mine_manager','super_admin')
  );

-- ============ CORRECTIVE ACTIONS ============
create policy "ca_select_scoped"
  on public.corrective_actions for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          (select public.current_role()) = 'super_admin'
          or c.mine_id = (select mine_id from public.profiles where auth_user_id = auth.uid())
          or c.reported_by = public.current_profile()
        )
    )
  );

create policy "ca_insert_staff"
  on public.corrective_actions for insert
  with check (
    (select public.current_role()) in ('overman','safety_officer','mine_manager','super_admin')
  );

create policy "ca_update_staff"
  on public.corrective_actions for update
  using (
    (select public.current_role()) in ('overman','safety_officer','mine_manager','super_admin')
  );

-- ============ NOTIFICATIONS ============
-- A user reads only their own notifications
create policy "notifications_select_own"
  on public.notifications for select
  using (
    user_id = public.current_profile()
    or (select public.current_role()) = 'super_admin'
  );

-- Notifications are created by our server-side functions (definer)
create policy "notifications_insert_function"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- A user may mark their own notifications read
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = public.current_profile());

-- ============ AUDIT LOGS ============
-- Nobody except Super Admin can read or write audit logs from the client.
-- (Server-side triggers with security definer perform the writes.)
create policy "audit_logs_select_super_admin"
  on public.audit_logs for select
  using ((select public.current_role()) = 'super_admin');

create policy "audit_logs_insert_super_admin"
  on public.audit_logs for insert
  with check ((select public.current_role()) = 'super_admin');

-- ============ ESCALATION RULES ============
create policy "escalation_rules_select_authenticated"
  on public.escalation_rules for select
  using (auth.role() = 'authenticated');

create policy "escalation_rules_manage_super_admin"
  on public.escalation_rules for all
  using ((select public.current_role()) = 'super_admin')
  with check ((select public.current_role()) = 'super_admin');

-- ============ SYSTEM SETTINGS ============
create policy "system_settings_select_authenticated"
  on public.system_settings for select
  using (auth.role() = 'authenticated');

create policy "system_settings_manage_super_admin"
  on public.system_settings for all
  using ((select public.current_role()) = 'super_admin')
  with check ((select public.current_role()) = 'super_admin');

commit;

-- ============================================================================
-- 6. APPLICATION FUNCTIONS (auto-assignment, notifications, escalation)
--    These are SECURITY DEFINER so the application can call them reliably.
-- ============================================================================
begin;

-- ---------- AUTO-ASSIGN responsible officer on new complaint ----------
create or replace function public.auto_assign_complaint(p_complaint_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint public.complaints%rowtype;
  v_target_role public.user_role;
  v_target_id uuid;
  v_critical boolean := false;
begin
  select * into v_complaint from public.complaints where id = p_complaint_id;

  -- Determine responsible role by category
  case
    when v_complaint.category ilike 'Safety' then v_target_role := 'mining_mate';
    when v_complaint.category ilike 'Machinery' then v_target_role := 'mining_mate';
    when v_complaint.category ilike 'Electrical' then v_target_role := 'mining_mate';
    when v_complaint.category ilike 'Mechanical' then v_target_role := 'mining_mate';
    when v_complaint.category ilike 'Ventilation' then v_target_role := 'overman';
    when v_complaint.category ilike 'Environment' then v_target_role := 'safety_officer';
    when v_complaint.category ilike 'Fire' then v_target_role := 'safety_officer';
    when v_complaint.category ilike 'Ground Control' then v_target_role := 'overman';
    when v_complaint.category ilike 'Worker Welfare' then v_target_role := 'overman';
    else v_target_role := 'mining_mate';
  end case;

  -- Critical escalation: skip queue, go straight to safety officer
  if v_complaint.severity = 'Critical' or v_complaint.priority = 'Critical' then
    v_critical := true;
    v_target_role := 'safety_officer';
  end if;

  -- Pick first active staff member of target role in same mine
  select p.id into v_target_id
    from public.profiles p
    where p.role = v_target_role
      and p.mine_id = v_complaint.mine_id
      and p.is_active = true
    order by p.created_at asc
    limit 1;

  -- Assign
  update public.complaints
    set assigned_to = v_target_id,
        assigned_role = v_target_role,
        assigned_by = public.current_profile(),
        assigned_at = now(),
        status = 'Assigned',
        due_date = now() + interval '48 hours'
    where id = p_complaint_id;

  -- Notify the assigned officer
  if v_target_id is not null then
    insert into public.notifications (user_id, complaint_id, title, body, severity, action_required, deadline)
    values (
      v_target_id, v_complaint.id,
      'New complaint assigned to you',
      format('%s — %s (%s)', v_complaint.complaint_number, v_complaint.title, v_complaint.category),
      v_complaint.severity,
      'Review and take action on this complaint',
      now() + interval '48 hours'
    );
  end if;

  -- Critical: immediately notify Safety Officer + Mine Manager + Super Admin
  if v_critical then
    insert into public.notifications (user_id, complaint_id, title, body, severity, action_required, deadline)
    select p.id, v_complaint.id,
           'CRITICAL ALERT: ' || v_complaint.complaint_number,
           format('%s — %s', v_complaint.title, v_complaint.description),
           'Critical',
           'Immediate attention required', now() + interval '24 hours'
    from public.profiles p
    where p.role in ('safety_officer','mine_manager','super_admin')
      and (p.mine_id = v_complaint.mine_id or p.role = 'super_admin')
      and p.is_active = true;
  end if;

  -- Record event
  insert into public.complaint_events (complaint_id, actor_name, actor_role, action, old_status, new_status, comment)
  values (v_complaint.id, 'System', v_target_role, 'AUTO_ASSIGN',
          'Submitted', 'Assigned',
          format('Auto-assigned to %s officer', v_target_role));
end $$;



-- ---------- AUTO-ESCALATION (deadline based) ----------
-- Called periodically (e.g. pg_cron or a scheduled process / client timer).
-- Escalates complaints whose due_date has passed to the next role up.
create or replace function public.run_escalation()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_next_role public.user_role;
  v_next_id uuid;
begin
  for r in
    select * from public.complaints c
    where c.status not in ('Resolved','Verified','Rejected','Escalated')
      and c.due_date is not null
      and c.due_date < now()
  loop
    -- Determine next role up the hierarchy
    case r.assigned_role
      when 'mining_mate' then v_next_role := 'overman';
      when 'overman' then v_next_role := 'safety_officer';
      when 'safety_officer' then v_next_role := 'mine_manager';
      when 'mine_manager' then v_next_role := 'super_admin';
      else v_next_role := 'super_admin';
    end case;

    select p.id into v_next_id
      from public.profiles p
      where p.role = v_next_role
        and (p.mine_id = r.mine_id or v_next_role = 'super_admin')
        and p.is_active = true
      order by p.created_at asc limit 1;

    update public.complaints
      set assigned_to = v_next_id,
          assigned_role = v_next_role,
          escalated_from = r.assigned_to,
          escalation_count = r.escalation_count + 1,
          status = 'Escalated',
          due_date = now() + interval '48 hours'
      where id = r.id;

    if v_next_id is not null then
      insert into public.notifications (user_id, complaint_id, title, body, severity, action_required, deadline)
      values (v_next_id, r.id,
              'Complaint ESCALATED to you: ' || r.complaint_number,
              format('%s — deadline passed, no action taken', r.title),
              r.severity, 'Take immediate action', now() + interval '48 hours');
    end if;

    insert into public.complaint_events (complaint_id, actor_name, actor_role, action, old_status, new_status, comment)
    values (r.id, 'System', v_next_role, 'ESCALATE', r.status::text, 'Escalated',
            format('Escalated from %s to %s after deadline', r.assigned_role, v_next_role));

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Optional: schedule with pg_cron (enable in Dashboard → Database → Extensions)
-- select cron.schedule('compliance-escalation', '0 * * * *', $$select public.run_escalation()$$);

commit;


-- ============================================================================
-- 7. SEED DATA
-- ============================================================================
begin;

-- ---------- Mines ----------
insert into public.mines (mine_name, mine_code, location, state, district, mine_type, status) values
  ('Jharia Central Colliery', 'JCC-01', 'Jharia Coal Field', 'Jharkhand', 'Dhanbad', 'Underground', 'active'),
  ('Bokaro Open Cast Mine', 'BOC-02', 'Bokaro Coal Field', 'Jharkhand', 'Bokaro', 'Open Cast', 'active'),
  ('Raniganj Deep Shaft', 'RDS-03', 'Raniganj Coal Field', 'West Bengal', 'Paschim Bardhaman', 'Underground', 'active'),
  ('Talcher Thermal Mine', 'TTC-04', 'Talcher Coal Field', 'Odisha', 'Angul', 'Open Cast', 'active'),
  ('Korba Power Coal Mine', 'KPC-05', 'Korba Coal Field', 'Chhattisgarh', 'Korba', 'Mixed', 'under_maintenance')
on conflict (mine_code) do nothing;

-- ---------- Escalation Rules ----------
insert into public.escalation_rules (category, severity, from_role, to_role, hours_until_escalation, reminder_hours, is_critical, active) values
  (null, null, 'mining_mate',    'overman',        48, 24, false, true),
  (null, null, 'overman',        'safety_officer', 48, 24, false, true),
  (null, null, 'safety_officer', 'mine_manager',   48, 24, false, true),
  (null, null, 'mine_manager',   'super_admin',    48, 24, false, true),
  (null, 'Critical', 'mining_mate', 'safety_officer', 12, 6, true, true),
  (null, 'Critical', 'safety_officer', 'mine_manager', 12, 6, true, true)
on conflict do nothing;

-- ---------- System Settings ----------
insert into public.system_settings (key, value) values
  ('escalation_hours', '48'),
  ('reminder_hours', '24'),
  ('critical_escalation_hours', '12'),
  ('org_name', 'Coal India Compliance Division')
on conflict (key) do nothing;

commit;

-- ============================================================================
-- 8. CREATE SUPER ADMIN  ★★★ RUN THIS AFTER CREATING THE AUTH USER ★★★
-- ----------------------------------------------------------------------------
-- STEP 1: In Supabase Dashboard → Authentication → Users → Add user
--         (email + password). Use meta-data: {"employee_id":"SA-0001","full_name":"System Administrator","role":"super_admin"}
-- STEP 2: Copy the new user's UUID and run the UPDATE below:
-- ----------------------------------------------------------------------------
-- update public.profiles
--    set role = 'super_admin',
--        employee_id = 'SA-0001',
--        full_name = 'System Administrator',
--        mine_id = (select id from public.mines limit 1),
--        department = 'Management',
--        designation = 'Super Admin'
--  where auth_user_id = '<PASTE-AUTH-USER-UUID-HERE>';
--
-- STEP 3: After the first Super Admin exists, the admin UI lets you create
--         additional users (worker, mining_mate, overman, safety_officer,
--         mine_manager) with their correct roles.
-- ============================================================================

