// ──────────────────────────────────────────────────────────────────────
// Complaint Detail — v2 workflow hub
// Timeline (status history + events), evidence gallery, investigations,
// corrective actions, verifications, comments and role-gated workflow
// actions with a transition modal.
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, MapPin, Clock, AlertTriangle, Paperclip, BadgeCheck, FileSearch,
  ListChecks, User, CalendarDays, ShieldAlert, Send, Trash2,
  History, MessageCircle, Plus, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { fbSubscribe } from '../../lib/firebaseDb';
import { complaintsService } from '../../lib/complaints';
import {
  transitionComplaint,
  listStatusHistory,
  nextStatusOptions,
  listAttachments,
  attachEvidence,
  deleteAttachment,
  uploadEvidenceFile,
  listInvestigations,
  createInvestigation,
  listCorrectiveActions,
  addCorrectiveAction,
  updateCorrectiveAction,
  listVerifications,
  submitVerification,
  slaInfo,
  ComplaintSlaInfo,
  ComplaintActor,
  canAdminDeleteComplaints,
} from '../../lib/complaintModule';
import { OPEN_STATUSES, TERMINAL_STATUSES } from '../../lib/analytics';
import {
  Complaint,
  ComplaintAttachment,
  ComplaintEvent,
  ComplaintInvestigation,
  ComplaintStatus,
  ComplaintStatusHistory,
  ComplaintVerification,
  UserRole,
} from '../../lib/types';
import { Card, Button, Spinner, EmptyState, SeverityBadge, StatusBadge } from '../ui/primitives';
import { TextInput, TextArea, Select, Modal } from '../ui/inputs';

const OFFICER_ROLES: UserRole[] = ['safety_officer', 'mine_manager', 'super_admin', 'overman'];
const VERIFY_ROLES: UserRole[] = ['safety_officer', 'mine_manager', 'super_admin'];

export function canPerformTransition(role: UserRole | null | undefined, to: ComplaintStatus): boolean {
  if (!role) return false;
  switch (to) {
    case 'Acknowledged':
    case 'Escalated':
      return OFFICER_ROLES.includes(role);
    case 'Under Investigation':
    case 'Action In Progress':
    case 'Verification':
      return OFFICER_ROLES.includes(role) || role === 'mining_mate';
    case 'Resolved':
    case 'Closed':
    case 'Rejected':
      return VERIFY_ROLES.includes(role);
    default:
      return false;
  }
}

function fmtDateTime(s?: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  complaintId: string;
  onBack: () => void;
}

export const ComplaintDetailPage: React.FC<Props> = ({ complaintId, onBack }) => {
  const { profile, role } = useAuth();
  const actor: ComplaintActor = {
    id: profile?.id ?? null,
    name: profile?.full_name ?? 'User',
    role: (role as UserRole) ?? null,
    designation: profile?.designation ?? null,
  };

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<ComplaintEvent[]>([]);
  const [history, setHistory] = useState<ComplaintStatusHistory[]>([]);
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [investigations, setInvestigations] = useState<ComplaintInvestigation[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<ComplaintVerification[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<null | { to: ComplaintStatus }>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [caOpen, setCaOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [lightbox, setLightbox] = useState<ComplaintAttachment | null>(null);
  const [uploading, setUploading] = useState(false);

  const [inv, setInv] = useState({ findings: '', root_cause: '', contributing_factors: '', risk_assessment: '', immediate_action_taken: '', recommended_actions: '' });
  const [ca, setCa] = useState({ action_title: '', action_description: '', assigned_to_id: '', due_date: '' });
  const [assignedName, setAssignedName] = useState('');

  const load = useCallback(async () => {
    if (!complaintId) return;
    try {
      const [c, ev, h, at, iv, ac, vf] = await Promise.all([
        complaintsService.getById(complaintId),
        complaintsService.events(complaintId),
        listStatusHistory(complaintId),
        listAttachments(complaintId),
        listInvestigations(complaintId),
        listCorrectiveActions(complaintId),
        listVerifications(complaintId),
      ]);
      setComplaint(c);
      setEvents(ev);
      setHistory(h);
      setAttachments(at);
      setInvestigations(iv);
      setActions(ac);
      setVerifications(vf);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    setLoading(true);
    setNotice(null);
    load().catch(() => {});
    const timer = window.setInterval(() => load().catch(() => {}), 15000);
    let unsub: (() => void) | null = null;
    try {
      unsub = fbSubscribe('complaints', () => load().catch(() => {}), () => {});
    } catch { /* offline first */ }
    return () => {
      try { if (unsub) unsub(); } catch { /* noop */ }
      window.clearInterval(timer);
    };
  }, [complaintId, load]);

  const transitions = useMemo(() => {
    if (!complaint) return [] as Array<{ to: ComplaintStatus }>;
    return (nextStatusOptions(complaint.status) ?? [])
      .filter((t) => canPerformTransition(role as UserRole | null, t))
      .map((t) => ({ to: t }));
  }, [complaint, role]);

  const isAdmin = canAdminDeleteComplaints(role as UserRole | null);

  async function handleDeleteComplaint() {
    if (!complaint) return;
    const isSuper = role === 'super_admin';
    if (!window.confirm(isSuper
      ? `Permanently delete complaint ${complaint.complaint_number}?\n\nSuper Admin action — the record will be removed from Firestore (a DELETED audit event is kept for the trail).`
      : `Archive complaint ${complaint.complaint_number}?\n\nMine Manager action — it will be hidden from all lists. The record, event log and on-chain fingerprint are preserved.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await complaintsService.deleteByAdmin(complaint.id, actor);
      if (res.error) {
        setNotice({ kind: 'err', text: res.error });
      } else {
        setNotice({ kind: 'ok', text: res.kind === 'deleted' ? 'Complaint permanently deleted.' : 'Complaint archived.' });
        onBack();
      }
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function runTransition() {
    if (!complaint || !modal) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await transitionComplaint(complaint.id, modal.to, actor, note || null);
      if (!res.ok) {
        setNotice({ kind: 'err', text: res.error ?? 'Transition failed' });
      } else {
        setModal(null);
        setNote('');
        setNotice({ kind: 'ok', text: `Status updated to ${modal.to}.` });
      }
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
    await load();
  }

  async function handleComment() {
    if (!complaint || !comment.trim()) return;
    setBusy(true);
    try {
      await complaintsService.addComment(complaint.id, comment.trim(), { id: actor.id ?? undefined, name: actor.name, role: actor.role });
      setComment('');
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleEvidenceFiles(files: FileList | null) {
    if (!complaint || !files) return;
    setUploading(true);
    try {
      const uploaded: Array<{ kind: 'photo' | 'video'; file_name: string; file_type: string; file_size: number; storage_path: string; download_url?: string | null }> = [];
      for (const f of Array.from(files)) {
        const kind = f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name) ? 'video' : 'photo';
        const res = await uploadEvidenceFile(f, kind, { id: actor.id ?? null, name: actor.name });
        if (res.storagePath) {
          uploaded.push({ kind, file_name: f.name, file_type: f.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'), file_size: f.size, storage_path: res.storagePath, download_url: res.url ?? null });
        }
      }
      if (uploaded.length) {
        const res = await attachEvidence(complaint.id, uploaded, actor);
        if (!res.ok) setNotice({ kind: 'err', text: res.error ?? 'Evidence upload failed' });
        else setNotice({ kind: 'ok', text: `${res.count} evidence file(s) attached.` });
      }
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setUploading(false);
    }
    await load();
  }

  async function handleDeleteAttachment(a: ComplaintAttachment) {
    if (!window.confirm('Delete this evidence file?')) return;
    const res = await deleteAttachment(a, actor);
    if (!res.ok) setNotice({ kind: 'err', text: res.error ?? 'Delete failed' });
    await load();
  }

  async function handleCreateInvestigation() {
    if (!complaint || !inv.findings.trim()) {
      setNotice({ kind: 'err', text: 'Findings are required.' });
      return;
    }
    setBusy(true);
    try {
      const res = await createInvestigation({ complaint_id: complaint.id, ...inv, findings: inv.findings.trim(), root_cause: inv.root_cause || null, contributing_factors: inv.contributing_factors || null, risk_assessment: inv.risk_assessment || null, immediate_action_taken: inv.immediate_action_taken || null, recommended_actions: inv.recommended_actions || null }, actor);
      if (!res.ok) setNotice({ kind: 'err', text: res.error ?? 'Failed' });
      else { setInvOpen(false); setNotice({ kind: 'ok', text: 'Investigation recorded.' }); }
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
    await load();
  }

  async function handleCreateAction() {
    if (!complaint || !ca.action_title.trim()) {
      setNotice({ kind: 'err', text: 'Action title is required.' });
      return;
    }
    setBusy(true);
    try {
      const res = await addCorrectiveAction({ complaint_id: complaint.id, action_title: ca.action_title.trim(), action_description: ca.action_description.trim() || ca.action_title.trim(), assigned_to_id: ca.assigned_to_id || null, assigned_to_name: assignedName || null, due_date: ca.due_date || null }, actor);
      if (!res.ok) setNotice({ kind: 'err', text: res.error ?? 'Failed' });
      else { setCaOpen(false); setNotice({ kind: 'ok', text: 'Corrective action added.' }); }
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
    await load();
  }

  async function handleVerify(decision: 'Verified' | 'Rejected' | 'Rework Required') {
    if (!complaint) return;
    setBusy(true);
    try {
      const res = await submitVerification(complaint.id, { decision, comments: note || null }, actor);
      if (!res.ok) setNotice({ kind: 'err', text: res.error ?? 'Verification failed' });
      else { setVerifyOpen(false); setNote(''); setNotice({ kind: 'ok', text: decision === 'Verified' ? 'Complaint resolved.' : 'Marked ' + decision + '.' }); }
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
    await load();
  }

  async function handleActionProgress(acId: string, status: string, pct: number) {
    setBusy(true);
    try {
      await updateCorrectiveAction(acId, { status, completion_percentage: pct });
    } finally { setBusy(false); }
    await load();
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 flex flex-col items-center gap-3">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</Button>
        <Spinner size="lg" label="Loading complaint…" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</Button>
        <EmptyState icon={<AlertTriangle className="w-5 h-5" />} title="Complaint not found" subtitle="This complaint may have been deleted." />
      </div>
    );
  }

  const sla = slaInfo(complaint);
  const isOpen = OPEN_STATUSES.includes(complaint.status);
  const isTerminal = TERMINAL_STATUSES.includes(complaint.status);

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-2">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</Button>

      {/* ── Header ──────────────────────────────────────────────── */}
      <Card
        title={`${complaint.complaint_number} — ${complaint.title}`}
        subtitle={`${complaint.category}${complaint.subcategory ? ' / ' + complaint.subcategory : ''} · ${complaint.mine_name ?? 'Unknown mine'}`}
        actions={
          <div className="flex items-center gap-2">
            <SeverityBadge value={complaint.severity} />
            <StatusBadge value={complaint.status} />
          </div>
        }
      >
        <div className="grid md:grid-cols-3 gap-4 text-[11px] text-warm-slate">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1"><User className="w-3 h-3" /> Reported by <span className="text-white font-medium">{complaint.reported_by_name}</span> at {fmtDateTime(complaint.reported_at)}</div>
            {complaint.mine_name && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {complaint.mine_name}{complaint.location_name ? ` · ${complaint.location_name}` : ''}</div>}
            {complaint.latitude != null && <div>GPS: {complaint.latitude.toFixed(5)}, {complaint.longitude?.toFixed(5)}</div>}
          </div>
          <div className="space-y-1.5">
            <div>Priority: <span className="text-white font-medium">{complaint.priority_label ?? complaint.severity}</span></div>
            {complaint.department && <div>Department: <span className="text-white">{complaint.department}</span></div>}
            {complaint.work_area && <div>Work area: <span className="text-white">{complaint.work_area}</span></div>}
            {complaint.shift && <div>Shift: <span className="text-white">{complaint.shift}</span></div>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Due: <span className={`font-medium ${sla.overdue ? 'text-rose-400' : 'text-white'}`}>{complaint.due_date ? new Date(complaint.due_date).toLocaleDateString('en-GB') : '—'}</span>
              {sla.overdue && <span className="text-rose-400 font-semibold ml-1">Overdue {sla.overDays}d</span>}
              {!sla.overdue && sla.daysLeft != null && <span className="text-warm-slate ml-1">{sla.daysLeft}d left</span>}
            </div>
            {complaint.immediate_danger && <div className="text-rose-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Immediate danger</div>}
            {complaint.assigned_to_name && <div>Assigned to: <span className="text-white">{complaint.assigned_to_name}</span></div>}
          </div>
        </div>
        {complaint.description && <div className="mt-3 text-[11px] text-warm-slate leading-relaxed whitespace-pre-wrap">{complaint.description}</div>}
      </Card>

      {/* ── Workflow action bar ────────────────────────────────── */}
      {(transitions.length > 0 || isOpen) && (
        <Card title="Workflow actions" icon={<ListChecks className="w-4 h-4" />}>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button
                key={t.to}
                variant={t.to === 'Rejected' || t.to === 'Escalated' ? 'danger' : 'primary'}
                onClick={() => {
                  if (t.to === 'Under Investigation') { setInvOpen(true); return; }
                  if (t.to === 'Action Assigned') { setCaOpen(true); return; }
                  if (['Verification', 'Resolved', 'Closed'].includes(t.to)) { setVerifyOpen(true); return; }
                  setModal({ to: t.to });
                }}
              >
                {t.to === 'Acknowledged' ? 'Acknowledge' : t.to === 'Escalated' ? 'Escalate' : t.to === 'Rejected' ? 'Reject' : t.to === 'Under Investigation' ? 'Start Investigation' : t.to === 'Action Assigned' ? 'Add Corrective Action' : t.to === 'Action In Progress' ? 'Start Work' : t.to === 'Verification' ? 'Request Verification' : t.to === 'Resolved' ? 'Resolve' : t.to === 'Closed' ? 'Close' : t.to}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card title="Admin actions" icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="danger" loading={busy} onClick={handleDeleteComplaint}>
              <Trash2 className="w-3.5 h-3.5" /> Delete Complaint
            </Button>
            <p className="text-[10px] text-warm-slate">
              Super Admin = permanent deletion · Mine Manager = archive (record and audit trail preserved).
            </p>
          </div>
        </Card>
      )}

      {notice && (
        <div className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
          {notice.kind === 'ok' ? <BadgeCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {notice.text}
        </div>
      )}

      {/* ── Evidence ─────────────────────────────────────────────── */}
      <Card title={`Evidence (${attachments.length})`} icon={<Paperclip className="w-4 h-4" />}>
        {attachments.length === 0 ? (
          <EmptyState icon={<Paperclip className="w-5 h-5" />} title="No evidence yet" subtitle="Attach photos or videos of the incident." />
        ) : (
          <div className="flex flex-wrap gap-3">
            {attachments.map((a) => (
              <div key={a.id} className="w-40">
                {a.download_url ? (
                  a.kind === 'photo' ? (
                    <img src={a.download_url} alt={a.file_name} className="w-full h-24 object-cover rounded-lg border border-carbon-700 cursor-pointer" onClick={() => setLightbox(a)} />
                  ) : (
                    <video src={a.download_url} className="w-full h-24 object-cover rounded-lg border border-carbon-700" controls />
                  )
                ) : (
                  <div className="w-full h-24 rounded-lg border border-carbon-700 bg-carbon-800 flex items-center justify-center text-[10px] text-warm-slate">{a.file_name}</div>
                )}
                <Button variant="ghost" onClick={() => handleDeleteAttachment(a)}><Trash2 className="w-3.5 h-3.5 text-rose-400" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <label htmlFor="evidence-upload" className="text-[11px] text-copper-light underline cursor-pointer">
            {uploading ? 'Uploading…' : '+ Add evidence'}
          </label>
          <input id="evidence-upload" type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => handleEvidenceFiles(e.target.files)} />
        </div>
      </Card>

      {/* ── Investigations + Corrective Actions ─────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`Investigations (${investigations.length})`} icon={<FileSearch className="w-4 h-4" />} actions={<Button variant="ghost" onClick={() => setInvOpen(true)}><Plus className="w-3 h-3" /></Button>}>
          {investigations.length === 0 ? (
            <EmptyState icon={<FileSearch className="w-5 h-5" />} title="No investigation yet" />
          ) : investigations.map((iv) => (
            <div key={iv.id} className="rounded-lg border border-carbon-700 bg-carbon-850/60 p-3 mb-2">
              <div className="text-[10px] text-warm-slate"><User className="w-3 h-3 inline" /> {iv.investigator_name} · {fmtDateTime(iv.investigation_date)}</div>
              <div className="mt-1 text-[11px] text-white whitespace-pre-wrap">{iv.findings}</div>
              {iv.root_cause && <div className="mt-1 text-[10px] text-warm-sand">Root cause: {iv.root_cause}</div>}
            </div>
          ))}
        </Card>

        <Card title={`Corrective Actions (${actions.length})`} icon={<ListChecks className="w-4 h-4" />} actions={<Button variant="ghost" onClick={() => setCaOpen(true)}><Plus className="w-3 h-3" /></Button>}>
          {actions.length === 0 ? (
            <EmptyState icon={<ListChecks className="w-5 h-5" />} title="No corrective actions yet" />
          ) : actions.map((a) => (
            <div key={a.id} className="rounded-lg border border-carbon-700 bg-carbon-850/60 p-3 mb-2">
              <div className="text-[11px] font-semibold text-white">{a.title}</div>
              <div className="text-[10px] text-warm-slate">{a.status} · {a.assigned_to_name ?? 'Unassigned'} · Due {fmtDateTime(a.due_date)}</div>
              {a.completion_percentage != null && (
                <div className="mt-2 h-1.5 rounded bg-carbon-800 overflow-hidden">
                  <div className="h-full bg-copper" style={{ width: `${a.completion_percentage}%` }} />
                </div>
              )}
              <div className="mt-1 flex gap-2">
                <Button variant="ghost" onClick={() => handleActionProgress(a.id, 'In Progress', Math.min(100, (a.completion_percentage ?? 0) + 25))}>+25%</Button>
                <Button variant="ghost" onClick={() => handleActionProgress(a.id, 'Done', 100)}>Complete</Button>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <Card title="Timeline" icon={<History className="w-4 h-4" />} subtitle={`${history.length} status change(s) · ${events.length} event(s)`}>
        <div className="space-y-1.5">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-[11px] flex-wrap">
              <span className="text-warm-slate w-28 shrink-0">{fmtDateTime(h.created_at)}</span>
              <span className="text-white font-medium">{h.actor_name}</span>
              <span className="text-warm-slate">→</span>
              <StatusBadge value={h.to_status} />
              {h.note && <span className="text-warm-slate italic">— {h.note}</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Comments ─────────────────────────────────────────────── */}
      <Card title="Comments" icon={<MessageCircle className="w-4 h-4" />}>
        <div className="space-y-1.5 mb-3">
          {(events ?? []).filter((e) => (e.comment || '').trim()).slice(-20).map((e) => (
            <div key={e.id} className="text-[11px]">
              <span className="text-white font-medium">{e.actor_name}</span>
              <span className="text-warm-slate"> — {e.comment}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="flex-1" />
          <Button onClick={handleComment} loading={busy}><Send className="w-3.5 h-3.5" /></Button>
        </div>
      </Card>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal ? `Move to ${modal.to}` : ''}>
        <div className="space-y-3">
          <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for this status change (optional)" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={busy} onClick={runTransition}>Confirm</Button>
          </div>
        </div>
      </Modal>

      <Modal open={invOpen} onClose={() => setInvOpen(false)} title="Record Investigation">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Findings *</label>
            <TextArea rows={4} value={inv.findings} onChange={(e) => setInv({ ...inv, findings: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Root cause</label>
            <TextArea rows={2} value={inv.root_cause} onChange={(e) => setInv({ ...inv, root_cause: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Recommended actions</label>
            <TextArea rows={2} value={inv.recommended_actions} onChange={(e) => setInv({ ...inv, recommended_actions: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInvOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={handleCreateInvestigation}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={caOpen} onClose={() => setCaOpen(false)} title="Add Corrective Action">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Title *</label>
            <TextInput value={ca.action_title} onChange={(e) => setCa({ ...ca, action_title: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Description</label>
            <TextArea rows={3} value={ca.action_description} onChange={(e) => setCa({ ...ca, action_description: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-warm-slate mb-1">Due date</label>
            <TextInput type="date" value={ca.due_date} onChange={(e) => setCa({ ...ca, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCaOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={handleCreateAction}>Add</Button>
          </div>
        </div>
      </Modal>

      <Modal open={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verification">
        <div className="space-y-3">
          <p className="text-[11px] text-warm-slate">Confirm the corrective actions have resolved this complaint, or send it back for rework.</p>
          <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Verification comments (optional)" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => handleVerify('Rework Required')}>Rework</Button>
            <Button variant="success" loading={busy} onClick={() => handleVerify('Verified')}>Verify & Resolve</Button>
          </div>
        </div>
      </Modal>

      {lightbox && (
        <Modal open onClose={() => setLightbox(null)} title="Evidence">
          {lightbox.download_url && <img src={lightbox.download_url} alt={lightbox.file_name} className="w-full rounded-lg" />}
          <p className="mt-2 text-[11px] text-warm-slate">{lightbox.file_name}</p>
        </Modal>
      )}
    </div>
  );
};