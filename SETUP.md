# Coal Mine Compliance & Safety Management — Setup Guide

This document walks you through configuring and running the **Coal Mine Compliance & Safety** module (the `src/security/` application) which is bundled alongside the existing MineGov dashboard.

> **Note:** The project also contains a pre-existing MineGov demo dashboard (`src/`, `src/components/`, `src/services/`). That legacy code base had several pre-existing TypeScript errors — they do **not** affect the Compliance & Safety module and are outside this setup.

---

## 1. Prerequisites

- **Node.js** ≥ 18 and **npm**
- A **Supabase** project (free tier is fine) — https://supabase.com
- (Optional) Python 3.10+ if you want to run the ML anomaly-detection server used by the MineGov demo

Install dependencies:

```bash
npm install
```

---

## 2. Configure Environment Variables

Copy the `.env` file and fill in your real Supabase project credentials:

```bash
# .env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
SUPABASE_SECRET_KEY=YOUR-SECRET-KEY
SUPABASE_JWKS_URL=YOUR-JWKS-URL
VITE_SUPABASE_REALTIME_ENABLED=true
VITE_DEFAULT_ESCALATION_HOURS=48
```

Where to find these values: **Supabase Dashboard → Project Settings → API**.
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / publishable** key → `VITE_SUPABASE_PUBLISHABLE_KEY`
- **service_role** key → `SUPABASE_SECRET_KEY` (server-side only, not used by client)
- **JWKS URL** → `SUPABASE_JWKS_URL` (server-side only, not used by client)

---

## 3. Set Up the Database Schema

The full schema is provided in `supabase/schema.sql`. It creates:

- **Tables:** `profiles`, `mines`, `complaints`, `complaint_events`, `complaint_comments`, `inspections`, `corrective_actions`, `notifications`, `audit_logs`, `escalation_rules`, `system_settings`
- **Stored functions:** `auto_assign_complaint`, `log_audit`, `handle_new_user` (auth trigger)
- **Row Level Security (RLS)** policies per role
- **Storage buckets:** `complaint-photos`, `complaint-videos`
- **Realtime** publication for `complaints`, `complaint_events`, `notifications`

### Apply the schema:

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Copy the entire contents of `supabase/schema.sql` and paste it into the editor.
4. Click **Run**.

---

## 4. Create a Seed Admin / Test Users

After applying the schema, insert at least one profile for the admin so you can log in.

1. In **Authentication → Users**, create a user (e.g. `admin@mine.gov`, password of your choice).
2. Open the **SQL Editor** and insert a matching `profiles` row (the trigger `handle_new_user` may auto-create one, but if it doesn't, run):

   ```sql
   insert into profiles (auth_user_id, employee_id, full_name, email, role, mine_id, is_active)
   values (
     (select id from auth.users where email = 'admin@mine.gov'),
     'ADM-0001',
     'Administrator',
     'admin@mine.gov',
     'super_admin',
     null,
     true
   );
   ```

3. Repeat for any workers / safety officers you want to test with (use roles like `worker`, `safety_officer`, `mine_manager`).

> 💡 **Tip:** The RLS policies read the role from the `profiles` table, so keeping `profiles` in sync with `auth.users` (via the trigger) is essential.


---

## 5. Run the App

```bash
npm run dev
```

Then open the **security app** (the Compliance & Safety module) in your browser:

```
http://localhost:3000/security.html
```

- Log in with the credentials you created above.
- You should land on the **Dashboard** with KPI cards, charts, and a complaint feed.

### Alternative entry (legacy MineGov demo)

The legacy dashboard is at `http://localhost:3000/` (from `index.html`). It has pre-existing TypeScript errors in `src/App.tsx` and may not build — it is independent of the Compliance & Safety module.

---

## 6. Module Feature Map

| Page | Purpose | Roles |
|---|---|---|
| Dashboard | KPIs, charts, recent complaints | All |
| Report Issue | Submit a complaint/incident with photos, videos, location | Worker, all |
| My Complaints | Complaint list (mine/user scoped) | All |
| Assigned Complaints | Only complaints assigned to you | Officer/Manager |
| Safety Complaints | Mine-wide safety complaints | Safety Officer, Manager |
| Compliance Analytics | Charts of resolution, categories, severities | Manager, Super Admin |
| Reports & Export | Complaints grouped by category + PDF export (full lifecycle timestamps) | All |
| User Management | Manage profiles & roles | Super Admin |
| Audit Logs | Immutable action trail | Super Admin, Manager |
| Escalation Rules | Configure SLA/escalation rules | Super Admin |
| Mines | Registered mines | Super Admin |
| System Settings | Global parameters | Super Admin |

> **Permanent complaint records:** Complaint records are preserved with a full timestamp trail
> (`reported_at`, `created_at`, `updated_at`, `assigned_at`, `verified_at`, `resolved_at`, `archived_at`) and every
> state transition is appended to `complaint_events` so the chain of custody is fully auditable.
> **Only the Super Admin role may permanently delete complaint records** — enforced in the Data Hub UI and by the
> `complaints_delete_super_admin` policy at the database level; all other roles are blocked. A `DELETED` audit event
> is written before a complaint is removed, so the deletion itself stays on the audit trail.

---

## 7. Real-Time Notifications

The app uses Supabase Realtime for **live** updates:

- **Notifications** — the Topbar bell subscribes to the `notifications` table inserts for the signed-in user and updates the badge live.
- **Complaint Detail** — subscribes to changes on the specific `complaints` row and new `complaint_events`, so the timeline refreshes automatically.

If you see no live updates, verify:
- The `VITE_SUPABASE_REALTIME_ENABLED` env is set and your project's **Realtime** is enabled for the tables (enabled in the schema via `alter publication supabase_realtime`).
- Your RLS policies allow the row(s) to be selected by the subscribed user.

---

## 8. Troubleshooting

| Symptom | Likely Cause / Fix |
|---|---|
| "Invalid API key" / blank login | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` not set or project paused |
| Login succeeds but no data | `profiles` row missing — see step 4 |
| Actions error in console | RLS policy denying the role; review `supabase/schema.sql` policies and the user's role |
| TypeScript errors | Only the legacy MineGov dashboard has pre-existing errors; `src/security/` compiles clean (`npx tsc --noEmit` → 0 security errors) |
| Tailwind classes like `bg-copper` absent | Ensure `security.html` is included in `tailwind.config.js` `content` (already done) |

---

## 9. Project Structure (Compliance & Safety module)

```
src/security/
├── securityMain.tsx            # Entry (rooted at /security.html)
├── lib/
│   ├── supabaseClient.ts       # Supabase client
│   ├── authContext.tsx         # Auth + server-side role detection
│   ├── complaints.ts           # Complaint workflow service
│   ├── notifications.ts        # Notifications service
│   ├── audit.ts, analytics.ts, permissions.ts
│   └── types.ts                # Shared types
└── components/
    ├── AppShell.tsx, LoginPage.tsx
    ├── layout/  (Topbar, Sidebar)
    ├── ui/      (primitives, inputs)
    ├── DashboardView.tsx, ReportIssueForm.tsx, ComplaintList.tsx,
    │   ComplaintDetail.tsx, UserManagement.tsx, MinesView.tsx,
    │   ComplianceAnalyticsView.tsx, EscalationRulesView.tsx,
    │   AuditLogsView.tsx, SystemSettingsView.tsx, PlaceholderViews.tsx
    └── ...
```
