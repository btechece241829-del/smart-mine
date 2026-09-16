// ────────────────────────────────────────────────────────────────
// Worker Attendance service — permanent register + full workflow.
//
// Backing store: Firestore collection `attendance` (offline-first via
// local storage fallback in firebaseDb.ts). The register is the primary
// source of truth for attendance. Records are identified deterministically
// by (mine, worker, date, shift) so re-marking upserts instead of
// duplicating — this enforces the "no duplicate record per employee,
// date and shift" rule.
//
// Workflow: Overman marks (Draft) → Submits for verification →
// Manager/Admin verifies (Verified), requests rework (Rework) or
// rejects (Rejected) with reason. Approved records cannot be edited by
// an Overman; only Manager/Admin can correct after approval (each change
// is written to the audit log).
// ────────────────────────────────────────────────────────────────
import { fb, fbUpsertInto, fbUpdateOf, fbDeleteFrom, fbSubscribe } from './firebaseDb';
import { ensureMinesSeeded } from './mines';
import { logAudit } from './audit';
import {
  AttendanceRecord, AttendanceShift, AttendanceStatus, UserRole,
  AttendanceSource, AttendanceVerificationStatus,
} from './types';

export const ATTENDANCE_SHIFTS: AttendanceShift[] = ['Day', 'Night', 'General'];

/** Every status the module supports (superset of the legacy three). */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'Present', 'Absent', 'On Leave', 'Half Day', 'Off Day', 'Holiday', 'Other Duty',
];

/** Statuses an Overman may assign while marking the roll. */
export const MARKABLE_STATUSES: AttendanceStatus[] = ATTENDANCE_STATUSES;

export const ATTENDANCE_VERIFICATION_STATUSES: AttendanceVerificationStatus[] = [
  'Draft', 'Submitted', 'Verified', 'Rejected', 'Rework',
];

export interface RosterWorker {
  worker_id: string;    // profile id or CSV worker_id (employee_id)
  worker_name: string;
  worker_role: string | null;
  work_area?: string | null;
  shift?: AttendanceShift | null;
  department?: string | null;
}

export interface AttendanceActor {
  id: string;
  name: string;
  role: UserRole;
}

/** Deterministic id so re-marking the same slot upserts instead of duplicating. */
export function attendanceRecordId(mineId: string, workerId: string, date: string, shift: string): string {
  return `att_${mineId}_${workerId}_${date}_${shift}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export interface AttendanceQuery {
  mineId?: string;
  date?: string;
  shift?: AttendanceShift;
  status?: AttendanceStatus;
  workerId?: string;
  department?: string;
  workArea?: string;
}

/** Load active mines for the mine picker. */
export async function fetchMines(): Promise<any[]> {
  await ensureMinesSeeded().catch(() => {});
  const { data } = await fb('mines').select().run<any[]>();
  return (data ?? []).slice().sort((a: any, b: any) =>
    String(a.mine_name ?? a.id).localeCompare(String(b.mine_name ?? b.id))
  );
}

/**
 * Worker roster for a mine = active profiles assigned to that mine.
 * Enriched with work area / shift / department when present.
 * When `overmanId` is provided, only workers assigned to that Overman
 * are returned (Overman scope rule).
 */
export async function fetchRoster(mineId: string | null, overmanId?: string | null): Promise<RosterWorker[]> {
  if (!mineId) return [];
  const { data } = await fb('profiles').select().eq('mine_id', mineId).run<any[]>();
  const rows: any[] = data ?? [];
  return rows
    .filter((p) => p && p.is_active !== false && (p.full_name || p.employee_id))
    .filter((p) => !overmanId || !p.assigned_overman_id || p.assigned_overman_id === overmanId)
    .map((p) => ({
      worker_id: p.employee_id || p.id,
      worker_name: p.full_name || p.employee_id || p.id,
      worker_role: p.designation || p.role || null,
      work_area: p.work_area ?? null,
      shift: p.shift ?? null,
      department: p.department ?? null,
    }))
    .sort((a, b) => a.worker_name.localeCompare(b.worker_name));
}
/**
 * Load the attendance register. Firestore side only filters on a single
 * equality so no composite index is required; the rest is filtered & sorted
 * in-memory so it behaves identically online and offline.
 */
export async function fetchAttendance(q: AttendanceQuery = {}): Promise<AttendanceRecord[]> {
  const builder = fb('attendance').select();
  if (q.mineId) builder.eq('mine_id', q.mineId);
  const { data } = await builder.run<AttendanceRecord>();
  let rows: AttendanceRecord[] = (data ?? []) as AttendanceRecord[];
  if (q.date) rows = rows.filter((r) => r.attendance_date === q.date);
  if (q.shift) rows = rows.filter((r) => r.shift === q.shift);
  if (q.status) rows = rows.filter((r) => r.status === q.status);
  if (q.workerId) rows = rows.filter((r) => r.worker_id === q.workerId);
  if (q.department) rows = rows.filter((r) => r.department === q.department);
  if (q.workArea) rows = rows.filter((r) => r.work_area === q.workArea);
  rows.sort((a, b) => {
    const d = String(b.attendance_date).localeCompare(String(a.attendance_date));
    return d !== 0 ? d : String(a.worker_name).localeCompare(String(b.worker_name));
  });
  return rows;
}

/** Real-time subscription over the attendance register (fire-and-forget refresh). */
export function subscribeAttendance(
  mineId: string | null,
  onChange: (rows: AttendanceRecord[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const constraints: any[] = [];
  if (mineId) constraints.push(['mine_id', mineId]);
  return fbSubscribe(
    'attendance',
    (docs) => onChange((docs ?? []) as AttendanceRecord[]),
    onError,
    ...constraints,
  );
}

/** Read a single attendance record by id (read-before-write guard). */
async function readAttendance(id: string): Promise<AttendanceRecord | null> {
  const { data } = await fb('attendance').select().eq('id', id).run();
  const rows = (data ?? []) as AttendanceRecord[];
  return rows[0] ?? null;
}

export interface MarkRow {
  mine_id: string;
  mine_name: string;
  worker_id: string;
  worker_name: string;
  worker_role: string | null;
  work_area?: string | null;
  department?: string | null;
  shift: AttendanceShift;
  status: AttendanceStatus;
  attendance_date: string;
  check_in?: string | null;
  check_out?: string | null;
  remarks?: string | null;
}

/**
 * Persist a batch of attendance marks. Idempotent per
 * (mine, worker, date, shift) — an existing mark is never overwritten
 * here (only management can change one via correctAttendance).
 * Each created record starts as a Draft with the given source.
 */
export async function markAttendance(rows: MarkRow[], actor: AttendanceActor, source: AttendanceSource = 'Manual'): Promise<{ saved: number; skipped: number }> {
  const now = new Date().toISOString();
  let saved = 0;
  let skipped = 0;
  for (const r of rows) {
    const id = attendanceRecordId(r.mine_id, r.worker_id, r.attendance_date, r.shift);
    // Read-before-write duplicate guard: skip existing marks instead of clobbering.
    const existing = await readAttendance(id);
    if (existing) { skipped++; continue; }
    const record: AttendanceRecord = {
      id,
      mine_id: r.mine_id,
      mine_name: r.mine_name,
      worker_id: r.worker_id,
      worker_name: r.worker_name,
      worker_role: r.worker_role ?? null,
      work_area: r.work_area ?? null,
      department: r.department ?? null,
      shift: r.shift,
      status: r.status,
      attendance_date: r.attendance_date,
      check_in: r.check_in ?? null,
      check_out: r.check_out ?? null,
      marked_by_id: actor.id,
      marked_by_name: actor.name,
      marked_by_role: actor.role,
      verification_status: 'Draft',
      submitted_at: null,
      verified_by_id: null,
      verified_by_name: null,
      verified_by_role: null,
      verified_at: null,
      rejection_reason: null,
      source,
      remarks: r.remarks ?? null,
      created_at: now,
      updated_at: now,
      corrected_by_id: null,
      corrected_by_name: null,
      corrected_by_role: null,
      correction_note: null,
    };
    await fbUpsertInto('attendance', record).run();
    saved++;
  }
  return { saved, skipped };
}

/** Mark every roster worker present in one shot (quick action). */
export async function markAllPresent(rows: MarkRow[], actor: AttendanceActor): Promise<{ saved: number; skipped: number }> {
  const presentRows = rows.map((r) => ({ ...r, status: 'Present' as AttendanceStatus }));
  return markAttendance(presentRows, actor, 'Manual');
}

/** Mark every roster worker absent in one shot (quick action). */
export async function markAllAbsent(rows: MarkRow[], actor: AttendanceActor): Promise<{ saved: number; skipped: number }> {
  const presentRows = rows.map((r) => ({ ...r, status: 'Absent' as AttendanceStatus }));
  return markAttendance(presentRows, actor, 'Manual');
}

/**
 * Overman submits draft records for verification. Only records still in
 * Draft (or Rework requested by management) can be submitted.
 */
export async function submitForVerification(ids: string[], actor: AttendanceActor): Promise<{ submitted: number }> {
  const now = new Date().toISOString();
  let submitted = 0;
  for (const id of ids) {
    const existing = await readAttendance(id);
    if (!existing) continue;
    if (existing.verification_status !== 'Draft' && existing.verification_status !== 'Rework') continue;
    await fbUpdateOf('attendance', {
      verification_status: 'Submitted',
      submitted_at: now,
      updated_at: now,
      // Clear any previous rejection / rework flags once re-submitted
      rejection_reason: null,
    }).eq('id', id).run();
    submitted++;
  }
  if (submitted > 0) {
    await logAudit({
      user_id: actor.id, user_name: actor.name, role: actor.role,
      action: 'ATTENDANCE_SUBMIT', entity_type: 'attendance',
      description: `Submitted ${submitted} attendance record(s) for verification`,
    });
  }
  return { submitted };
}

/** Manager/Admin approves a submitted (or draft) attendance record. */
export async function approveAttendance(id: string, actor: AttendanceActor): Promise<void> {
  const now = new Date().toISOString();
  const existing = await readAttendance(id);
  if (!existing) return;
  await fbUpdateOf('attendance', {
    verification_status: 'Verified',
    verified_by_id: actor.id,
    verified_by_name: actor.name,
    verified_by_role: actor.role,
    verified_at: now,
    rejection_reason: null,
    updated_at: now,
  }).eq('id', id).run();
  await logAudit({
    user_id: actor.id, user_name: actor.name, role: actor.role,
    action: 'ATTENDANCE_APPROVE', entity_type: 'attendance', entity_id: id,
    old_status: existing.verification_status, new_status: 'Verified',
    description: `Approved attendance for ${existing.worker_name} (${existing.attendance_date})`,
  });
}

/** Manager/Admin rejects an attendance record with a reason. */
export async function rejectAttendance(id: string, reason: string, actor: AttendanceActor): Promise<void> {
  const now = new Date().toISOString();
  const existing = await readAttendance(id);
  if (!existing) return;
  await fbUpdateOf('attendance', {
    verification_status: 'Rejected',
    verified_by_id: actor.id,
    verified_by_name: actor.name,
    verified_by_role: actor.role,
    verified_at: now,
    rejection_reason: reason || 'No reason provided',
    updated_at: now,
  }).eq('id', id).run();
  await logAudit({
    user_id: actor.id, user_name: actor.name, role: actor.role,
    action: 'ATTENDANCE_REJECT', entity_type: 'attendance', entity_id: id,
    old_status: existing.verification_status, new_status: 'Rejected',
    description: `Rejected attendance for ${existing.worker_name}: ${reason}`,
  });
}

/** Manager/Admin requests a correction (re-opens the record for the Overman). */
export async function requestCorrection(id: string, note: string, actor: AttendanceActor): Promise<void> {
  const now = new Date().toISOString();
  const existing = await readAttendance(id);
  if (!existing) return;
  await fbUpdateOf('attendance', {
    verification_status: 'Rework',
    verified_by_id: actor.id,
    verified_by_name: actor.name,
    verified_by_role: actor.role,
    verified_at: now,
    rejection_reason: note || 'Correction requested',
    updated_at: now,
  }).eq('id', id).run();
  await logAudit({
    user_id: actor.id, user_name: actor.name, role: actor.role,
    action: 'ATTENDANCE_REWORK', entity_type: 'attendance', entity_id: id,
    old_status: existing.verification_status, new_status: 'Rework',
    description: `Correction requested for ${existing.worker_name}: ${note}`,
  });
}

/** Management (Manager/Admin) corrects an existing mark, preserving a trail. */
export async function correctAttendance(
  id: string,
  patch: { status?: AttendanceStatus; shift?: AttendanceShift; check_in?: string | null; check_out?: string | null; remarks?: string | null },
  actor: AttendanceActor,
  note: string,
): Promise<{ error: { message: string } | null }> {
  const existing = await readAttendance(id);
  const now = new Date().toISOString();
  const res = await fbUpdateOf('attendance', {
    status: patch.status,
    shift: patch.shift,
    check_in: patch.check_in !== undefined ? patch.check_in : existing?.check_in ?? null,
    check_out: patch.check_out !== undefined ? patch.check_out : existing?.check_out ?? null,
    remarks: patch.remarks !== undefined ? patch.remarks : existing?.remarks,
    verified_by_id: null,
    verified_by_name: null,
    verified_by_role: null,
    verified_at: null,
    rejection_reason: null,
    corrected_by_id: actor.id,
    corrected_by_name: actor.name,
    corrected_by_role: actor.role,
    correction_note: note || 'Record corrected by management',
    updated_at: now,
  }).eq('id', id).run();
  if (existing) {
    await logAudit({
      user_id: actor.id, user_name: actor.name, role: actor.role,
      action: 'ATTENDANCE_CORRECT', entity_type: 'attendance', entity_id: id,
      old_status: existing.status, new_status: patch.status ?? existing.status,
      description: `Corrected attendance for ${existing.worker_name}: ${note}`,
    });
  }
  return res;
}

/** Add a single manual attendance record that did not exist yet. */
export async function addManualAttendance(
  row: MarkRow,
  actor: AttendanceActor,
): Promise<{ error: { message: string } | null; id?: string }> {
  const id = attendanceRecordId(row.mine_id, row.worker_id, row.attendance_date, row.shift);
  const existing = await readAttendance(id);
  if (existing) return { error: { message: 'Duplicate attendance — this employee already has a record for that date/shift.' } };
  const now = new Date().toISOString();
  const record: AttendanceRecord = {
    id,
    mine_id: row.mine_id,
    mine_name: row.mine_name,
    worker_id: row.worker_id,
    worker_name: row.worker_name,
    worker_role: row.worker_role ?? null,
    work_area: row.work_area ?? null,
    department: row.department ?? null,
    shift: row.shift,
    status: row.status,
    attendance_date: row.attendance_date,
    check_in: row.check_in ?? null,
    check_out: row.check_out ?? null,
    marked_by_id: actor.id,
    marked_by_name: actor.name,
    marked_by_role: actor.role,
    verification_status: 'Verified',
    submitted_at: now,
    verified_by_id: actor.id,
    verified_by_name: actor.name,
    verified_by_role: actor.role,
    verified_at: now,
    rejection_reason: null,
    source: 'Manual',
    remarks: row.remarks ?? 'Added manually by admin',
    created_at: now,
    updated_at: now,
    corrected_by_id: null,
    corrected_by_name: null,
    corrected_by_role: null,
    correction_note: null,
  };
  const res = await fbUpsertInto('attendance', record).run();
  if (!res.error) {
    await logAudit({
      user_id: actor.id, user_name: actor.name, role: actor.role,
      action: 'ATTENDANCE_CREATE', entity_type: 'attendance', entity_id: id,
      new_status: row.status,
      description: `Added manual attendance for ${row.worker_name} (${row.attendance_date}, ${row.shift})`,
    });
  }
  return res.error ? { error: res.error } : { error: null, id };
}

/**
 * Delete a record from the permanent register. Restricted to Super Admin
 * (enforced both here and in firestore.rules).
 */
export async function deleteAttendance(id: string, actor: AttendanceActor): Promise<{ error: { message: string } | null }> {
  const existing = await readAttendance(id);
  const res = await fbDeleteFrom('attendance').eq('id', id).run();
  if (existing) {
    await logAudit({
      user_id: actor.id, user_name: actor.name, role: actor.role,
      action: 'ATTENDANCE_DELETE', entity_type: 'attendance', entity_id: id,
      old_status: existing.status,
      description: `Deleted attendance for ${existing.worker_name} (${existing.attendance_date})`,
    });
  }
  return res;
}

export function attendanceSummary(rows: AttendanceRecord[]): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, 'Off Day': 0, Holiday: 0, 'Other Duty': 0,
  };
  rows.forEach((r) => {
    if (r.status in counts) counts[r.status] += 1;
  });
  return counts;
}

/** Attendance percentage for a set of records (Present + Half Day count toward attendance). */
export function attendancePercentage(rows: AttendanceRecord[]): number {
  if (!rows.length) return 0;
  const counted = rows.filter((r) => r.status === 'Present' || r.status === 'Half Day').length;
  return Math.round((counted / rows.length) * 1000) / 10;
}
