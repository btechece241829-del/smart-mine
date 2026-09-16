// ────────────────────────────────────────────────────────────────
// Complaint List — filterable, searchable table of complaints
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from 'react';
import { Search, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { canAdminDeleteComplaints } from '../lib/complaintModule';
import { formatDate } from '../lib/analytics';
import { Complaint } from '../lib/types';
import { Card, Spinner, SeverityBadge, StatusBadge, EmptyState, Button } from './ui/primitives';
import { Select } from './ui/inputs';

interface Props {
  mineId?: string | null;
  userId?: string;            // filter to just this user's complaints
  assignedTo?: string;        // filter to assigned to this user
  safetyOnly?: boolean;       // safety officer: only safety/fire/environment
  searchQuery?: string;       // global Topbar search filter
  onView: (id: string) => void;
  onRegister?: () => void;    // optional "Report Complaint" button handler
}

const STATUS_OPTIONS = ['All', 'Submitted', 'Under Review', 'Assigned', 'Inspection Required', 'Action In Progress', 'Resolved', 'Verified', 'Rejected', 'Escalated'].map((s) => ({ value: s, label: s }));
const SEVERITY_OPTIONS = ['All', 'Low', 'Medium', 'High', 'Critical'].map((s) => ({ value: s, label: s }));

export const ComplaintList: React.FC<Props> = ({ mineId, userId, assignedTo, safetyOnly, searchQuery, onView, onRegister }) => {
  const { profile, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const list = await complaintsService.list({ mineId: mineId ?? undefined });
      setComplaints(list);
      setLoading(false);
    };
    load();
    const handleDbChange = (e: any) => {
      if (e.detail?.col === 'complaints') {
        load();
      }
    };
    window.addEventListener('smartmine_db_change', handleDbChange);
    return () => window.removeEventListener('smartmine_db_change', handleDbChange);
  }, [mineId]);

  const isAdmin = canAdminDeleteComplaints(role);

  const handleDelete = async (c: Complaint) => {
    if (!window.confirm(role === 'super_admin'
      ? `Permanently delete complaint ${c.complaint_number}?\n\nSuper Admin action — the record will be removed from Firestore (a DELETED audit event is kept for the trail).`
      : `Archive complaint ${c.complaint_number}?\n\nMine Manager action — it will be hidden from all lists. The record, event log and on-chain fingerprint are preserved.`)) return;
    setDeletingId(c.id);
    try {
      const res = await complaintsService.deleteByAdmin(c.id, { id: profile?.id, name: profile?.full_name ?? 'Administrator', role });
      if (res.error) window.alert(res.error);
      else setComplaints((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e: any) {
      window.alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    let out = complaints;
    if (userId) out = out.filter((c) => c.reported_by === userId);
    if (assignedTo) out = out.filter((c) => c.assigned_to === assignedTo);
    if (safetyOnly) out = out.filter((c) => ['Safety', 'Fire', 'Environment'].includes(c.category));
    if (statusFilter !== 'All') out = out.filter((c) => c.status === statusFilter);
    if (severityFilter !== 'All') out = out.filter((c) => c.severity === severityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((c) =>
        c.complaint_number.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase();
      out = out.filter((c) =>
        c.complaint_number.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return out.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
  }, [complaints, userId, assignedTo, safetyOnly, statusFilter, severityFilter, search, searchQuery]);

  if (loading) return <Spinner size="lg" label="Loading complaints..." />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold text-warm-pale">Complaints</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-warm-slate" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, title, category..."
            className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} className="w-40" />
        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} options={SEVERITY_OPTIONS} className="w-32" />
        {onRegister && (
          <Button variant="primary" onClick={onRegister}><Plus className="w-3.5 h-3.5" />Report Complaint</Button>
        )}
      </div>

      <p className="text-[11px] text-warm-slate">{filtered.length} complaint{filtered.length !== 1 ? 's' : ''} found</p>

      {filtered.length === 0 ? (
        <EmptyState title="No complaints match your filters" subtitle="Try changing the search or filters" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-left px-4 py-3 font-mono">ID</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-center px-4 py-3">Severity</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Reported</th>
                  <th className="text-right px-4 py-3">Created</th>
                  <th className="text-right px-4 py-3">Last Updated</th>
                  <th className="text-center px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-carbon-700/40 hover:bg-carbon-850/60 cursor-pointer" onClick={() => onView(c.id)}>
                    <td className="px-4 py-3 font-mono text-copper-light font-bold whitespace-nowrap">{c.complaint_number}</td>
                    <td className="px-4 py-3 text-warm-pale max-w-[240px] truncate">{c.title}</td>
                    <td className="px-4 py-3 text-warm-slate">{c.category}</td>
                    <td className="px-4 py-3 text-center"><SeverityBadge value={c.severity} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge value={c.status} /></td>
                    <td className="px-4 py-3 text-right text-warm-slate whitespace-nowrap">{formatDate(c.reported_at)}</td>
                    <td className="px-4 py-3 text-right text-warm-slate/80 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right text-warm-slate/80 whitespace-nowrap">{formatDate(c.updated_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                          disabled={deletingId === c.id}
                          title={role === 'super_admin' ? 'Permanently delete complaint' : 'Archive complaint'}
                          className="inline-flex items-center justify-center mr-2 text-rose-400 hover:text-rose-300 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ExternalLink className="w-3.5 h-3.5 text-warm-slate/60 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

