// ──────────────────────────────────────────────────────────────────────
// Complaint Explorer — unified list with filters, search, stat chips.
// Role-scoped: each role sees only what matters to them.
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { Search, AlertTriangle, Clock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { complaintsService } from '../../lib/complaints';
import { listComplaints, isOverdue, slaInfo, canAdminDeleteComplaints, ComplaintSlaInfo } from '../../lib/complaintModule';
import { SEVERITY_COLORS, STATUS_COLORS, OPEN_STATUSES, TERMINAL_STATUSES } from '../../lib/analytics';
import { Complaint, ComplaintStatus, Severity, PRIORITIES, UserRole } from '../../lib/types';
import { Card, Button, Spinner, EmptyState, SeverityBadge, StatusBadge } from '../ui/primitives';
import { TextInput, Select } from '../ui/inputs';

const ALL_STATUSES: ComplaintStatus[] = [
  'Submitted', 'Acknowledged', 'Under Investigation', 'Action Assigned',
  'Action In Progress', 'Verification', 'Resolved', 'Closed', 'Escalated', 'Rejected', 'Draft',
];

interface Props {
  onView: (id: string) => void;
  onRegister?: () => void;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export const ComplaintExplorerPage: React.FC<Props> = ({ onView, onRegister }) => {
  const { profile, role } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const [showCritical, setShowCritical] = useState(false);
  const [sortKey, setSortKey] = useState<'reported_at' | 'due_date' | 'severity'>('reported_at');
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof listComplaints>[0] = {};
      if (profile?.mine_id) opts.mineId = profile.mine_id;
      if (role === 'worker') opts.userId = profile?.id ?? '';
      else if (role === 'mining_mate' || role === 'overman') opts.assignedTo = profile?.id ?? '';
      setItems(await listComplaints(opts));
    } catch (e: any) {
      console.error('[Explorer] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.mine_id, role]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const isAdmin = canAdminDeleteComplaints(role);

  const handleDelete = async (c: Complaint) => {
    if (!window.confirm(role === 'super_admin'
      ? `Permanently delete complaint ${c.complaint_number}?\n\nSuper Admin action — the record will be removed from Firestore (a DELETED audit event is kept for the trail).`
      : `Archive complaint ${c.complaint_number}?\n\nMine Manager action — it will be hidden from all lists. The record, event log and on-chain fingerprint are preserved.`)) return;
    setDeletingId(c.id);
    try {
      const res = await complaintsService.deleteByAdmin(c.id, { id: profile?.id, name: profile?.full_name ?? 'Administrator', role });
      if (res.error) window.alert(res.error);
      await load();
    } catch (e: any) {
      window.alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  let filtered = items;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((c) =>
      [c.complaint_number, c.title, c.description, c.category, c.subcategory, c.location, c.location_name, c.department, c.work_area]
        .map((v) => (v ?? '').toLowerCase()).some((v) => v.includes(s))
    );
  }
  if (statusFilter) filtered = filtered.filter((c) => c.status === statusFilter);
  if (severityFilter) filtered = filtered.filter((c) => c.severity === severityFilter);
  if (showOverdue) filtered = filtered.filter((c) => isOverdue(c));
  if (showCritical) filtered = filtered.filter((c) => c.severity === 'Critical' || c.is_critical);

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'severity') {
      const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      cmp = (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    } else if (sortKey === 'due_date') {
      cmp = String(a.due_date ?? '').localeCompare(String(b.due_date ?? ''));
    } else {
      cmp = String(a.reported_at ?? '').localeCompare(String(b.reported_at ?? ''));
    }
    return sortAsc ? cmp : -cmp;
  });

  const stats = {
    total: filtered.length,
    open: filtered.filter((c) => OPEN_STATUSES.includes(c.status)).length,
    overdue: filtered.filter((c) => isOverdue(c)).length,
    critical: filtered.filter((c) => c.severity === 'Critical' || c.is_critical).length,
    resolved: filtered.filter((c) => TERMINAL_STATUSES.includes(c.status)).length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 p-2">
      <Card title="Complaint Explorer" subtitle={`${stats.total} total · ${stats.open} open · ${stats.overdue} overdue · ${stats.critical} critical`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-slate" />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, title, category…" className="!pl-8" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: '', label: 'All statuses' }, ...ALL_STATUSES.map((s) => ({ value: s, label: s }))]} />
          <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} options={[{ value: '', label: 'All severities' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
          <Button variant={showOverdue ? 'primary' : 'ghost'} onClick={() => setShowOverdue(!showOverdue)}><Clock className="w-3.5 h-3.5" />Overdue</Button>
          <Button variant={showCritical ? 'danger' : 'ghost'} onClick={() => setShowCritical(!showCritical)}><AlertTriangle className="w-3.5 h-3.5" />Critical</Button>
          {onRegister && (
            <Button variant="primary" onClick={onRegister}><Plus className="w-3.5 h-3.5" />Report Complaint</Button>
          )}
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          {(['reported_at', 'due_date', 'severity'] as const).map((k) => (
            <button
              key={k}
              onClick={() => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false); } }}
              className={`text-[10px] px-2 py-1 rounded border font-mono ${sortKey === k ? 'border-copper bg-copper/10 text-copper-light' : 'border-carbon-700 text-warm-slate hover:text-white'}`}
            >
              {k === 'reported_at' ? 'Newest' : k === 'due_date' ? 'Due date' : 'Severity'} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" label="Loading complaints…" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No complaints match" subtitle="Try changing filters or search." />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((c) => {
              const sla: ComplaintSlaInfo = slaInfo(c);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg border transition cursor-pointer ${isOverdue(c) ? 'border-rose-500/50 bg-rose-500/5' : 'border-carbon-700 bg-carbon-850/60 hover:border-carbon-600'}`}
                  onClick={() => onView(c.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(c.id); } }}
                >
                  <div className="shrink-0"><SeverityBadge value={c.severity} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-warm-slate">{c.complaint_number}</span>
                      <span className="text-[11px] font-semibold text-white truncate">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge value={c.status} />
                      <span className="text-[10px] text-warm-slate">{c.category}{c.subcategory ? ` / ${c.subcategory}` : ''}</span>
                      {c.mine_name && <span className="text-[10px] text-warm-slate">• {c.mine_name}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-warm-slate">{fmtDate(c.reported_at)}</div>
                    {sla.overdue && <div className="text-[10px] text-rose-400 font-semibold">Overdue {sla.overDays}d</div>}
                    {!sla.overdue && sla.daysLeft != null && <div className="text-[10px] text-warm-slate">{sla.daysLeft}d left</div>}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                      disabled={deletingId === c.id}
                      title={role === 'super_admin' ? 'Permanently delete complaint' : 'Archive complaint'}
                      className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 disabled:opacity-50 border border-transparent hover:border-rose-500/40 rounded px-1.5 py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};