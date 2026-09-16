// ────────────────────────────────────────────────────────────────
// Escalations View — critical hazards & escalated complaints.
// Critical (severity=Critical or immediate danger) auto-escalate at
// report time; this page surfaces them for safety personnel along
// with overdue SLA items that require intervention.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Siren, Clock } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { Complaint } from '../lib/types';
import { Card, Spinner, EmptyState, SeverityBadge, StatusBadge, Button } from './ui/primitives';
import { TextArea, Modal } from './ui/inputs';
import { timeAgo } from '../lib/analytics';

export const EscalationsView: React.FC<{ onSelectComplaint?: (id: string) => void }> = ({ onSelectComplaint }) => {
  const { profile, role } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'overdue'>('all');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateTarget, setEscalateTarget] = useState<Complaint | null>(null);
  const [escalateNote, setEscalateNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canAct = ['safety_officer', 'mine_manager', 'super_admin'].includes(role ?? '');

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const list = await complaintsService.list({ mineId: profile.mine_id ?? undefined });
    const critical = list.filter((c) => c.is_critical === true || c.severity === 'Critical' || c.status === 'Escalated');
    setItems(critical);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const isOverdue = (c: Complaint) => !!c.due_date && !['Resolved', 'Verified', 'Rejected', 'Escalated'].includes(c.status) && new Date(c.due_date) < new Date();

  const filtered = items.filter((c) => {
    if (filter === 'critical') return c.is_critical === true || c.severity === 'Critical';
    if (filter === 'overdue') return isOverdue(c);
    return true;
  });

  const submitEscalate = async () => {
    if (!escalateTarget) return;
    setActionLoading(escalateTarget.id);
    const res = await complaintsService.escalate(escalateTarget.id, {
      id: profile?.id,
      name: profile?.full_name ?? 'System',
      role: role ?? null,
    }, escalateNote.trim() || undefined);
    if (res.error) console.warn('Escalation failed:', res.error);
    setEscalateOpen(false);
    setEscalateNote('');
    setActionLoading(null);
    await load();
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale flex items-center gap-2">
            <Siren className="w-5 h-5 text-rose-400" /> Escalations & Critical Hazards
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            {items.filter((c) => c.is_critical || c.severity === 'Critical').length} critical · {items.filter(isOverdue).length} overdue SLA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'critical', 'overdue'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase transition-colors ${
                filter === f ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-carbon-800 text-warm-slate border border-carbon-700 hover:text-warm-pale'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner size="lg" label="Loading escalations..." /> : filtered.length === 0 ? (
        <EmptyState title="No critical hazards" subtitle="All hazards are currently under control." />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} padded={false} className={`border-l-4 ${c.severity === 'Critical' || c.is_critical ? 'border-l-rose-500' : c.status === 'Escalated' ? 'border-l-amber-500' : 'border-l-carbon-700'}`}>
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => onSelectComplaint?.(c.id)}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-copper-light font-bold">{c.complaint_number}</span>
                      <SeverityBadge value={c.severity} />
                      {c.is_critical && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                          CRITICAL
                        </span>
                      )}
                      {c.immediate_danger && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                          IMMEDIATE DANGER
                        </span>
                      )}
                      <StatusBadge value={c.status} />
                    </div>
                    <p className="text-sm font-bold text-warm-pale mt-1.5">{c.title}</p>
                    <p className="text-xs text-warm-slate mt-0.5 line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-warm-slate/60 flex-wrap">
                      <span>{c.mine_name ?? '—'}</span>
                      <span>Reported {timeAgo(c.reported_at)} by {c.reported_by_name}</span>
                      {c.due_date && !['Resolved', 'Verified', 'Rejected'].includes(c.status) && (
                        <span className={isOverdue(c) ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {isOverdue(c) ? 'SLA OVERDUE' : `Due ${new Date(c.due_date).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  </button>

                  {canAct && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="danger"
                        className="px-2.5 py-1.5 text-[11px]"
                        onClick={() => { setEscalateTarget(c); setEscalateNote(''); setEscalateOpen(true); }}
                        disabled={actionLoading === c.id}
                      >
                        Escalate
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        title={`Escalate ${escalateTarget?.complaint_number ?? ''}`}
      >
        <div className="space-y-3">
          <p className="text-xs text-warm-slate">Provide a reason for escalating this hazard to senior management.</p>
          <TextArea value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} rows={4} placeholder="Why does this require senior intervention?" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={submitEscalate}>
              <AlertTriangle className="w-4 h-4 mr-1" /> Confirm Escalation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};