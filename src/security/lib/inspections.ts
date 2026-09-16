// ────────────────────────────────────────────────────────────────
// Mine Inspection service — full inspection workflow:
// create inspection → findings (risk-rated) → evidence (Storage) →
// corrective actions → verify / close → follow-up inspections.
// Reads/writes are single-field-query friendly (no composite indexes).
// ────────────────────────────────────────────────────────────────
import { fb, fbInsertInto, fbUpdateOf, fbDeleteFrom, fbUploadFile, fbGetDownloadURL, getDocById, upsertLocalDoc, setDocById } from './firebaseDb';
import { ensureMinesSeeded } from './mines';
import {
  Inspection, Finding, EvidenceItem, CorrectiveAction, InspectionLocation,
  Severity, UserRole, CorrectiveActionStatus,
} from './types';
import { riskScore, riskBand, isCriticalHazard, makeId } from './hazards';
import { logAudit } from './audit';
import { notify } from './notifications';

export interface FindingDraft {
  category: string;
  fault_type: string;
  description: string;
  severity: Severity;
  immediate_danger: boolean;
  workers_affected: number | null;
  exposure: number; // 1..4 likelihood of harm
  legal_reference: string | null;
  inspector_remarks: string | null;
}

export interface EvidenceDraft {
  kind: EvidenceItem['kind'];
  storage_path: string;
  download_url: string | null;
  description: string | null;
  uploaded_by_name: string;
}

export interface CorrectiveActionDraft {
  finding_id: string | null;
  responsible_department: string | null;
  responsible_employee: string | null;
  action_description: string;
  priority: string;
  deadline: string | null;
}

export interface CreateInspectionInput {
  complaint_id: string | null;
  mine_id: string | null;
  mine_name: string | null;
  mine_code: string | null;
  mine_type: string | null;
  inspection_type: string;
  inspection_date: string;
  shift: string | null;
  location: InspectionLocation | null;
  submission_notes: string | null;
  follow_up_of: string | null;
  inspector_id: string;
  inspector_name: string;
  inspector_role: string | null;
  findings: FindingDraft[];
  evidence: EvidenceDraft[];
  corrective_actions: CorrectiveActionDraft[];
}

function inspectionNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INSP-${ymd}-${rand}`;
}

let minesCacheList: any[] | null = null;
export async function fetchMines(): Promise<any[]> {
  if (minesCacheList) return minesCacheList;
  await ensureMinesSeeded().catch(() => {});
  const { data } = await fb('mines').select('*').run<any[]>();
  minesCacheList = ((data ?? []) as any[]).slice().sort((a, b) => String(a.mine_name ?? '').localeCompare(String(b.mine_name ?? '')));
  return minesCacheList;
}

function buildFinding(d: FindingDraft): Finding {
  const score = riskScore(d.severity, d.exposure);
  return {
    id: makeId('fnd'),
    category: d.category,
    fault_type: d.fault_type,
    description: d.description,
    severity: d.severity,
    immediate_danger: !!d.immediate_danger,
    workers_affected: d.workers_affected ?? null,
    risk_score: score,
    risk_level: riskBand(score),
    legal_reference: d.legal_reference ?? null,
    inspector_remarks: d.inspector_remarks ?? null,
    status: isCriticalHazard(d.severity, !!d.immediate_danger) ? 'Action Required' : 'Open',
  };
}

export const inspectionsService = {
  async list(opts: { mineId?: string | null; status?: string | null; search?: string } = {}): Promise<Inspection[]> {
    const q = fb('inspections').select('*');
    if (opts.mineId) q.eq('mine_id', opts.mineId);
    const { data, error } = await q.run<Inspection[]>();
    if (error) throw new Error(error.message);
    let list = (data ?? []) as Inspection[];

    const mines = await fetchMines();
    const mineMap: Record<string, string> = {};
    mines.forEach((m) => { mineMap[m.id] = m.mine_name ?? m.mine_code ?? m.id; });
    list = list.map((ins) => ({ ...ins, mine_name: ins.mine_name ?? (ins.mine_id ? mineMap[ins.mine_id] ?? null : null) }));

    if (opts.status) list = list.filter((ins) => ins.status === opts.status);
    if (opts.search) {
      const qs = opts.search.toLowerCase();
      list = list.filter((ins) =>
        (ins.inspection_number?.toLowerCase().includes(qs) ?? false) ||
        (ins.inspection_type?.toLowerCase().includes(qs) ?? false) ||
        (ins.inspector_name?.toLowerCase().includes(qs) ?? false)
      );
    }
    list.sort((a, b) => String(b.inspection_date ?? b.created_at ?? '').localeCompare(String(a.inspection_date ?? a.created_at ?? '')));
    return list;
  },

  async getById(id: string): Promise<Inspection | null> {
    return getDocById<Inspection>('inspections', id);
  },

  async create(input: CreateInspectionInput): Promise<{ inspection?: Inspection; error?: string }> {
    try {
      const now = new Date().toISOString();
      const findings: Finding[] = input.findings.map(buildFinding);
      const evidence: EvidenceItem[] = input.evidence.map((e) => ({
        id: makeId('ev'),
        kind: e.kind,
        storage_path: e.storage_path,
        download_url: e.download_url,
        description: e.description ?? null,
        uploaded_by_name: e.uploaded_by_name,
        uploaded_at: now,
      }));
      const corrective_actions: CorrectiveAction[] = input.corrective_actions.map((ca) => ({
        id: makeId('ca'),
        inspection_id: null,
        complaint_id: input.complaint_id,
        finding_id: ca.finding_id,
        responsible_department: ca.responsible_department ?? null,
        responsible_employee: ca.responsible_employee ?? null,
        action_description: ca.action_description,
        priority: ca.priority,
        deadline: ca.deadline ?? null,
        status: 'Pending' as const,
        completion_date: null,
        completion_evidence_urls: [],
        verification_date: null,
        verification_remarks: null,
        created_at: now,
        assigned_to: null,
        assigned_to_role: null,
        assigned_by: null,
        due_date: ca.deadline ?? null,
        completed_at: null,
        verification_notes: null,
      }));

      const docData = {
        inspection_number: inspectionNumber(),
        complaint_id: input.complaint_id ?? null,
        mine_id: input.mine_id ?? null,
        mine_name: input.mine_name ?? null,
        mine_code: input.mine_code ?? null,
        mine_type: input.mine_type ?? null,
        inspector_id: input.inspector_id,
        inspector_name: input.inspector_name,
        inspector_role: input.inspector_role ?? null,
        inspection_type: input.inspection_type,
        inspection_date: input.inspection_date,
        shift: input.shift ?? null,
        status: 'Submitted' as const,
        location: input.location ?? null,
        findings,
        evidence,
        corrective_actions,
        follow_up_of: input.follow_up_of ?? null,
        submission_notes: input.submission_notes ?? null,
        verified_by_id: null,
        verified_by_name: null,
        verified_at: null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await fbInsertInto('inspections', docData).select();
      if (error) return { error: error.message };
      const inspection = data as Inspection;

      for (const ca of corrective_actions) {
        await fbInsertInto('corrective_actions', { ...ca, inspection_id: inspection.id, created_at: now }).run();
      }

      try {
        await logAudit({
          user_id: input.inspector_id,
          user_name: input.inspector_name,
          role: input.inspector_role,
          action: 'INSPECTION_CREATED',
          entity_type: 'inspection',
          entity_id: inspection.id,
          description: `Inspection ${inspection.inspection_number} (${input.inspection_type}) created with ${findings.length} finding(s).`,
        });
      } catch {}

      const criticalFindings = findings.filter((f) => f.status === 'Action Required');
      if (criticalFindings.length > 0) {
        try {
          const { data: allProfiles } = await fb('profiles').select('*').run<any[]>();
          const recipients = (allProfiles ?? [])
            .filter((p: any) => ['safety_officer', 'mine_manager', 'super_admin'].includes(p.role) && p.is_active !== false)
            .map((p: any) => ({ id: p.id }));
          if (recipients.length) {
            await notify(recipients, {
              complaint_id: input.complaint_id,
              title: `🚨 ${criticalFindings.length} critical finding(s) from ${inspection.inspection_number}`,
              body: criticalFindings.map((f) => `${f.category}: ${f.fault_type}`).join('; ').slice(0, 240),
              severity: 'Critical',
              action_required: 'Review and action immediately',
            });
          }
        } catch {}
      }

      return { inspection };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  async update(id: string, patch: Partial<Inspection>): Promise<{ error?: string }> {
    const result = await fbUpdateOf('inspections', {
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq('id', id).run();
    if (result.error) return { error: result.error.message };
    try {
      const existing = getDocById<Inspection>('inspections', id);
      if (existing) upsertLocalDoc('inspections', { ...existing, ...patch, updated_at: new Date().toISOString() });
    } catch {}
    return {};
  },

  async verify(id: string, actor: { id: string; name: string }, notes?: string): Promise<{ error?: string }> {
    await this.update(id, {
      status: 'Verified',
      verified_by_id: actor.id,
      verified_by_name: actor.name,
      verified_at: new Date().toISOString(),
    });
    try {
      await logAudit({
        user_id: actor.id,
        user_name: actor.name,
        action: 'INSPECTION_VERIFIED',
        entity_type: 'inspection',
        entity_id: id,
        description: notes ?? null,
      });
    } catch {}
    return {};
  },

  async deleteInspection(id: string, actor: { id: string; name: string; role: UserRole }): Promise<{ error?: string }> {
    if (actor.role !== 'super_admin') return { error: 'Only Super Admin can delete inspection records.' };
    try {
      await fbDeleteFrom('inspections').eq('id', id).run();
      try {
        await logAudit({
          user_id: actor.id,
          user_name: actor.name,
          role: actor.role,
          action: 'INSPECTION_DELETED',
          entity_type: 'inspection',
          entity_id: id,
        });
      } catch {}
      return {};
    } catch (e: any) {
      return { error: e.message };
    }
  },

  async transitionCorrectiveAction(
    inspectionId: string,
    caId: string,
    newStatus: CorrectiveActionStatus,
    actor: { id?: string; name: string; role?: UserRole | null },
    notes?: string,
  ): Promise<{ error?: string }> {
    const inspection = await this.getById(inspectionId);
    if (!inspection) return { error: 'Inspection not found.' };
    const caIdx = inspection.corrective_actions.findIndex((c) => c.id === caId);
    if (caIdx === -1) return { error: 'Corrective action not found.' };

    const now = new Date().toISOString();
    const ca = { ...inspection.corrective_actions[caIdx] };
    ca.status = newStatus;
    if (newStatus === 'Completed') { ca.completion_date = now; ca.completed_at = now; }
    if (newStatus === 'Verified' || newStatus === 'Rejected' || newStatus === 'Requires Rework') {
      ca.verification_date = now; ca.verification_notes = notes ?? null;
    }
    inspection.corrective_actions[caIdx] = ca;

    await this.update(inspectionId, { corrective_actions: inspection.corrective_actions });
    await setDocById('corrective_actions', ca.id, { ...ca, inspection_id: inspectionId, updated_at: now });

    try {
      await logAudit({
        user_id: actor.id ?? null,
        user_name: actor.name,
        role: actor.role,
        action: 'CORRECTIVE_ACTION_' + newStatus.toUpperCase().replace(/\s+/g, '_'),
        entity_type: 'corrective_action',
        entity_id: caId,
        new_status: newStatus,
        description: notes ?? null,
      });
    } catch {}
    try {
      if (ca.responsible_employee) {
        await notify([{ id: ca.responsible_employee }], {
          complaint_id: inspection.complaint_id,
          title: `Corrective action ${newStatus}`,
          body: notes ?? `Status updated to ${newStatus}.`,
          action_required: 'Review and respond',
        });
      }
    } catch {}
    return {};
  },

  async addEvidence(inspectionId: string, evidence: EvidenceDraft, actorName: string): Promise<{ error?: string }> {
    const inspection = await this.getById(inspectionId);
    if (!inspection) return { error: 'Inspection not found.' };
    const item: EvidenceItem = {
      id: makeId('ev'),
      kind: evidence.kind,
      storage_path: evidence.storage_path,
      download_url: evidence.download_url,
      description: evidence.description ?? null,
      uploaded_by_name: actorName,
      uploaded_at: new Date().toISOString(),
    };
    inspection.evidence = [...(inspection.evidence ?? []), item];
    await this.update(inspectionId, { evidence: inspection.evidence });
    return {};
  },

  async uploadEvidence(bucket: string, path: string, file: File): Promise<{ url?: string; storagePath?: string; error?: string }> {
    const storagePath = `${bucket}/${path}`;
    const { error } = await fbUploadFile(storagePath, file);
    if (error) return { error: error.message };
    try {
      const url = await fbGetDownloadURL(storagePath);
      return { url, storagePath };
    } catch (e: any) {
      return { storagePath, error: e.message };
    }
  },

  async addFinding(inspectionId: string, draft: FindingDraft): Promise<{ error?: string }> {
    const inspection = await this.getById(inspectionId);
    if (!inspection) return { error: 'Inspection not found.' };
    const finding = buildFinding(draft);
    inspection.findings = [...(inspection.findings ?? []), finding];
    await this.update(inspectionId, { findings: inspection.findings });
    return {};
  },
};