// ────────────────────────────────────────────────────────────────
// Complaint Detail — full timeline, chain of custody, comments, actions
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, MapPin, User, Send, Play, CheckCircle, XCircle, AlertTriangle, Shield,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { inspectionsService } from '../lib/inspections';
import { fbSubscribe, fbSubscribeDoc } from '../lib/firebaseDb';
import { where } from 'firebase/firestore';
import { timeAgo, formatDate } from '../lib/analytics';
import { Complaint, ComplaintEvent, ComplaintComment, UserRole, Inspection, CorrectiveAction } from '../lib/types';
import { Card, Spinner, EmptyState, SeverityBadge, StatusBadge, Button } from './ui/primitives';
import { TextArea, Modal } from './ui/inputs';
import { InspectionDetail } from './InspectionView';

interface Props {
  complaintId: string;
  onBack: () => void;
}

export const ComplaintDetail: React.FC<Props> = ({ complaintId, onBack }) => {
  const { profile, role } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<ComplaintEvent[]>([]);
  const [comments, setComments] = useState<ComplaintComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Modal state for actions that require text input
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalText, setModalText] = useState('');
  // Real inspection modal (opens the actual InspectionDetail component)
  const [inspectModal, setInspectModal] = useState(false);
  const [inspLoading, setInspLoading] = useState(false);
  const [linkedInspections, setLinkedInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

  useEffect(() => {
    load();
  }, [complaintId]);

  // Real-time: reload whenever this complaint or its events change
  useEffect(() => {
    if (!complaintId) return;
    const unsub1 = fbSubscribeDoc('complaints', complaintId, () => load(), (err) => console.error(err));
    const unsub2 = fbSubscribe('complaint_events', () => load(), (err) => console.error(err),
      where('complaint_id', '==', complaintId)
    );
    return () => { unsub1(); unsub2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  const load = async () => {
    setLoading(true);
    const [c, ev, co] = await Promise.all([
      complaintsService.getById(complaintId),
      complaintsService.events(complaintId),
      complaintsService.comments(complaintId),
    ]);
    setComplaint(c);
    setEvents(ev);
    setComments(co);
    setLoading(false);
  };

  const actorOf = () => (profile ? { id: profile.id, name: profile.full_name, role: profile.role as UserRole, designation: profile.designation } : undefined);

  const addComment = async () => {
    if (!commentText.trim() || !profile) return;
    setSubmitting(true);
    await complaintsService.addComment(complaintId, commentText.trim(), { id: profile.id, name: profile.full_name, role: profile.role as UserRole });
    setCommentText('');
    await load();
    setSubmitting(false);
  };

  const handleAction = async (action: string, data?: Record<string, any>) => {
    if (!profile) return;
    const actor = actorOf();
    if (!actor) return;
    setActionLoading(action);
    try {
      if (action === 'start') {
        await complaintsService.updateStatus(complaintId, 'Action In Progress', actor, data?.note ?? '');
      } else if (action === 'resolve') {
        await complaintsService.updateStatus(complaintId, 'Resolved', actor, data?.notes ?? '');
      } else if (action === 'verify') {
        await complaintsService.verify(complaintId, actor, data?.notes ?? '');
      } else if (action === 'reject') {
        await complaintsService.reject(complaintId, actor, data?.reason ?? '');
      } else if (action === 'escalate') {
        await complaintsService.escalate(complaintId, actor, data?.reason ?? '');
      }
      await load();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  /** Actions that require user text input open the modal first */
  const actionsRequiringInput = ['resolve', 'reject', 'escalate'];
  const openModal = (action: string) => {
    setModalAction(action);
    setModalText('');
  };
  const submitModal = () => {
    if (!modalAction) return;
    const payload: Record<string, any> =
      modalAction === 'resolve' ? { notes: modalText } :
      modalAction === 'reject' ? { reason: modalText } :
      modalAction === 'escalate' ? { reason: modalText } : {};
    handleAction(modalAction, payload);
    setModalAction(null);
    setModalText('');
  };

  // ── Linked inspections modal (real InspectionDetail) ──
  const openInspections = async () => {
    setInspectModal(true);
    setInspLoading(true);
    const list = await complaintsService.inspections(complaintId);
    setLinkedInspections(list);
    setInspLoading(false);
  };

  const closeInspections = () => {
    setInspectModal(false);
    setSelectedInspection(null);
    load();
  };

  const canVerifyInspection = ['safety_officer', 'mine_manager', 'super_admin'].includes(profile?.role ?? '');

  const handleVerifyInspection = async () => {
    if (!selectedInspection || !profile) return;
    await inspectionsService.verify(selectedInspection.id, { id: profile.id, name: profile.full_name });
    const updated = await inspectionsService.getById(selectedInspection.id);
    setSelectedInspection(updated);
    setLinkedInspections((prev) => prev.map((i) => (i.id === updated?.id && updated ? updated : i)));
  };

  const handleTransitionInspection = async (ca: CorrectiveAction, newStatus: CorrectiveAction['status']) => {
    if (!selectedInspection || !profile) return;
    await inspectionsService.transitionCorrectiveAction(selectedInspection.id, ca.id, newStatus, {
      id: profile.id,
      name: profile.full_name,
      role: profile.role,
    });
    const updated = await inspectionsService.getById(selectedInspection.id);
    setSelectedInspection(updated);
    setLinkedInspections((prev) => prev.map((i) => (i.id === updated?.id && updated ? updated : i)));
  };

  if (loading) return <Spinner size="lg" label="Loading complaint..." />;
  if (!complaint) return <p className="text-xs text-warm-slate">Complaint not found.</p>;

  const actionBtns = getAvailableActions(profile?.role ?? null, complaint.status, handleAction, openModal, openInspections);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-warm-sand hover:text-copper-light">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-copper-light font-bold">{complaint.complaint_number}</span>
              <SeverityBadge value={complaint.severity} size="md" />
              <StatusBadge value={complaint.status} size="md" />
            </div>
            <h2 className="text-base font-bold text-warm-pale">{complaint.title}</h2>
            <p className="text-xs text-warm-slate mt-1">{complaint.description}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {actionBtns.map((a) => (
              <Button
                key={a.label}
                variant={a.variant ?? 'primary'}
                loading={actionLoading === a.key}
                onClick={() => a.onClick()}
              >
                {a.icon} {a.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div><span className="text-warm-slate">Category:</span> <span className="text-warm-pale font-semibold">{complaint.category}</span></div>
          <div><span className="text-warm-slate">Reported by:</span> <span className="text-warm-pale">{complaint.reported_by_name}</span></div>
          <div><span className="text-warm-slate">Mine:</span> <span className="text-warm-pale">{complaint.mine_name ?? '—'}</span></div>
          <div><span className="text-warm-slate">Location:</span> <span className="text-warm-pale">{complaint.location ?? '—'}</span></div>
          {complaint.latitude && complaint.longitude && (
            <div className="col-span-2 sm:col-span-4 flex items-center gap-1 text-copper-light">
              <MapPin className="w-3 h-3" />
              GPS: {complaint.latitude.toFixed(5)}, {complaint.longitude.toFixed(5)}
            </div>
          )}
        </div>
        {/* Full lifecycle timestamps — every transition is recorded forever */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px] border-t border-carbon-700/40 pt-3">
          <div><span className="text-warm-slate/70">Reported:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{formatDate(complaint.reported_at)}</span></div>
          <div><span className="text-warm-slate/70">Created:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{formatDate(complaint.created_at)}</span></div>
          <div><span className="text-warm-slate/70">Last Updated:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{formatDate(complaint.updated_at)}</span></div>
          <div><span className="text-warm-slate/70">Assigned:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{complaint.assigned_at ? formatDate(complaint.assigned_at) : '—'}</span></div>
          {complaint.verified_at && (
            <div><span className="text-warm-slate/70">Verified:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{formatDate(complaint.verified_at)}</span></div>
          )}
          {complaint.resolved_at && (
            <div><span className="text-warm-slate/70">Resolved:</span> <span className="text-warm-pale font-mono whitespace-nowrap">{formatDate(complaint.resolved_at)}</span></div>
          )}
          {complaint.due_date && (
            <div><span className="text-warm-slate/70">Due:</span> <span className="text-amber-400 font-mono whitespace-nowrap">{formatDate(complaint.due_date)}</span></div>
          )}
          {complaint.is_archived && (
            <div className="col-span-2"><span className="text-warm-slate/70">Archived:</span> <span className="text-rose-400 font-mono whitespace-nowrap">{complaint.archived_at ? formatDate(complaint.archived_at) : 'Yes'}</span></div>
          )}
        </div>
        {complaint.photo_url && (
          <div className="mt-3">
            <img src={complaint.photo_url} alt="Evidence" className="max-h-48 rounded-lg border border-carbon-700" />
          </div>
        )}
      </Card>


      {/* Timeline */}
      <Card title="Timeline" subtitle="Chain of custody">
        <div className="relative pl-4 space-y-0">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-carbon-700" />
          {events.length === 0 && <p className="text-xs text-warm-slate pl-6">No events recorded</p>}
          {events.map((ev) => (
            <div key={ev.id} className="relative pl-6 pb-4">
              <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-copper/30 border-2 border-copper flex items-center justify-center z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-copper" />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-warm-pale">{ev.actor_name}</span>
                  {ev.actor_designation && <span className="text-warm-slate">({ev.actor_designation})</span>}
                  <span className="font-mono text-warm-slate/60">{timeAgo(ev.created_at)}</span>
                </div>
                <p className="text-warm-sand mt-0.5">{ev.action}</p>
                {ev.old_status && ev.new_status && (
                  <div className="flex items-center gap-1 mt-1">
                    <StatusBadge value={ev.old_status} />
                    <span className="text-warm-slate">→</span>
                    <StatusBadge value={ev.new_status} />
                  </div>
                )}
                {ev.comment && <p className="text-[11px] text-warm-slate mt-1 italic">"{ev.comment}"</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Comments */}
      <Card title="Comments" subtitle={`${comments.length} comment${comments.length !== 1 ? 's' : ''}`}>
        <div className="space-y-3 mb-4">
          {comments.map((co) => (
            <div key={co.id} className="bg-carbon-850/60 rounded-lg p-3 border border-carbon-700/40">
              <div className="flex items-center gap-2 text-xs mb-1">
                <User className="w-3 h-3 text-copper-light" />
                <span className="font-semibold text-warm-pale">{co.author_name}</span>
                {co.author_role && <span className="text-warm-slate font-mono">[{co.author_role}]</span>}
                <span className="text-warm-slate/60 font-mono ml-auto">{timeAgo(co.created_at)}</span>
              </div>
              <p className="text-xs text-warm-sand leading-relaxed">{co.body}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-xs text-warm-slate text-center py-4">No comments yet</p>}
        </div>

        <div className="flex gap-2">
          <TextArea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={addComment} disabled={!commentText.trim()} loading={submitting}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* ── Inspections modal (real inspection detail) ── */}
      <Modal
        open={inspectModal}
        onClose={closeInspections}
        title={`Inspections · ${complaint.complaint_number}`}
        wide
      >
        {inspLoading ? (
          <Spinner size="lg" label="Loading inspections..." />
        ) : linkedInspections.length === 0 ? (
          <EmptyState
            title="No inspections linked"
            subtitle="No inspection records reference this complaint yet."
          />
        ) : selectedInspection ? (
          <div className="space-y-3">
            <button
              onClick={() => setSelectedInspection(null)}
              className="flex items-center gap-1.5 text-xs text-warm-sand hover:text-copper-light"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All inspections
            </button>
            <InspectionDetail
              inspection={selectedInspection}
              canVerify={canVerifyInspection}
              onVerify={handleVerifyInspection}
              onTransition={handleTransitionInspection}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {linkedInspections.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedInspection(i)}
                className="w-full text-left p-3 rounded-lg bg-carbon-850/70 border border-carbon-700/50 hover:border-copper/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-mono text-xs text-copper-light font-bold">{i.inspection_number}</span>
                  <StatusBadge value={i.status} />
                </div>
                <p className="text-xs font-bold text-warm-pale mt-1">
                  {i.inspection_type} · {new Date(i.inspection_date).toLocaleDateString()}
                </p>
                <p className="text-[10px] font-mono text-warm-slate/70 mt-0.5">
                  {(i.findings ?? []).length} findings · {(i.corrective_actions ?? []).length} corrective actions · by {i.inspector_name}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Action input modal ── */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalAction(null)}>
          <div className="bg-carbon-800 border border-carbon-700 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-warm-pale mb-2">
              {modalAction === 'resolve' ? 'Resolve Complaint' : modalAction === 'reject' ? 'Reject Complaint' : 'Escalate Complaint'}
            </h3>
            <p className="text-xs text-warm-slate mb-3">
              {modalAction === 'resolve' ? 'Describe the resolution.' : modalAction === 'reject' ? 'Provide a reason for rejection.' : 'Explain why this is being escalated.'}
            </p>
            <TextArea
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={modalAction === 'resolve' ? 'Resolution notes...' : 'Reason...'}
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setModalAction(null)}>Cancel</Button>
              <Button
                variant={modalAction === 'reject' ? 'danger' : modalAction === 'escalate' ? 'danger' : 'success'}
                loading={actionLoading === modalAction}
                disabled={!modalText.trim()}
                onClick={submitModal}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Available actions based on role + status ──
function getAvailableActions(
  role: UserRole | null,
  status: string,
  onAction: (action: string, data?: Record<string, any>) => Promise<void>,
  openModal: (action: string) => void = onAction as unknown as (a: string) => void,
  openInspection?: () => void,
) {
  const actions: { key: string; label: string; variant?: 'primary' | 'success' | 'danger' | 'secondary'; icon: React.ReactNode; onClick: () => void }[] = [];

  if (!role) return actions;

  const isInspector = ['mining_mate', 'overman', 'safety_officer'].includes(role);
  const isManager = ['mine_manager', 'super_admin'].includes(role);
  const isSafety = ['safety_officer', 'mine_manager', 'super_admin'].includes(role);
  const isSuper = role === 'super_admin';

  // Submitted/Under Review → Inspector or Manager can assign or start inspection
  if (['Submitted', 'Under Review'].includes(status)) {
    if (isInspector || isManager) {
      actions.push({
        key: 'start',
        label: 'Start Action',
        variant: 'primary',
        icon: <Play className="w-3.5 h-3.5" />,
        onClick: () => onAction('start'),
      });
    }
  }

  // Assigned/Action In Progress → Inspector, Manager, Safety Officer can mark resolved
  if (['Assigned', 'Action In Progress', 'Inspection Required'].includes(status)) {
    if (isInspector || isManager || isSafety) {
      actions.push({
        key: 'resolve',
        label: 'Resolve',
        variant: 'success',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        onClick: () => openModal('resolve'),
      });
    }
  }

  // Resolved → Manager/Safety/Super Admin can verify or reject
  if (status === 'Resolved') {
    if (isManager || isSafety) {
      actions.push({
        key: 'verify',
        label: 'Verify',
        variant: 'success',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        onClick: () => onAction('verify'),
      });
      actions.push({
        key: 'reject',
        label: 'Reject',
        variant: 'danger',
        icon: <XCircle className="w-3.5 h-3.5" />,
        onClick: () => openModal('reject'),
      });
    }
  }

  // Any non-terminal status → Manager/Super Admin/Safety can escalate
  if (!['Resolved', 'Verified', 'Rejected', 'Escalated'].includes(status)) {
    if (isManager || isSafety) {
      actions.push({
        key: 'escalate',
        label: 'Escalate',
        variant: 'danger',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        onClick: () => openModal('escalate'),
      });
    }
  }

  // Safety Officer / Manager can always view inspections
  if (isSafety && status !== 'Submitted') {
    actions.push({
      key: 'inspect',
      label: 'Inspection',
      variant: 'secondary',
      icon: <Shield className="w-3.5 h-3.5" />,
      onClick: () => openInspection?.(),
    });
  }

  return actions;
}

