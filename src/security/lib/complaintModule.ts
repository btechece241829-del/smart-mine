// ──────────────────────────────────────────────────────────────────────
// Complaint & Safety Issue Management module — service layer.
// Registry / draft / workflow / investigation / corrective action /
// verification / evidence / categories on the Firebase Firestore backend.
// Uses the offline-first fb() wrapper so behaviour is identical online
// and offline (records are mirrored to localStorage & synced).
// ──────────────────────────────────────────────────────────────────────
import {
  fb,
  fbInsertInto,
  fbUpdateOf,
  fbDeleteFrom,
  fbUpsertInto,
  fbUploadFile,
  fbGetDownloadURL,
} from './firebaseDb';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import {
  Complaint,
  ComplaintCategory,
  ComplaintAttachment,
  ComplaintInvestigation,
  ComplaintVerification,
  ComplaintStatusHistory,
  ComplaintStatus,
  Severity,
  Priority,
  UserRole,
} from './types';
import { complaintsService } from './complaints';
import { notify } from './notifications';
import { logAudit } from './audit';

export interface ComplaintActor {
  id?: string | null;
  name: string;
  role?: UserRole | null;
  designation?: string | null;
}

/** Roles allowed to delete complaints (Mine Manager = archive, Super Admin = permanent delete). */
export function canAdminDeleteComplaints(role?: UserRole | null | undefined): boolean {
  return role === 'mine_manager' || role === 'super_admin';
}

// ══════════════════════════════════════════════════════════════════════
// Complaint categories (collection `complaint_categories`)
// ══════════════════════════════════════════════════════════════════════

export interface ComplaintCategorySeed {
  name: string;
  subcategories: string[];
  sort_order: number;
}

export const DEFAULT_COMPLAINT_CATEGORIES: ComplaintCategorySeed[] = [
  { name: 'Safety', sort_order: 1, subcategories: ['Head Injury Risk', 'Slip / Trip / Fall', 'Manual Handling', 'PPE Non-Compliance', 'Housekeeping', 'Unsafe Condition', 'Unsafe Act', 'Barricading'] },
  { name: 'Mining Operation', sort_order: 2, subcategories: ['Underground', 'Opencast', 'Blasting', 'Overburden', 'Coal Face', 'Support Work', 'Roadway'] },
  { name: 'Machinery', sort_order: 3, subcategories: ['Shearer', 'Continuous Miner', 'Shovel', 'Dumper', 'Dragline', 'Crusher', 'Conveyor', 'Feeder Breaker'] },
  { name: 'Electrical', sort_order: 4, subcategories: ['Cable Fault', 'Transformer', 'Switchgear', 'Lighting', 'Earth Leakage', 'Shock Hazard', 'FLP Equipment'] },
  { name: 'Mechanical', sort_order: 5, subcategories: ['Hydraulics', 'Pump', 'Compressor', 'Gearbox', 'Belt / Joint', 'Lubrication', 'Brake System'] },
  { name: 'Ventilation', sort_order: 6, subcategories: ['Air Flow', 'Methane (CH4)', 'CO / CO2', 'Emission / Bleeder', 'Controlled Recirculation', 'Vent Deficiency'] },
  { name: 'Environment', sort_order: 7, subcategories: ['Dust', 'Noise', 'Water Pollution', 'Air Pollution', 'Deforestation', 'Waste Management'] },
  { name: 'Fire', sort_order: 8, subcategories: ['Fire Hazard', 'Fire Extinguisher', 'Water Mist System', 'Spontaneous Heating', 'Electrical Fire', 'Fire Drill'] },
  { name: 'Ground Control', sort_order: 9, subcategories: ['Roof Fall', 'Side Fall', 'Caving', 'Subsidence', 'Rock Burst', 'Support Failure'] },
  { name: 'Worker Welfare', sort_order: 10, subcategories: ['First Aid', 'Medical Facilities', 'Drinking Water', 'Sanitation', 'Overtime', 'Shelter', 'Canteen'] },
  { name: 'Explosives & Blasting', sort_order: 11, subcategories: ['Magazine', 'Misfire', 'Overcharge', 'Flame Safety', 'Detonator', 'Property Damage'] },
  { name: 'Transport & Haulage', sort_order: 12, subcategories: ['Over-speeding', 'Haul Road', 'Collision', 'Brake Failure', 'Signage', 'Parking'] },
  { name: 'Communication', sort_order: 13, subcategories: ['Emergency Communication', 'Signals', 'Breathing Apparatus', 'Siren', 'Emergency Call Points'] },
  { name: 'Compliance / Statutory', sort_order: 14, subcategories: ['Statutory Books', 'Permission', 'Licence', 'Inspection Book', 'Rules Violation', 'Notice'] },
  { name: 'Other', sort_order: 99, subcategories: ['Other'] },
];

export function categorySlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const complaintCategoriesService = {
  async list(includeInactive = false): Promise<ComplaintCategory[]> {
    const { data } = await fb('complaint_categories').select('*').run<ComplaintCategory[]>();
    let list = ((data ?? []) as ComplaintCategory[]) ?? [];
    if (!includeInactive) list = list.filter((c) => c.active !== false);
    list.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name));
    return list;
  },

  /** Idempotently seed the standard category catalogue (used on demand). */
  async ensureSeeded(): Promise<ComplaintCategory[]> {
    const existing = await this.list(true);
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    for (const c of DEFAULT_COMPLAINT_CATEGORIES) {
      await fbUpsertInto('complaint_categories', {
        id: categorySlug(c.name),
        name: c.name,
        subcategories: c.subcategories,
        active: true,
        sort_order: c.sort_order,
        created_at: now,
        updated_at: now,
      }).run();
    }
    return this.list(true);
  },

  async save(patch: Partial<ComplaintCategory> & { name: string }): Promise<void> {
    const now = new Date().toISOString();
    const id = patch.id || categorySlug(patch.name);
    await fbUpsertInto('complaint_categories', {
      id,
      name: patch.name,
      subcategories: patch.subcategories ?? [],
      active: patch.active ?? true,
      sort_order: patch.sort_order ?? 99,
      updated_at: now,
    }).run();
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await fbUpdateOf('complaint_categories', { active, updated_at: new Date().toISOString() }).eq('id', id).run();
  },

  async remove(id: string): Promise<void> {
    await fbDeleteFrom('complaint_categories').eq('id', id).run();
  },
};

// ══════════════════════════════════════════════════════════════════════
// Workflow model — explicit state machine
// ══════════════════════════════════════════════════════════════════════

export const WORKFLOW_LIFECYCLE: ComplaintStatus[] = [
  'Draft',
  'Submitted',
  'Acknowledged',
  'Under Investigation',
  'Action Assigned',
  'Action In Progress',
  'Verification',
  'Resolved',
  'Closed',
];

/** Allowed single-step transitions any complaint may take. */
export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Acknowledged', 'Rejected', 'Escalated'],
  Acknowledged: ['Under Investigation', 'Escalated'],
  'Under Investigation': ['Action Assigned', 'Action In Progress'],
  'Action Assigned': ['Action In Progress'],
  'Action In Progress': ['Verification', 'Escalated'],
  Verification: ['Resolved', 'Action In Progress'], // verified → Resolved, or rework
  Resolved: ['Closed', 'Action In Progress'],       // re-open if regression
  Closed: [],
  // legacy statuses — kept compatible
  'Under Review': ['Assigned', 'Escalated'],
  Assigned: ['Action In Progress', 'Inspection Required'],
  'Inspection Required': ['Action In Progress'],
  Verified: ['Closed'],
  Rejected: ['Submitted'],
  Escalated: ['Acknowledged', 'Under Investigation', 'Action In Progress'],
};

export function nextStatusOptions(current: ComplaintStatus | null | undefined): ComplaintStatus[] {
  if (!current) return ['Submitted'];
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  complaint?: Complaint;
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  Submitted: 'SUBMITTED',
  Acknowledged: 'ACKNOWLEDGED',
  'Under Investigation': 'INVESTIGATION_STARTED',
  'Action Assigned': 'ACTION_ASSIGNED',
  'Action In Progress': 'ACTION_IN_PROGRESS',
  Verification: 'VERIFICATION_REQUESTED',
  Resolved: 'RESOLVED',
  Closed: 'CLOSED',
  Rejected: 'REJECTED',
  Escalated: 'ESCALATED',
  'Under Review': 'UPDATED',
  Assigned: 'ASSIGNED',
  'Inspection Required': 'INSPECTION_REQUIRED',
  Verified: 'VERIFIED',
};

// severity → SLA (hours until due) for automatically computed due dates
export const SLA_BY_PRIORITY: Record<Priority, number> = {
  Critical: 48,
  High: 72,
  Medium: 120,
  Low: 168,
};

function generateComplaintNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CM-${ymd}-${rand}`;
}

// ══════════════════════════════════════════════════════════════════════
// Profile lookup helpers (used for notifications & assignment)
// ══════════════════════════════════════════════════════════════════════

type ProfileRow = { id: string; full_name?: string; role?: string; mine_id?: string | null; is_active?: boolean };

let profilesCache: ProfileRow[] | null = null;
async function loadProfiles(force = false): Promise<ProfileRow[]> {
  if (profilesCache && !force) return profilesCache;
  const { data } = await fb('profiles').select('*').run<ProfileRow[]>();
  profilesCache = ((data ?? []) as ProfileRow[]) ?? [];
  return profilesCache;
}

async function findRoles(roles: UserRole[], mineId?: string | null): Promise<ProfileRow[]> {
  const all = await loadProfiles();
  return all.filter(
    (p) => roles.includes((p.role ?? '') as UserRole) && p.is_active !== false && (!mineId || !p.mine_id || p.mine_id === mineId)
  );
}

async function notifyUsers(users: ProfileRow[], payload: {
  complaint_id?: string | null;
  title: string;
  body?: string | null;
  severity?: Severity | null;
  action_required?: string | null;
  deadline?: string | null;
}): Promise<void> {
  if (!users.length) return;
  await notify(users.map((u) => ({ id: u.id })), payload);
}

async function logAuditRow(
  actor: ComplaintActor,
  action: string,
  complaintId: string,
  oldStatus: string | null,
  newStatus: string | null,
  description?: string | null,
): Promise<void> {
  try {
    await logAudit({
      user_id: actor.id ?? null,
      user_name: actor.name,
      role: actor.role ?? null,
      action,
      entity_type: 'complaint',
      entity_id: complaintId,
      old_status: oldStatus,
      new_status: newStatus,
      description: description ?? null,
    });
  } catch {
    // audit failures must never break the workflow
  }
}

async function addStatusRow(
  complaintId: string,
  complaintNumber: string | null,
  from: string | null,
  to: ComplaintStatus,
  actor: ComplaintActor,
  note?: string | null,
): Promise<string> {
  const row: ComplaintStatusHistory = {
    id: '',
    complaint_id: complaintId,
    complaint_number: complaintNumber,
    from_status: from,
    to_status: to,
    actor_id: actor.id ?? null,
    actor_name: actor.name,
    actor_role: actor.role ?? null,
    note: note ?? null,
    created_at: new Date().toISOString(),
  };
  const { data } = await fbInsertInto('complaint_status_history', row).select();
  return (data as ComplaintStatusHistory)?.id ?? '';
}

async function addEvent(complaintId: string, ev: Parameters<typeof complaintsService.addEvent>[1]): Promise<void> {
  await complaintsService.addEvent(complaintId, ev);
}

// ══════════════════════════════════════════════════════════════════════
// Registration
// ══════════════════════════════════════════════════════════════════════

export interface RegisterComplaintInput {
  title: string;
  description: string;
  category_id: string;
  category: string;
  subcategory: string | null;
  severity: Severity;
  priority: Priority;
  immediate_danger: boolean;
  mine_id: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_accuracy: number | null;
  location_name: string;
  location_address: string;
  department: string;
  work_area: string;
  shift: string;
  expected_date: string;         // yyyy-mm-dd
  witnesses: string;
  immediate_action_taken: string;
}

export interface ModuleComplaintData {
  complaint: Complaint | null;
  id?: string;
  error?: string;
}

/**
 * Register a new complaint. If `opts.asDraftId` is given, the Firestore draft
 * is upgraded to a live complaint (same document, no duplicate).
 * Returns the complaint with a stable id so the UI can attach evidence.
 */
export async function registerComplaint(
  input: RegisterComplaintInput,
  actor: ComplaintActor,
  opts?: { asDraftId?: string | null },
): Promise<ModuleComplaintData> {
  try {
    const now = new Date().toISOString();
    const number = generateComplaintNumber();
    const expected = input.expected_date ? new Date(`${input.expected_date}T23:59:59`).toISOString() : null;
    const slaHours = SLA_BY_PRIORITY[input.priority] ?? SLA_BY_PRIORITY.Medium;
    const due = expected ?? new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const data = {
      complaint_number: number,
      title: input.title,
      description: input.description,
      category: input.category,
      category_id: input.category_id || null,
      subcategory: input.subcategory ?? null,
      severity: input.severity,
      priority: input.severity,
      priority_label: input.priority,
      immediate_danger: !!input.immediate_danger,
      mine_id: input.mine_id,
      location: input.location || null,
      location_name: input.location_name || null,
      location_address: input.location_address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      gps_latitude: input.gps_latitude ?? null,
      gps_longitude: input.gps_longitude ?? null,
      gps_accuracy: input.gps_accuracy ?? null,
      department: input.department || null,
      work_area: input.work_area || null,
      shift: input.shift || null,
      expected_date: due,
      witnesses: input.witnesses || null,
      immediate_action_taken: input.immediate_action_taken || null,
      reported_by: actor.id ?? null,
      reported_by_name: actor.name,
      reported_employee_id: null,
      reported_at: now,
      status: 'Submitted' as ComplaintStatus,
      is_critical: input.severity === 'Critical',
      is_archived: false,
      archived_at: null,
      archived_by: null,
      escalation_count: input.severity === 'Critical' ? 1 : 0,
      due_date: due,
      created_at: now,
      updated_at: now,
    };

    let complaint: Complaint | null = null;
    if (opts?.asDraftId) {
      await fbUpdateOf('complaints', { ...data, is_draft: false, draft_updated_at: null, updated_at: now }).eq('id', opts.asDraftId).run();
      complaint = (await complaintsService.getById(opts.asDraftId)) ?? null;
    } else {
      const { data: inserted, error } = await fbInsertInto('complaints', data).select();
      if (error) return { complaint: null, error: error.message };
      complaint = (inserted as Complaint) ?? null;
    }
    if (!complaint) return { complaint: null, error: 'Failed to create complaint record' };

    await addStatusRow(complaint.id, complaint.complaint_number, opts?.asDraftId ? 'Draft' : null, 'Submitted', actor, input.description || null);
    await addEvent(complaint.id, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: input.severity === 'Critical' ? 'CRITICAL_REPORT' : 'SUBMITTED',
      old_status: opts?.asDraftId ? 'Draft' : null,
      new_status: 'Submitted',
      comment: input.description,
    });

    // Notify safety officers / managers / admins
    try {
      const recipients = await findRoles(['safety_officer', 'mine_manager', 'super_admin'], input.mine_id);
      await notifyUsers(recipients, {
        complaint_id: complaint.id,
        title: `${input.severity === 'Critical' ? '🚨 Critical complaint: ' : 'New complaint: '}${input.title}`,
        body: `${input.category}${input.subcategory ? ' / ' + input.subcategory : ''} • ${input.severity} • ${input.location_name || input.location || 'Location not set'}`,
        severity: input.severity,
        action_required: input.severity === 'Critical' ? 'Acknowledge immediately' : 'Review & acknowledge',
        deadline: due,
      });
    } catch (e) {
      console.warn('[complaintModule] notify recipients failed:', e);
    }

    await logAuditRow(actor, input.severity === 'Critical' ? 'COMPLAINT_CRITICAL' : 'COMPLAINT_SUBMITTED', complaint.id, null, 'Submitted', input.title);

    return { complaint, id: complaint.id };
  } catch (e: any) {
    return { complaint: null, error: e.message };
  }
}

// ── Drafts (device-local offline drafts + cross-device Firestore drafts) ──

const DRAFTS_LS = 'smartmine_complaint_drafts_v2';

export function getLocalDrafts<T = Record<string, unknown>>(): T[] {
  try {
    const raw = localStorage.getItem(DRAFTS_LS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDraft(draft: Record<string, unknown> & { id?: string }): void {
  const list = getLocalDrafts<any>();
  const id = draft.id ?? `draft_${Date.now()}`;
  const idx = list.findIndex((d) => d.id === id);
  const row = { ...draft, id, saved_at: new Date().toISOString() };
  if (idx >= 0) list[idx] = row; else list.unshift(row);
  localStorage.setItem(DRAFTS_LS, JSON.stringify(list));
}

export function deleteLocalDraft(id: string): void {
  localStorage.setItem(DRAFTS_LS, JSON.stringify(getLocalDrafts<any>().filter((d) => d.id !== id)));
}

/** Persist an in-progress complaint to Firestore (is_draft) for cross-device resume. */
export async function saveFirestoreDraft(
  input: Omit<RegisterComplaintInput, 'immediate_danger'> & { immediate_danger?: boolean },
  actor: ComplaintActor,
  draftId?: string | null,
): Promise<ModuleComplaintData> {
  try {
    const now = new Date().toISOString();
    const base = {
      title: input.title,
      description: input.description,
      category: input.category,
      category_id: input.category_id || null,
      subcategory: input.subcategory ?? null,
      severity: input.severity,
      priority: input.severity,
      priority_label: input.priority,
      immediate_danger: !!input.immediate_danger,
      mine_id: input.mine_id,
      location: input.location || null,
      location_name: input.location_name || null,
      location_address: input.location_address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      gps_latitude: input.gps_latitude ?? null,
      gps_longitude: input.gps_longitude ?? null,
      gps_accuracy: input.gps_accuracy ?? null,
      department: input.department || null,
      work_area: input.work_area || null,
      shift: input.shift || null,
      witnesses: input.witnesses || null,
      immediate_action_taken: input.immediate_action_taken || null,
      reported_by: actor.id ?? null,
      reported_by_name: actor.name,
      reported_at: now,
      status: 'Draft' as ComplaintStatus,
      is_archived: false,
      escalation_count: 0,
      is_draft: true,
      draft_updated_at: now,
      updated_at: now,
    };
    let complaint: Complaint | null = null;
    if (draftId) {
      await fbUpdateOf('complaints', { ...base, updated_at: now }).eq('id', draftId).run();
      complaint = (await complaintsService.getById(draftId)) ?? null;
    } else {
      const { data } = await fbInsertInto('complaints', base).select();
      complaint = (data as Complaint) ?? null;
    }
    if (!complaint) return { complaint: null, error: 'Could not create draft' };
    return { complaint, id: complaint.id };
  } catch (e: any) {
    return { complaint: null, error: e.message };
  }
}

export async function listMyDrafts(userId: string): Promise<Complaint[]> {
  const { data } = await fb('complaints').select('*').eq('reported_by', userId).run<Complaint[]>();
  const list = ((data ?? []) as Complaint[]) ?? [];
  return list
    .filter((c) => c.is_draft === true)
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
}

// ══════════════════════════════════════════════════════════════════════
// Workflow transitions — single gate for all status changes
// ══════════════════════════════════════════════════════════════════════

async function hasVerifiedRecord(complaintId: string): Promise<boolean> {
  const { data } = await fb('complaint_verifications').select('*').eq('complaint_id', complaintId).eq('verification_status', 'Verified').run<any[]>();
  return ((data ?? []) as any[]).length > 0;
}

/**
 * Validate + persist a status transition (history, timeline event, audit,
 * notifications). Critical complaints are hardened: verification is
 * mandatory before resolve/close and no stage may be skipped.
 */
export async function transitionComplaint(
  complaintId: string,
  toStatus: ComplaintStatus,
  actor: ComplaintActor,
  note?: string | null,
  extra?: Record<string, unknown>,
): Promise<TransitionResult> {
  try {
    const cur = (await complaintsService.getById(complaintId)) ?? null;
    if (!cur) return { ok: false, error: 'Complaint not found' };
    const from = cur.status;

    if (!nextStatusOptions(from).includes(toStatus as ComplaintStatus)) {
      return { ok: false, error: `Invalid transition: ${from} → ${toStatus}` };
    }

    // Critical-complaint hardening
    const isCrit = cur.severity === 'Critical' || cur.is_critical === true;
    if (isCrit && toStatus === 'Resolved') {
      const verified = await hasVerifiedRecord(complaintId);
      if (!verified) {
        return { ok: false, error: 'Critical complaints must be verified before they can be resolved. Complete the verification step first.' };
      }
    }
    if (isCrit) {
      const priorStages = ['Acknowledged', 'Under Investigation', 'Action Assigned', 'Action In Progress', 'Verification'];
      if (['Resolved', 'Closed', 'Verified'].includes(toStatus) && !priorStages.includes(from as string)) {
        return { ok: false, error: `Critical complaints must pass through each workflow stage. Current stage: ${from}.` };
      }
    }
    // Normal hardening: closed must come from Resolved, resolved from Verification
    if (toStatus === 'Closed' && from !== 'Resolved') {
      return { ok: false, error: 'A complaint can only be closed after it has been resolved.' };
    }
    if (toStatus === 'Resolved' && from !== 'Verification') {
      return { ok: false, error: 'A complaint can only be resolved after verification.' };
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: toStatus,
      updated_at: now,
      ...(extra ?? {}),
    };
    if (toStatus === 'Acknowledged') {
      patch.acknowledged_at = cur.acknowledged_at ?? now;
      patch.acknowledged_by = cur.acknowledged_by ?? actor.id ?? null;
    }
    if (toStatus === 'Verification') {
      patch.verification_requested_at = cur.verification_requested_at ?? now;
      patch.verification_requested_by = cur.verification_requested_by ?? actor.id ?? null;
    }
    if (toStatus === 'Resolved' && extra?.resolved_at == null) {
      patch.resolved_at = cur.resolved_at ?? now;
      patch.resolved_by = cur.resolved_by ?? actor.id ?? null;
      if (note) patch.resolution_notes = note;
    }
    if (toStatus === 'Closed') {
      patch.closed_at = cur.closed_at ?? now;
      patch.closed_by = cur.closed_by ?? actor.id ?? null;
      if (note) patch.closed_note = note;
      patch.is_archived = false;
    }
    await fbUpdateOf('complaints', patch).eq('id', complaintId).run();

    await addStatusRow(complaintId, cur.complaint_number, from, toStatus, actor, note ?? null);
    await addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: STATUS_ACTION_LABELS[toStatus] ?? 'UPDATED',
      old_status: from,
      new_status: toStatus,
      comment: note ?? null,
    });

    // Notifications
    try {
      const profiles = await loadProfiles();
      const reporter = profiles.find((p) => p.id === cur.reported_by);
      const recipients: ProfileRow[] = [];
      if (['Acknowledged', 'Under Investigation', 'Action Assigned', 'Action In Progress', 'Verification', 'Resolved', 'Closed', 'Rejected', 'Escalated'].includes(toStatus) && reporter) {
        recipients.push(reporter);
      }
      if (['Submitted', 'Acknowledged', 'Verification', 'Resolved'].includes(toStatus)) {
        const officers = await findRoles(['safety_officer'], cur.mine_id ?? null);
        const admins = await findRoles(['mine_manager', 'super_admin']);
        recipients.push(...officers, ...admins);
      }
      const unique = Array.from(new Map(recipients.map((r) => [r.id, r])).values());
      await notifyUsers(unique, {
        complaint_id: complaintId,
        title: `Complaint ${cur.complaint_number} → ${toStatus}`,
        body: note || `Status updated from ${from} to ${toStatus}.`,
        severity: cur.severity,
        action_required: toStatus === 'Verification' ? 'Verify corrective action' : toStatus === 'Closed' ? 'Review closure' : null,
        deadline: cur.due_date ?? null,
      });
    } catch (e) {
      console.warn('[complaintModule] transition notify failed:', e);
    }

    await logAuditRow(actor, `COMPLAINT_STATUS_${toStatus.toUpperCase().replace(/ /g, '_')}`, complaintId, from, toStatus, note ?? null);

    const fresh = (await complaintsService.getById(complaintId)) ?? null;
    return { ok: true, complaint: fresh ?? undefined };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════
// Investigations (collection `complaint_investigations`)
// ══════════════════════════════════════════════════════════════════════

export interface InvestigationInput {
  complaint_id: string;
  investigation_date?: string;
  findings: string;
  root_cause: string | null;
  contributing_factors: string | null;
  risk_assessment: string | null;
  immediate_action_taken: string | null;
  recommended_actions: string | null;
}

export async function createInvestigation(
  input: InvestigationInput,
  actor: ComplaintActor,
): Promise<{ ok: boolean; error?: string; investigation?: ComplaintInvestigation }> {
  try {
    const cur = (await complaintsService.getById(input.complaint_id)) ?? null;
    const now = new Date().toISOString();
    const record = {
      complaint_id: input.complaint_id,
      complaint_number: cur?.complaint_number ?? null,
      investigator_id: actor.id ?? null,
      investigator_name: actor.name,
      investigator_role: actor.role ?? null,
      investigation_date: input.investigation_date ?? now,
      findings: input.findings,
      root_cause: input.root_cause ?? null,
      contributing_factors: input.contributing_factors ?? null,
      risk_assessment: input.risk_assessment ?? null,
      immediate_action_taken: input.immediate_action_taken ?? null,
      recommended_actions: input.recommended_actions ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await fbInsertInto('complaint_investigations', record).select();
    if (error) return { ok: false, error: error.message };
    const investigation = data as ComplaintInvestigation;

    // move the complaint forward
    await fbUpdateOf('complaints', {
      investigation_id: investigation.id,
      investigation_started_at: cur?.investigation_started_at ?? now,
      updated_at: now,
    }).eq('id', input.complaint_id).run();

    await addStatusRow(input.complaint_id, cur?.complaint_number ?? null, cur?.status ?? null, 'Under Investigation', actor, input.findings);
    await addEvent(input.complaint_id, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      action: 'INVESTIGATION_STARTED',
      old_status: cur?.status ?? null,
      new_status: 'Under Investigation',
      comment: `Investigation by ${actor.name}: ${input.findings.slice(0, 200)}`,
    });
    await logAuditRow(actor, 'COMPLAINT_INVESTIGATION_ADDED', input.complaint_id, cur?.status ?? null, 'Under Investigation', input.findings);

    try {
      const profiles = await loadProfiles();
      const reporter = profiles.find((p) => p.id === cur?.reported_by);
      const recipients = [
        ...(reporter ? [reporter] : []),
        ...(await findRoles(['mine_manager', 'super_admin'])),
      ];
      await notifyUsers(recipients, {
        complaint_id: input.complaint_id,
        title: `Investigation started − ${cur?.complaint_number ?? ''}`,
        body: `Investigated by ${actor.name}. Root cause: ${input.root_cause || 'TBD'}.`,
        severity: cur?.severity ?? null,
      });
    } catch (e) {
      console.warn('[complaintModule] investigation notify failed:', e);
    }

    return { ok: true, investigation };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function listInvestigations(complaintId?: string | null): Promise<ComplaintInvestigation[]> {
  const q = fb('complaint_investigations').select('*');
  if (complaintId) q.eq('complaint_id', complaintId);
  const { data } = await q.run<ComplaintInvestigation[]>();
  const list = ((data ?? []) as ComplaintInvestigation[]) ?? [];
  return list.sort((a, b) => String(b.investigation_date ?? '').localeCompare(String(a.investigation_date ?? '')));
}

export async function updateInvestigation(id: string, patch: Partial<ComplaintInvestigation>): Promise<void> {
  await fbUpdateOf('complaint_investigations', { ...patch, updated_at: new Date().toISOString() }).eq('id', id).run();
}

// ══════════════════════════════════════════════════════════════════════
// Corrective actions (collection `corrective_actions`)
// ══════════════════════════════════════════════════════════════════════

export interface CorrectiveActionInput {
  complaint_id: string;
  action_title: string;
  action_description: string;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
  priority?: Severity;
  completion_notes?: string | null;
}

export async function addCorrectiveAction(
  input: CorrectiveActionInput,
  actor: ComplaintActor,
): Promise<{ ok: boolean; error?: string; corrective_action?: any }> {
  try {
    const cur = (await complaintsService.getById(input.complaint_id)) ?? null;
    const now = new Date().toISOString();
    const record = {
      complaint_id: input.complaint_id,
      complaint_number: cur?.complaint_number ?? null,
      title: input.action_title,
      action_description: input.action_description,
      status: 'Pending',
      completion_percentage: 0,
      assigned_to: input.assigned_to_id ?? null,
      assigned_to_name: input.assigned_to_name ?? null,
      due_date: input.due_date ? new Date(`${input.due_date}T23:59:59`).toISOString() : null,
      priority: input.priority ?? cur?.severity ?? 'Medium',
      completion_notes: input.completion_notes ?? null,
      created_by: actor.id ?? null,
      created_by_name: actor.name,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await fbInsertInto('corrective_actions', record).select();
    if (error) return { ok: false, error: error.message };

    if (cur && ['Submitted', 'Acknowledged', 'Under Investigation'].includes(cur.status)) {
      await fbUpdateOf('complaints', {
        assigned_to: input.assigned_to_id ?? cur.assigned_to ?? null,
        assigned_by: actor.id ?? null,
        assigned_at: now,
        due_date: record.due_date ?? cur.due_date ?? null,
        updated_at: now,
        status: 'Action Assigned',
      }).eq('id', input.complaint_id).run();
      await addStatusRow(input.complaint_id, cur.complaint_number, cur.status, 'Action Assigned', actor, input.action_description);
      await addEvent(input.complaint_id, {
        actor_name: actor.name,
        actor_role: actor.role ?? null,
        action: 'ACTION_ASSIGNED',
        old_status: cur.status,
        new_status: 'Action Assigned',
        comment: `Corrective action: ${input.action_title}${input.assigned_to_name ? ` → ${input.assigned_to_name}` : ''}`,
      });
      await logAuditRow(actor, 'COMPLAINT_ACTION_ASSIGNED', input.complaint_id, cur.status, 'Action Assigned', `${input.action_title} — ${input.assigned_to_name ?? 'Team'}`);
    }

    // notify assignee + officers
    try {
      const recipients: ProfileRow[] = [];
      if (input.assigned_to_id) recipients.push({ id: input.assigned_to_id } as ProfileRow);
      recipients.push(...(await findRoles(['safety_officer', 'mine_manager', 'super_admin'], cur?.mine_id ?? null)));
      const unique = Array.from(new Map(recipients.map((r) => [r.id, r])).values());
      await notifyUsers(unique, {
        complaint_id: input.complaint_id,
        title: `Corrective action assigned − ${cur?.complaint_number ?? ''}`,
        body: `${input.action_title}. Due: ${record.due_date ? new Date(record.due_date).toLocaleDateString() : 'Not set'}.${input.assigned_to_name ? ` Assigned to ${input.assigned_to_name}.` : ''}`,
        severity: (input.priority as Severity) ?? cur?.severity ?? null,
        action_required: input.assigned_to_id ? 'Take action' : 'Assign & execute',
        deadline: record.due_date ?? null,
      });
    } catch (e) {
      console.warn('[complaintModule] action notify failed:', e);
    }

    return { ok: true, corrective_action: data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function updateCorrectiveAction(
  caId: string,
  patch: {
    status?: string;
    completion_percentage?: number;
    completion_notes?: string;
    due_date?: string | null;
    assigned_to?: string | null;
    assigned_to_name?: string | null;
    action_description?: string;
  },
): Promise<void> {
  await fbUpdateOf('corrective_actions', { ...patch, updated_at: new Date().toISOString() }).eq('id', caId).run();
}

export async function listCorrectiveActions(complaintId?: string | null): Promise<any[]> {
  const q = fb('corrective_actions').select('*');
  if (complaintId) q.eq('complaint_id', complaintId);
  const { data } = await q.run<any[]>();
  const list = ((data ?? []) as any[]) ?? [];
  return list.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

// ══════════════════════════════════════════════════════════════════════
// Verifications (collection `complaint_verifications`)
// ══════════════════════════════════════════════════════════════════════

export interface VerificationInput {
  comments?: string | null;
  completion_details?: string | null;
  photo_urls?: string[];
  decision: 'Verified' | 'Rejected' | 'Rework Required';
}

/**
 * Record a verification pass/rework decision against the complaint.
 * Verified → complaint becomes Resolved (and may then be closed).
 * Rejected / Rework Required → complaint returns to Action In Progress.
 */
export async function submitVerification(
  complaintId: string,
  input: VerificationInput,
  actor: ComplaintActor,
): Promise<TransitionResult> {
  try {
    const cur = (await complaintsService.getById(complaintId)) ?? null;
    if (!cur) return { ok: false, error: 'Complaint not found' };

    const now = new Date().toISOString();
    const record = {
      complaint_id: complaintId,
      complaint_number: cur.complaint_number ?? null,
      verification_status: input.decision,
      verified_by: actor.id ?? null,
      verified_by_name: actor.name,
      verified_by_role: actor.role ?? null,
      verification_date: now,
      comments: input.comments ?? null,
      completion_details: input.completion_details ?? null,
      photo_urls: input.photo_urls ?? [],
      created_at: now,
    };
    const { data, error } = await fbInsertInto('complaint_verifications', record).select();
    if (error) return { ok: false, error: error.message };

    if (input.decision === 'Verified') {
      await fbUpdateOf('complaints', {
        status: 'Resolved',
        verified_by: actor.id ?? null,
        verified_by_name: actor.name,
        verified_at: cur.verified_at ?? now,
        resolved_at: cur.resolved_at ?? now,
        resolved_by: cur.resolved_by ?? actor.id ?? null,
        resolution_notes: input.completion_details ?? input.comments ?? null,
        updated_at: now,
      }).eq('id', complaintId).run();
      await addStatusRow(complaintId, cur.complaint_number, cur.status, 'Resolved', actor, input.completion_details ?? input.comments ?? null);
      await addEvent(complaintId, {
        actor_name: actor.name,
        actor_role: actor.role ?? null,
        action: 'VERIFIED',
        old_status: cur.status,
        new_status: 'Resolved',
        comment: `${actor.name} verified completion. ${input.comments ?? ''}`.trim(),
      });
      await logAuditRow(actor, 'COMPLAINT_VERIFIED', complaintId, cur.status, 'Resolved', input.comments ?? null);
    } else {
      await fbUpdateOf('complaints', {
        status: 'Action In Progress',
        updated_at: now,
      }).eq('id', complaintId).run();
      await addStatusRow(complaintId, cur.complaint_number, cur.status, 'Action In Progress', actor, `${input.decision}: ${input.comments ?? ''}`);
      await addEvent(complaintId, {
        actor_name: actor.name,
        actor_role: actor.role ?? null,
        action: 'REJECTED',
        old_status: cur.status,
        new_status: 'Action In Progress',
        comment: `${input.decision}: ${input.comments ?? ''}`,
      });
      await logAuditRow(actor, 'COMPLAINT_VERIFICATION_REWORK', complaintId, cur.status, 'Action In Progress', input.comments ?? null);
    }

    try {
      const profiles = await loadProfiles();
      const reporter = profiles.find((p) => p.id === cur.reported_by);
      const recipients = [
        ...(reporter ? [reporter] : []),
        ...(await findRoles(['safety_officer', 'mine_manager', 'super_admin'], cur.mine_id ?? null)),
      ];
      const unique = Array.from(new Map(recipients.map((r) => [r.id, r])).values());
      await notifyUsers(unique, {
        complaint_id: complaintId,
        title: `Verification ${input.decision} − ${cur.complaint_number ?? ''}`,
        body: `${actor.name}: ${input.decision}. ${input.comments ?? ''}`,
        severity: cur.severity,
        action_required: input.decision === 'Verified' ? 'Close the complaint' : 'Execute rework',
      });
    } catch (e) {
      console.warn('[complaintModule] verification notify failed:', e);
    }

    return { ok: true, complaint: (await complaintsService.getById(complaintId)) ?? undefined };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function listVerifications(complaintId: string): Promise<ComplaintVerification[]> {
  const { data } = await fb('complaint_verifications').select('*').eq('complaint_id', complaintId).run<ComplaintVerification[]>();
  const list = ((data ?? []) as ComplaintVerification[]) ?? [];
  return list.sort((a, b) => String(b.verification_date ?? '').localeCompare(String(a.verification_date ?? '')));
}

// ══════════════════════════════════════════════════════════════════════
// Status history (collection `complaint_status_history`)
// ══════════════════════════════════════════════════════════════════════

export async function listStatusHistory(complaintId: string): Promise<ComplaintStatusHistory[]> {
  const { data } = await fb('complaint_status_history').select('*').eq('complaint_id', complaintId).run<ComplaintStatusHistory[]>();
  const list = ((data ?? []) as ComplaintStatusHistory[]) ?? [];
  return list.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
}

// ══════════════════════════════════════════════════════════════════════
// Evidence / attachments (collection `complaint_attachments` + storage
// bucket `complaints-attachments`)
// ══════════════════════════════════════════════════════════════════════

export async function uploadEvidenceFile(
  file: File,
  kind: 'photo' | 'video',
  uploader: { id?: string | null; name: string },
): Promise<{ storagePath?: string; url?: string; error?: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `complaints-attachments/${uploader.id ?? 'anonymous'}/${Date.now()}_${safeName}`;
  const { error } = await fbUploadFile(storagePath, file);
  if (error) return { error: error.message };
  try {
    const url = await fbGetDownloadURL(storagePath);
    return { storagePath, url };
  } catch (e: any) {
    return { storagePath, error: e.message };
  }
}

export async function attachEvidence(
  complaintId: string,
  items: Array<{
    kind: 'photo' | 'video';
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    download_url?: string | null;
    description?: string | null;
  }>,
  actor: ComplaintActor,
): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const complaint = (await complaintsService.getById(complaintId)) ?? null;
    const now = new Date().toISOString();
    let count = 0;
    for (const it of items) {
      const row = {
        complaint_id: complaintId,
        complaint_number: complaint?.complaint_number ?? null,
        kind: it.kind,
        file_name: it.file_name,
        file_type: it.file_type,
        file_size: it.file_size,
        storage_path: it.storage_path,
        download_url: it.download_url ?? null,
        description: it.description ?? null,
        uploaded_by: actor.id ?? null,
        uploaded_by_name: actor.name,
        created_at: now,
      };
      const { data } = await fbInsertInto('complaint_attachments', row).select();
      if (data && data.id) count += 1;
    }
    return { ok: true, count };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function listAttachments(complaintId: string): Promise<ComplaintAttachment[]> {
  const { data } = await fb('complaint_attachments').select('*').eq('complaint_id', complaintId).run<ComplaintAttachment[]>();
  const list = ((data ?? []) as ComplaintAttachment[]) ?? [];
  return list.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export async function deleteAttachment(
  attachment: ComplaintAttachment,
  actor: ComplaintActor,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await fbDeleteFrom('complaint_attachments').eq('id', attachment.id).run();
    try {
      if (attachment.storage_path) {
        await deleteObject(ref(getStorage(), attachment.storage_path));
      }
    } catch {
      // storage cleanup is best effort
    }
    await logAuditRow(actor, 'COMPLAINT_EVIDENCE_DELETED', attachment.complaint_id, null, null, `Deleted evidence ${attachment.file_name}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════
// Module list queries — mine/assignee joins + in-memory filters so no
// composite Firestore indexes are required (matches app-wide convention)
// ══════════════════════════════════════════════════════════════════════

export interface ModuleListOptions {
  mineId?: string | null;
  userId?: string | null;       // reporter scope
  assignedTo?: string | null;   // assignee scope
  mineName?: string | null;
  search?: string;
  category?: string | null;
  severity?: Severity | null;
  status?: ComplaintStatus | null;
  department?: string | null;
  includeDrafts?: boolean;
  includeArchived?: boolean;
  dateFrom?: string | null;     // yyyy-mm-dd
  dateTo?: string | null;       // yyyy-mm-dd
  onlyOverdue?: boolean;
  onlyCritical?: boolean;
  limit?: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function isOverdue(c: Complaint, now = new Date()): boolean {
  if (['Resolved', 'Closed', 'Verified', 'Rejected'].includes(c.status)) return false;
  if (!c.due_date) return false;
  return new Date(c.due_date).getTime() < now.getTime();
}

export async function listComplaints(opts: ModuleListOptions = {}): Promise<Complaint[]> {
  const q = fb('complaints').select('*');
  if (opts.mineId) q.eq('mine_id', opts.mineId);
  const { data, error } = await q.run<Complaint[]>();
  if (error) throw new Error(error.message);
  let list = ((data ?? []) as Complaint[]) ?? [];

  // mine name join
  try {
    const { data: mines } = await fb('mines').select('*').run<any[]>();
    const minesMap: Record<string, string> = {};
    for (const m of ((mines ?? []) as any[])) minesMap[m.id] = m.mine_name ?? m.mine_code ?? m.id;
    list = list.map((c) => ({ ...c, mine_name: c.mine_name ?? (c.mine_id ? minesMap[c.mine_id] ?? null : null) }));
  } catch {
    // join optional
  }

  // assignee name join
  if (opts.assignedTo || list.some((c) => c.assigned_to)) {
    try {
      const profiles = await loadProfiles();
      const nameFor: Record<string, string> = {};
      for (const p of profiles) nameFor[p.id] = p.full_name ?? p.id;
      list = list.map((c) => ({
        ...c,
        assigned_to_name: c.assigned_to_name ?? (c.assigned_to ? nameFor[c.assigned_to] ?? undefined : undefined),
      }));
    } catch {
      // join optional
    }
  }

  if (opts.userId) list = list.filter((c) => c.reported_by === opts.userId);
  if (opts.assignedTo) list = list.filter((c) => c.assigned_to === opts.assignedTo);
  if (opts.mineName) list = list.filter((c) => (c.mine_name ?? '').toLowerCase().includes(opts.mineName!.toLowerCase()));
  if (opts.search) {
    const s = opts.search.toLowerCase();
    list = list.filter((c) =>
      [c.complaint_number, c.title, c.description, c.location, c.subcategory, c.department, c.work_area]
        .map((v) => (v ?? '').toLowerCase())
        .some((v) => v.includes(s))
    );
  }
  if (opts.category) list = list.filter((c) => c.category === opts.category);
  if (opts.severity) list = list.filter((c) => c.severity === opts.severity);
  if (opts.status) list = list.filter((c) => c.status === opts.status);
  if (opts.department) list = list.filter((c) => c.department === opts.department);
  if (opts.dateFrom) list = list.filter((c) => (c.reported_at ?? '').slice(0, 10) >= opts.dateFrom!);
  if (opts.dateTo) list = list.filter((c) => (c.reported_at ?? '').slice(0, 10) <= opts.dateTo!);
  if (opts.onlyOverdue) list = list.filter((c) => isOverdue(c));
  if (opts.onlyCritical) list = list.filter((c) => c.severity === 'Critical' || c.is_critical === true);
  if (opts.includeDrafts !== true) list = list.filter((c) => c.is_draft !== true);
  if (opts.includeArchived !== true) list = list.filter((c) => c.is_archived !== true);

  list.sort((a, b) => String(b.reported_at ?? b.created_at ?? '').localeCompare(String(a.reported_at ?? a.created_at ?? '')));
  if (opts.limit) list = list.slice(0, opts.limit);
  return list;
}

/** Complaints in Verification that have not received a decision. */
export async function listAwaitingVerification(opts: { mineId?: string | null } = {}): Promise<Complaint[]> {
  return (await listComplaints({ mineId: opts.mineId, status: 'Verification', includeArchived: false })).sort(
    (a, b) => String(a.verification_requested_at ?? '').localeCompare(String(b.verification_requested_at ?? ''))
  );
}

/** SLA / due-date summary for a complaint. */
export interface ComplaintSlaInfo {
  overdue: boolean;
  daysLeft: number | null;
  overDays: number | null;
  slaHours: number;
}

export function slaInfo(c: Complaint, now = new Date()): ComplaintSlaInfo {
  const hours = SLA_BY_PRIORITY[(c.priority_label ?? (c.priority as Priority)) as Priority] ?? SLA_BY_PRIORITY.Medium;
  if (!c.due_date) return { overdue: false, daysLeft: null, overDays: null, slaHours: hours };
  const daysLeft = daysBetween(now, new Date(c.due_date));
  return {
    overdue: daysLeft < 0,
    daysLeft: Math.max(0, daysLeft),
    overDays: daysLeft < 0 ? Math.abs(daysLeft) : null,
    slaHours: hours,
  };
}