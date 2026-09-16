// ────────────────────────────────────────────────────────────────
// Complaints service — full workflow data operations (Firestore)
// ────────────────────────────────────────────────────────────────
import { fb, fbInsertInto, fbUpdateOf, fbDeleteFrom, fbUploadFile, fbGetDownloadURL, getDocById } from './firebaseDb';
import {
  Complaint,
  ComplaintEvent,
  ComplaintComment,
  Inspection,
  CorrectiveAction,
  Severity,
  ComplaintStatus,
  UserRole,
} from './types';
import { isCriticalHazard } from './hazards';
import { logAudit } from './audit';
import { notify } from './notifications';

function generateComplaintNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CM-${ymd}-${rand}`;
}

export interface CreateComplaintInput {
  title: string;
  description: string;
  category: string;
  severity: Severity;
  mine_id: string | null;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  video_url?: string | null;
  reported_by: string;
  reported_by_name: string;
  reported_employee_id: string;
  immediateDanger?: boolean;
}

let minesLookupCache: Record<string, string> | null = null;
async function loadMinesLookup(): Promise<Record<string, string>> {
  if (minesLookupCache) return minesLookupCache;
  const { data } = await fb('mines').select('*').run<any[]>();
  const map: Record<string, string> = {};
  for (const m of ((data ?? []) as any[])) map[m.id] = m.mine_name ?? m.mine_code ?? m.id;
  minesLookupCache = map;
  return map;
}

export const complaintsService = {
  generateComplaintNumber,

  async create(input: CreateComplaintInput): Promise<{ complaint?: Complaint; error?: string }> {
    try {
      const number = generateComplaintNumber();
      const now = new Date().toISOString();
      const critical = isCriticalHazard(input.severity, !!input.immediateDanger);
      const insertData = {
        complaint_number: number,
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        priority: input.severity,
        mine_id: input.mine_id,
        location: input.location ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        photo_url: input.photo_url ?? null,
        video_url: input.video_url ?? null,
        reported_by: input.reported_by,
        reported_by_name: input.reported_by_name,
        reported_employee_id: input.reported_employee_id,
        reported_at: now,
        status: 'Submitted' as ComplaintStatus,
        is_critical: critical,
        immediate_danger: !!input.immediateDanger,
        is_archived: false,
        archived_at: null,
        archived_by: null,
        escalation_count: critical ? 1 : 0,
        due_date: critical ? new Date(Date.now() + 48 * 3600 * 1000).toISOString() : null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await fbInsertInto('complaints', insertData).select();
      if (error) return { error: error.message };
      const complaint = data as Complaint;

      // Log timeline event
      await this.addEvent(complaint.id, {
        actor_name: input.reported_by_name,
        actor_role: 'worker',
        action: critical ? 'CRITICAL_REPORT' : 'SUBMITTED',
        old_status: null,
        new_status: 'Submitted',
        comment: input.description,
      });

      // Notify relevant users of critical hazards
      if (critical) {
        try {
          const { data: allProfiles } = await fb('profiles').select('*').run<any[]>();
          const profiles = (allProfiles ?? []) as any[];
          const recipients = profiles
            .filter((p: any) => ['safety_officer', 'mine_manager', 'super_admin'].includes(p.role) && p.is_active !== false)
            .map((p: any) => ({ id: p.id }));
          if (recipients.length > 0) {
            await notify(recipients, {
              complaint_id: complaint.id,
              title: `🚨 Critical Hazard: ${input.title}`,
              body: `Severity: ${input.severity}. Immediate danger: ${input.immediateDanger ? 'Yes' : 'No'}.`,
              severity: input.severity,
              action_required: 'Immediate action required',
            });
          }
        } catch (e) { console.warn('[complaints] notification send failed:', e); }
        // Audit log
        try {
          await logAudit({
            user_id: input.reported_by,
            user_name: input.reported_by_name,
            action: 'COMPLAINT_CRITICAL',
            entity_type: 'complaint',
            entity_id: complaint.id,
            new_status: 'Submitted',
            description: `Critical hazard reported: ${input.title}`,
          });
        } catch {}
      }

      return { complaint };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  // List complaints scoped by role. DB security rules enforce actual visibility.
  // IMPORTANT: only a SINGLE-field Firestore equality is used (no composite
  // indexes required); secondary filters (status / category / search) run
  // in-memory so the behaviour is identical online and offline.
  async list(opts: { mineId?: string | null; status?: ComplaintStatus[]; category?: string; search?: string; includeArchived?: boolean } = {}): Promise<Complaint[]> {
    const q = fb('complaints').select('*');
    if (opts.mineId) q.eq('mine_id', opts.mineId);
    const { data, error } = await q.run<Complaint[]>();
    if (error) throw new Error(error.message);
    let list = ((data ?? []) as Complaint[]) ?? [];

    const minesMap = await loadMinesLookup();
    list = list.map((c) => ({ ...c, mine_name: c.mine_name ?? (c.mine_id ? minesMap[c.mine_id] ?? null : null) }));

    // secondary filters in memory (no extra Firestore constraints → no index)
    if (opts.status && opts.status.length) list = list.filter((c) => opts.status!.includes(c.status));
    if (opts.category) list = list.filter((c) => c.category === opts.category);
    if (opts.search) {
      const qs = opts.search.toLowerCase();
      list = list.filter((c) =>
        (c.complaint_number?.toLowerCase().includes(qs) ?? false) ||
        (c.title?.toLowerCase().includes(qs) ?? false) ||
        (c.category?.toLowerCase().includes(qs) ?? false)
      );
    }
    // By default, hide archived (soft-deleted) records.
    list = opts.includeArchived ? list : list.filter((c) => c.is_archived !== true);
    list.sort((a, b) => String(b.reported_at ?? b.created_at ?? '').localeCompare(String(a.reported_at ?? a.created_at ?? '')));
    return list;
  },

  async getById(id: string): Promise<Complaint | null> {
    const direct = await getDocById<Complaint>('complaints', id);
    if (direct) return direct;
    const { data } = await fb('complaints').select('*').eq('id', id).single().run<Complaint>();
    return (data ?? null) as Complaint | null;
  },

  // ── Timeline events ──
  async events(complaintId: string): Promise<ComplaintEvent[]> {
    const { data, error } = await fb('complaint_events')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true })
      .run<ComplaintEvent[]>();
    if (error) throw new Error(error.message);
    return (data ?? []) as ComplaintEvent[];
  },

  async addEvent(complaintId: string, ev: {
    actor_name: string;
    actor_role?: UserRole | null;
    actor_designation?: string | null;
    action: string;
    old_status?: string | null;
    new_status?: string | null;
    comment?: string | null;
  }): Promise<void> {
    await fbInsertInto('complaint_events', {
      complaint_id: complaintId,
      actor_name: ev.actor_name,
      actor_role: ev.actor_role ?? null,
      actor_designation: ev.actor_designation ?? null,
      action: ev.action,
      old_status: ev.old_status ?? null,
      new_status: ev.new_status ?? null,
      comment: ev.comment ?? null,
      created_at: new Date().toISOString(),
    }).run();
  },

  // ── Comments ──
  async comments(complaintId: string): Promise<ComplaintComment[]> {
    const { data, error } = await fb('complaint_comments')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true })
      .run<ComplaintComment[]>();
    if (error) throw new Error(error.message);
    return (data ?? []) as ComplaintComment[];
  },

  async addComment(complaintId: string, body: string, author: { id?: string; name: string; role?: UserRole | null }): Promise<void> {
    await fbInsertInto('complaint_comments', {
      complaint_id: complaintId,
      author_id: author.id ?? null,
      author_name: author.name,
      author_role: author.role ?? null,
      body,
      created_at: new Date().toISOString(),
    }).run();
  },

  // ── Status transitions (each logs a timeline event + audit via trigger) ──
  async updateStatus(complaintId: string, status: ComplaintStatus, actor: { name: string; role?: UserRole | null; designation?: string | null }, comment?: string): Promise<{ error?: string }> {
    const cur = await this.getById(complaintId);
    const oldStatus = cur?.status ?? null;
    const { error } = await fbUpdateOf('complaints', { status }).eq('id', complaintId).run();
    if (error) return { error: error.message };

    if (status === 'Resolved') {
      await fbUpdateOf('complaints', { resolved_at: new Date().toISOString() }).eq('id', complaintId).run();
    } else if (status === 'Verified') {
      await fbUpdateOf('complaints', { verified_at: new Date().toISOString() }).eq('id', complaintId).run();
    }

    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: 'STATUS_CHANGE',
      old_status: oldStatus,
      new_status: status,
      comment: comment ?? null,
    });
    return {};
  },


  async verify(complaintId: string, actor: { id?: string; name: string; role?: UserRole | null; designation?: string | null }, notes?: string): Promise<{ error?: string }> {
    await fbUpdateOf('complaints', { verified_by: actor.id ?? null, verified_at: new Date().toISOString(), status: 'Verified' }).eq('id', complaintId).run();
    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: 'VERIFIED',
      new_status: 'Verified',
      comment: notes ?? null,
    });
    return {};
  },

  async reject(complaintId: string, actor: { id?: string; name: string; role?: UserRole | null; designation?: string | null }, reason?: string): Promise<{ error?: string }> {
    await fbUpdateOf('complaints', { status: 'Rejected', resolution_notes: reason ?? null }).eq('id', complaintId).run();
    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: 'REJECTED',
      new_status: 'Rejected',
      comment: reason ?? null,
    });
    return {};
  },

  // Archive (soft-delete) a complaint — record is kept forever with timestamp
  async archive(complaintId: string, actor: { id?: string | null; name: string; role?: UserRole | null }): Promise<{ error?: string }> {
    const { error } = await fbUpdateOf('complaints', {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: actor.id ?? null,
    }).eq('id', complaintId).run();
    if (error) return { error: error.message };

    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      action: 'ARCHIVED',
      new_status: null,
      comment: 'Complaint archived (record preserved permanently)',
    });
    return {};
  },

  // Permanently delete a complaint — SUPER ADMIN ONLY. Writes a DELETED audit
  // event BEFORE removing the record so the deletion stays on the audit trail.
  async permanentlyDelete(complaintId: string, actor: { id?: string | null; name: string; role?: UserRole | null }): Promise<{ error?: string }> {
    if ((actor.role ?? null) !== 'super_admin') {
      return { error: 'Only Super Admin can permanently delete complaint records.' };
    }
    try {
      await this.addEvent(complaintId, {
        actor_name: actor.name,
        actor_role: 'super_admin',
        action: 'DELETED',
        new_status: null,
        comment: 'Complaint permanently deleted by Super Admin',
      });
      await fbDeleteFrom('complaints').eq('id', complaintId).run();
      return {};
    } catch (e: any) {
      return { error: e.message };
    }
  },

  // Delete a complaint as an administrator (role-aware policy):
  //   - Super Admin  → permanent delete (full removal, `DELETED` audit event kept)
  //   - Mine Manager → archive (soft-delete; hidden from all lists, but the
  //                    record, event log and on-chain fingerprint stay intact)
  async deleteByAdmin(complaintId: string, actor: { id?: string | null; name: string; role?: UserRole | null }): Promise<{ error?: string; kind?: 'deleted' | 'archived' }> {
    const r = actor.role ?? null;
    if (r === 'super_admin') {
      const res = await this.permanentlyDelete(complaintId, actor);
      if (res.error) return { error: res.error };
      return { kind: 'deleted' };
    }
    if (r === 'mine_manager') {
      const res = await this.archive(complaintId, actor);
      if (res.error) return { error: res.error };
      return { kind: 'archived' };
    }
    return { error: 'Only an administrator (Mine Manager or Super Admin) can delete complaints.' };
  },

  async reassign(complaintId: string, targetProfileId: string, targetRole: UserRole, actor: { id?: string; name: string; role?: UserRole | null; designation?: string | null }, comment?: string): Promise<{ error?: string }> {
    const { error } = await fbUpdateOf('complaints', {
      assigned_to: targetProfileId,
      assigned_role: targetRole,
      assigned_by: actor.id ?? null,
      assigned_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    }).eq('id', complaintId).run();
    if (error) return { error: error.message };

    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      actor_designation: actor.designation ?? null,
      action: 'REASSIGNED',
      new_status: 'Assigned',
      comment: comment ?? null,
    });
    return {};
  },

  async escalate(complaintId: string, actor: { id?: string; name: string; role?: UserRole | null }, comment?: string): Promise<{ error?: string }> {
    const cur = await this.getById(complaintId);
    const oldStatus = cur?.status ?? null;
    await fbUpdateOf('complaints', {
      status: 'Escalated',
      is_critical: true,
      escalation_count: (cur?.escalation_count ?? 0) + 1,
      due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', complaintId).run();
    await this.addEvent(complaintId, {
      actor_name: actor.name,
      actor_role: actor.role ?? null,
      action: 'ESCALATED',
      old_status: oldStatus,
      new_status: 'Escalated',
      comment: comment ?? null,
    });
    try {
      await logAudit({
        user_id: actor.id ?? null,
        user_name: actor.name,
        action: 'COMPLAINT_ESCALATED',
        entity_type: 'complaint',
        entity_id: complaintId,
        old_status: oldStatus,
        new_status: 'Escalated',
        description: comment ?? null,
      });
    } catch {}
    return {};
  },

  async addInspection(inp: Partial<Inspection>): Promise<void> {
    await fbInsertInto('inspections', inp).run();
  },

  async inspections(complaintId: string): Promise<Inspection[]> {
    const { data, error } = await fb('inspections')
      .select('*')
      .eq('complaint_id', complaintId)
      .run<Inspection[]>();
    if (error) throw new Error(error.message);
    const list = (data ?? []) as Inspection[];
    return list.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  },

  async addCorrectiveAction(ca: Partial<CorrectiveAction>): Promise<void> {
    await fbInsertInto('corrective_actions', { ...ca, created_at: new Date().toISOString() }).run();
  },

  async correctiveActions(complaintId: string): Promise<CorrectiveAction[]> {
    const { data, error } = await fb('corrective_actions')
      .select('*')
      .eq('complaint_id', complaintId)
      .run<CorrectiveAction[]>();
    if (error) throw new Error(error.message);
    const list = (data ?? []) as CorrectiveAction[];
    return list.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  },

  async uploadFile(bucket: string, path: string, file: File): Promise<{ url?: string; storagePath?: string; error?: string }> {
    const storagePath = `${bucket}/${path}`;
    const { error } = await fbUploadFile(storagePath, file);
    if (error) return { error: error.message };
    // Get the real download URL from Firebase Storage
    try {
      const url = await fbGetDownloadURL(storagePath);
      return { url, storagePath };
    } catch (e: any) {
      // Storage path is valid but URL fetch failed; return the path as a fallback
      return { storagePath, error: e.message };
    }
  },
};

