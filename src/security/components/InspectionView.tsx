// ────────────────────────────────────────────────────────────────
// Inspection View — list inspections, create new inspections with
// findings & corrective actions, upload evidence, verify, and walk
// corrective-action workflows. Uses inspectionsService.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Shield, Plus, HardHat, Camera, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { inspectionsService, fetchMines } from '../lib/inspections';
import { complaintsService } from '../lib/complaints';
import { Inspection, Finding, CorrectiveAction, EvidenceItem, Complaint, Mine, Severity, SEVERITIES } from '../lib/types';
import { timeAgo } from '../lib/analytics';
import { Card, Spinner, EmptyState, SeverityBadge, StatusBadge, Button } from './ui/primitives';
import { TextInput, TextArea, Select, Modal } from './ui/inputs';

const canCreateInspection = (role: string | null) =>
  ['mining_mate', 'overman', 'safety_officer', 'mine_manager', 'super_admin'].includes(role ?? '');

const findingBadgeColor = (f: Finding) => {
  if (f.risk_level === 'Critical') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  if (f.risk_level === 'High') return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  if (f.risk_level === 'Moderate') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
};

export const InspectionView: React.FC<{ onSelectComplaint?: (id: string) => void }> = ({ onSelectComplaint }) => {
  const { profile, role } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const list = await inspectionsService.list({ mineId: profile.mine_id ?? undefined });
    setInspections(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const filtered = filter ? inspections.filter((i) => i.status === filter) : inspections;

  const canVerify = ['safety_officer', 'mine_manager', 'super_admin'].includes(role ?? '');

  const handleVerify = async () => {
    if (!selected) return;
    await inspectionsService.verify(selected.id, { id: profile!.id, name: profile!.full_name });
    const updated = await inspectionsService.getById(selected.id);
    setSelected(updated);
    await load();
  };

  const handleTransition = async (ca: CorrectiveAction, newStatus: CorrectiveAction['status']) => {
    if (!selected) return;
    await inspectionsService.transitionCorrectiveAction(selected.id, ca.id, newStatus, {
      id: profile!.id,
      name: profile!.full_name,
      role: role ?? null,
    });
    const updated = await inspectionsService.getById(selected.id);
    setSelected(updated);
    await load();
  };

  if (loading) return <Spinner size="lg" label="Loading inspections..." />;

  const statuses = ['Submitted', 'Verified'];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale flex items-center gap-2">
            <HardHat className="w-5 h-5 text-copper-light" /> Mine Inspections
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            {inspections.filter((i) => i.status === 'Submitted').length} pending verification · {inspections.length} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-carbon-800 rounded-lg p-1 border border-carbon-700">
            <button
              onClick={() => setFilter('')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase transition-colors ${filter === '' ? 'bg-copper/20 text-copper-light' : 'text-warm-slate hover:text-warm-pale'}`}
            >
              All
            </button>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase transition-colors ${filter === s ? 'bg-copper/20 text-copper-light' : 'text-warm-slate hover:text-warm-pale'}`}
              >
                {s}
              </button>
            ))}
          </div>
          {canCreateInspection(role) && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> New Inspection
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-8 h-8 text-warm-slate/40" />}
          title="No inspections"
          subtitle="Conduct the first inspection to start logging findings."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => {
            const criticalCount = (i.findings ?? []).filter((f) => f.risk_level === 'Critical').length;
            const openCount = (i.corrective_actions ?? []).filter((c) => c.status !== 'Closed').length;
            return (
              <Card key={i.id} padded={false} className="transition-all hover:border-copper/40 cursor-pointer" >
                <button className="w-full text-left p-4" onClick={() => setSelected(i)}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-copper-light font-bold">{i.inspection_number}</span>
                      <span className="text-xs font-bold text-warm-pale">{i.inspection_type}</span>
                      <StatusBadge value={i.status} />
                      {criticalCount > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                          {criticalCount} critical finding{criticalCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-warm-slate/50" />
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-warm-slate/70 flex-wrap">
                    <span>{i.mine_name ?? '—'}</span>
                    <span>{new Date(i.inspection_date).toLocaleDateString()}</span>
                    <span>by {i.inspector_name}</span>
                    <span>{i.shift ? `· ${i.shift}` : ''}</span>
                    <span className="text-warm-sand">{(i.findings ?? []).length} findings</span>
                    <span className={openCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {openCount} corrective action{openCount === 1 ? '' : 's'} open
                    </span>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Mine Inspection" wide>
        <CreateInspectionForm
          profile={{ id: profile!.id, name: profile!.full_name, role: role ?? null, mineId: profile?.mine_id ?? null }}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      </Modal>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Inspection ${selected.inspection_number ?? ''}`} wide>
          <InspectionDetail
            inspection={selected}
            canVerify={canVerify}
            onVerify={handleVerify}
            onTransition={handleTransition}
            onSelectComplaint={onSelectComplaint}
          />
        </Modal>
      )}
    </div>
  );
};
// ── Inspection detail ──
export const InspectionDetail: React.FC<{
  inspection: Inspection;
  canVerify: boolean;
  onVerify: () => void;
  onTransition: (ca: CorrectiveAction, s: CorrectiveAction['status']) => void;
  onSelectComplaint?: (id: string) => void;
}> = ({ inspection, canVerify, onVerify, onTransition, onSelectComplaint }) => {
  const findings = inspection.findings ?? [];
  const actions = inspection.corrective_actions ?? [];
  const evidence = inspection.evidence ?? [];
  const critical = findings.filter((f) => f.risk_level === 'Critical' || f.immediate_danger);

  const nextTransitions: Record<string, CorrectiveAction['status'][]> = {
    Pending: ['Assigned', 'In Progress'],
    Assigned: ['In Progress'],
    'In Progress': ['Completed'],
    Completed: ['Verified', 'Rejected'],
    Verified: ['Closed'],
    Rejected: ['In Progress'],
    'Requires Rework': ['In Progress'],
    Closed: [],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-warm-slate">
            {inspection.inspection_type} · {new Date(inspection.inspection_date).toLocaleDateString()} ·{' '}
            {inspection.inspection_number}
          </p>
          <p className="text-xs font-mono text-warm-slate mt-0.5">
            Inspector {inspection.inspector_name} · {inspection.mine_name ?? '—'}
            {inspection.shift ? ` · ${inspection.shift}` : ''}
          </p>
          {inspection.submission_notes && (
            <p className="text-[11px] text-warm-sand mt-1">{inspection.submission_notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {inspection.complaint_id && onSelectComplaint && (
            <Button variant="secondary" onClick={() => onSelectComplaint(inspection.complaint_id!)}>
              <FileText className="w-3.5 h-3.5" /> Related Complaint
            </Button>
          )}
          {inspection.status === 'Submitted' && canVerify && (
            <Button variant="success" onClick={onVerify}>Verify</Button>
          )}
        </div>
      </div>

      {critical.length > 0 && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0" />
          {critical.length} critical finding{critical.length === 1 ? '' : 's'} recorded — immediate action required.
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-warm-pale mb-2 uppercase tracking-wide">Findings ({findings.length})</h3>
        {findings.length === 0 ? (
          <p className="text-xs text-warm-slate">None recorded.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={f.id} className="p-3 rounded-lg bg-carbon-850/70 border border-carbon-700/50 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${findingBadgeColor(f)}`}>
                    {f.risk_score} · {f.risk_level}
                  </span>
                  <span className="text-xs font-bold text-warm-pale">{f.category}</span>
                  <span className="text-[10px] text-warm-slate font-mono">{f.fault_type}</span>
                  <SeverityBadge value={f.severity} />
                </div>
                <p className="text-[11px] text-warm-slate leading-relaxed">{f.description}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-warm-slate/60 flex-wrap">
                  {f.legal_reference && <span>Ref: {f.legal_reference}</span>}
                  {f.workers_affected != null && <span>{f.workers_affected} worker(s) at risk</span>}
                  <span className="text-warm-sand">Status: {f.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
<div>
        <h3 className="text-xs font-bold text-warm-pale mb-2 uppercase tracking-wide">Corrective Actions ({actions.length})</h3>
        {actions.length === 0 ? (
          <p className="text-xs text-warm-slate">None required.</p>
        ) : (
          <div className="space-y-2">
            {actions.map((ca) => (
              <div key={ca.id} className="p-3 rounded-lg bg-carbon-850/70 border border-carbon-700/50">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-warm-pale">{ca.action_description}</p>
                    <div className="text-[10px] font-mono text-warm-slate/60 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded border ${ca.status === 'Closed' || ca.status === 'Verified' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : ca.status === 'Completed' ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-carbon-600 text-warm-slate bg-carbon-800'}`}>
                        {ca.status}
                      </span>
                      {ca.priority && <span>Priority {ca.priority}</span>}
                      {ca.responsible_department && <span>{ca.responsible_department}</span>}
                      {ca.deadline && <span>Due {new Date(ca.deadline).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {(nextTransitions[ca.status] ?? []).length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {nextTransitions[ca.status].map((s) => (
                        <button
                          key={s}
                          onClick={() => onTransition(ca, s)}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase border transition-colors ${
                            s === 'Closed' || s === 'Verified' ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                            : s === 'Rejected' ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                            : 'border-copper/40 text-copper-light hover:bg-copper/10'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold text-warm-pale mb-2 uppercase tracking-wide">Evidence ({evidence.length})</h3>
        {evidence.length === 0 ? (
          <p className="text-xs text-warm-slate">No evidence attached.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {evidence.map((e) => (
              <div key={e.id} className="p-2 rounded-lg bg-carbon-850/70 border border-carbon-700/50">
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-copper-light shrink-0" />
                  <span className="text-[10px] font-mono text-warm-slate uppercase">{e.kind}</span>
                </div>
                {e.download_url ? (
                  <a
                    href={e.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-copper-light hover:underline mt-1 block truncate"
                  >
                    {e.description ?? 'Open file'}
                  </a>
                ) : (
                  <p className="text-[11px] text-warm-slate mt-1 truncate">{e.description ?? e.storage_path}</p>
                )}
                <p className="text-[9px] font-mono text-warm-slate/50 mt-1">
                  {e.uploaded_by_name} · {timeAgo(e.uploaded_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {inspection.verified_by_name && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          Verified by {inspection.verified_by_name} at {new Date(inspection.verified_at ?? '').toLocaleString()}
        </div>
      )}
    </div>
  );
};
// ── New inspection form (findings + corrective actions + evidence) ──
const INSPECTION_TYPES = ['Routine', 'Complaint-Follow Up', 'Pre-Shift', 'Electrical', 'Structural', 'Ventilation', 'Fire / Explosion', 'Emergency', 'Other'];
const FINDING_CATEGORIES = ['Ventilation', 'Gas / Methane', 'Roof / Strata', 'Electrical', 'Machinery', 'Fire / Explosion', 'Haulage / Transport', 'Housekeeping', 'PPE', 'Ergonomics', 'Other'];
const FAULT_TYPES = ['Deficiency', 'Non-conformance', 'Hazardous condition', 'Unsafe practice'];
const EXTENTS = [
  { value: '1', label: 'Minor' },
  { value: '2', label: 'Moderate' },
  { value: '3', label: 'Major' },
  { value: '4', label: 'Extreme' },
];
const CA_PRIORITIES = ['P1 - Urgent', 'P2 - High', 'P3 - Normal', 'P4 - Low'];

const CreateInspectionForm: React.FC<{
  profile: { id: string; name: string; role: string | null; mineId: string | null };
  onCreated: () => void;
}> = ({ profile, onCreated }) => {
  const [mines, setMines] = useState<Mine[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [mineId, setMineId] = useState(profile.mineId ?? '');
  const [complaintId, setComplaintId] = useState('');
  const [type, setType] = useState(INSPECTION_TYPES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState('Morning');
  const [notes, setNotes] = useState('');
  const [selectedMine, setSelectedMine] = useState<any>(null);

  const [findings, setFindings] = useState<Array<{
    category: string; fault_type: string; description: string; severity: Severity;
    immediate_danger: boolean; workers_affected: string; exposure: string; legal_reference: string;
  }>>([]);
  const [cas, setCas] = useState<Array<{
    action_description: string; responsible_department: string; priority: string; deadline: string;
  }>>([]);
  const [evidence, setEvidence] = useState<Array<{ file: File; kind: 'photo' | 'video' | 'document'; url?: string; storagePath?: string; uploading?: boolean }>>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await fetchMines();
      setMines(m.filter((mm: any) => !mineId || mm.id === mineId || profile.role !== 'safety_officer'));
      // When a mine was preset on the user's profile, resolve it so
      // mine_name / mine_code / mine_type are captured without the user
      // having to re-select it manually.
      if (mineId) {
        const preset = m.find((mm: any) => mm.id === mineId) ?? null;
        setSelectedMine((cur: any) => cur ?? preset);
      }
      const list = await complaintsService.list({ mineId: mineId || undefined });
      setComplaints(list.filter((c) => !['Resolved', 'Verified', 'Rejected'].includes(c.status)));
    })();
  }, [mineId]);

  // ---- findings rows ----
  const addFinding = () => setFindings((f) => [...f, {
    category: FINDING_CATEGORIES[0], fault_type: FAULT_TYPES[0], description: '',
    severity: 'High' as Severity, immediate_danger: false, workers_affected: '', exposure: '2',
    legal_reference: '',
  }]);
  const updFinding = (i: number, patch: Partial<any>) =>
    setFindings((f) => f.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeFinding = (i: number) => setFindings((f) => f.filter((_, idx) => idx !== i));

  // ---- corrective action rows ----
  const addCa = () => setCas((c) => [...c, {
    action_description: '', responsible_department: '', priority: CA_PRIORITIES[1], deadline: '',
  }]);
  const updCa = (i: number, patch: Partial<any>) =>
    setCas((c) => c.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeCa = (i: number) => setCas((c) => c.filter((_, idx) => idx !== i));

  // ---- evidence ----
  const addEvidenceFile = (kind: 'photo' | 'video' | 'document') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setEvidence((ev) => [...ev, ...files.map((file) => ({ file, kind }))]);
    e.target.value = '';
  };

const handleSubmit = async () => {
    setErr(null); setMsg(null);
    if (findings.length === 0) { setErr('Add at least one finding.'); return; }
    if (!findings.every((f) => f.description.trim())) { setErr('Every finding needs a description.'); return; }
    if (!selectedMine && !mineId) { setErr('Select the mine / colliery.'); return; }
    setSaving(true);

    // Upload evidence files sequentially
    const uploaded: Array<{ kind: 'photo' | 'video' | 'document'; storage_path: string; download_url: string | null; description: string | null; uploaded_by_name: string }> = [];
    for (const ev of evidence) {
      const safe = ev.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${profile.id}/inspection-${Date.now()}-${safe}`;
      const res = await inspectionsService.uploadEvidence('inspection-evidence', storagePath, ev.file);
      if (res.error) { setErr(`Upload failed for ${ev.file.name}: ${res.error}`); setSaving(false); return; }
      uploaded.push({
        kind: ev.kind,
        storage_path: res.storagePath ?? storagePath,
        download_url: res.url ?? null,
        description: ev.file.name,
        uploaded_by_name: profile.name,
      });
    }

    const res = await inspectionsService.create({
      complaint_id: complaintId || null,
      mine_id: mineId || selectedMine?.id || null,
      mine_name: selectedMine?.mine_name ?? null,
      mine_code: selectedMine?.mine_code ?? null,
      mine_type: selectedMine?.mine_type ?? null,
      inspection_type: type,
      inspection_date: date,
      shift: shift || null,
      location: null,
      submission_notes: notes.trim() || null,
      follow_up_of: null,
      inspector_id: profile.id,
      inspector_name: profile.name,
      inspector_role: profile.role,
      findings: findings.map((f) => ({
        category: f.category,
        fault_type: f.fault_type,
        description: f.description.trim(),
        severity: f.severity,
        immediate_danger: f.immediate_danger,
        workers_affected: f.workers_affected.trim() ? parseInt(f.workers_affected, 10) : null,
        exposure: parseInt(f.exposure, 10),
        legal_reference: f.legal_reference.trim() || null,
        inspector_remarks: null,
      })),
      evidence: uploaded,
      corrective_actions: cas.map((c) => ({
        finding_id: null,
        responsible_department: c.responsible_department.trim() || null,
        responsible_employee: null,
        action_description: c.action_description.trim(),
        priority: c.priority,
        deadline: c.deadline || null,
      })),
    });

    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    setMsg(`Inspection ${res.inspection?.inspection_number} submitted.`);
    setTimeout(onCreated, 1200);
  };

  return (
    <div className="space-y-4">
      {err && <p className="text-xs text-rose-400 font-mono">{err}</p>}
      {msg && <p className="text-xs text-emerald-300 font-mono">{msg}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-warm-slate mb-1.5">Mine / Colliery</label>
          <Select
            value={mineId}
            onChange={(e) => { setMineId(e.target.value); setSelectedMine(mines.find((m) => m.id === e.target.value) ?? null); }}
            options={mines.map((m) => ({ value: m.id, label: `${m.mine_name} (${m.mine_code || m.id})` }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-slate mb-1.5">Inspection Type</label>
          <Select value={type} onChange={(e) => setType(e.target.value)} options={INSPECTION_TYPES.map((t) => ({ value: t, label: t }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-slate mb-1.5">Date</label>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-slate mb-1.5">Shift</label>
          <Select value={shift} onChange={(e) => setShift(e.target.value)} options={['Morning', 'Afternoon', 'Night', 'General'].map((s) => ({ value: s, label: s }))} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Link to complaint (optional)</label>
        <Select
          value={complaintId}
          onChange={(e) => setComplaintId(e.target.value)}
          options={[
            { value: '', label: '— None —' },
            ...complaints.map((c) => ({ value: c.id, label: `${c.complaint_number} · ${c.title}` })),
          ]}
        />
      </div>

      <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Submission notes / summary" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-warm-pale uppercase tracking-wide">Findings ({findings.length})</h3>
          <Button variant="ghost" onClick={addFinding} className="text-[11px] py-1">+ Add Finding</Button>
        </div>
        {findings.length === 0 && <p className="text-xs text-warm-slate mb-2">No findings yet.</p>}
        <div className="space-y-3">
          {findings.map((f, i) => (
            <div key={i} className={`p-3 rounded-lg border ${f.immediate_danger ? 'bg-rose-500/5 border-rose-500/40' : 'bg-carbon-850/60 border-carbon-700/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-warm-slate/60">Finding #{i + 1}</span>
                <button onClick={() => removeFinding(i)} className="text-[10px] text-rose-400 hover:text-rose-300">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Category</label>
                  <Select value={f.category} onChange={(e) => updFinding(i, { category: e.target.value })} options={FINDING_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                </div>
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Type</label>
                  <Select value={f.fault_type} onChange={(e) => updFinding(i, { fault_type: e.target.value })} options={FAULT_TYPES.map((t) => ({ value: t, label: t }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-warm-slate mb-1">Description *</label>
                  <TextInput value={f.description} onChange={(e) => updFinding(i, { description: e.target.value })} placeholder="What did you observe?" />
                </div>
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Severity</label>
                  <Select value={f.severity} onChange={(e) => updFinding(i, { severity: e.target.value as Severity })} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
                </div>
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Extent (exposure)</label>
                  <Select value={f.exposure} onChange={(e) => updFinding(i, { exposure: e.target.value })} options={EXTENTS} />
                </div>
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Workers affected</label>
                  <TextInput value={f.workers_affected} onChange={(e) => updFinding(i, { workers_affected: e.target.value })} placeholder="e.g. 5" inputMode="numeric" />
                </div>
                <div>
                  <label className="block text-[10px] text-warm-slate mb-1">Legal ref</label>
                  <TextInput value={f.legal_reference} onChange={(e) => updFinding(i, { legal_reference: e.target.value })} placeholder="e.g. CMR 16(1)" />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-[11px] text-warm-sand cursor-pointer">
                  <input type="checkbox" className="accent-rose-500" checked={f.immediate_danger} onChange={(e) => updFinding(i, { immediate_danger: e.target.checked })} />
                  Immediate danger — evacuate / stop work
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-warm-pale uppercase tracking-wide">Corrective Actions ({cas.length})</h3>
          <Button variant="ghost" onClick={addCa} className="text-[11px] py-1">+ Add Action</Button>
        </div>
        {cas.map((c, i) => (
          <div key={i} className="p-3 rounded-lg bg-carbon-850/60 border border-carbon-700/40 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-warm-slate/60">Action #{i + 1}</span>
              <button onClick={() => removeCa(i)} className="text-[10px] text-rose-400 hover:text-rose-300">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] text-warm-slate mb-1">Description *</label>
                <TextInput value={c.action_description} onChange={(e) => updCa(i, { action_description: e.target.value })} placeholder="What must be done to fix this?" />
              </div>
              <div>
                <label className="block text-[10px] text-warm-slate mb-1">Responsible department</label>
                <TextInput value={c.responsible_department} onChange={(e) => updCa(i, { responsible_department: e.target.value })} placeholder="e.g. Ventilation Dept" />
              </div>
              <div>
                <label className="block text-[10px] text-warm-slate mb-1">Priority</label>
                <Select value={c.priority} onChange={(e) => updCa(i, { priority: e.target.value })} options={CA_PRIORITIES.map((p) => ({ value: p, label: p }))} />
              </div>
              <div>
                <label className="block text-[10px] text-warm-slate mb-1">Deadline</label>
                <TextInput type="date" value={c.deadline} onChange={(e) => updCa(i, { deadline: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-bold text-warm-pale mb-2 uppercase tracking-wide">Evidence ({evidence.length})</h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg border border-carbon-600 bg-carbon-850 text-[11px] text-warm-sand cursor-pointer hover:border-copper/50">
            + Photo
            <input type="file" accept="image/*" multiple className="hidden" onChange={addEvidenceFile('photo')} />
          </label>
          <label className="px-3 py-1.5 rounded-lg border border-carbon-600 bg-carbon-850 text-[11px] text-warm-sand cursor-pointer hover:border-copper/50">
            + Video
            <input type="file" accept="video/*" multiple className="hidden" onChange={addEvidenceFile('video')} />
          </label>
          <label className="px-3 py-1.5 rounded-lg border border-carbon-600 bg-carbon-850 text-[11px] text-warm-sand cursor-pointer hover:border-copper/50">
            + Document
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" multiple className="hidden" onChange={addEvidenceFile('document')} />
          </label>
          {evidence.map((e, i) => (
            <span key={i} className="text-[10px] font-mono text-warm-slate bg-carbon-850 border border-carbon-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <Camera className="w-3 h-3 text-copper-light" /> {e.kind} · {e.file.name.slice(0, 20)}
              <button onClick={() => setEvidence((ev) => ev.filter((_, idx) => idx !== i))} className="text-rose-400 ml-1">×</button>
            </span>
          ))}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? 'Submitting...' : 'Submit Inspection'}
      </Button>
    </div>
  );
};