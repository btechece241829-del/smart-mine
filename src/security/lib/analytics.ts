// ────────────────────────────────────────────────────────────────
// Analytics service — computes dashboard KPIs & charts from complaints
// ────────────────────────────────────────────────────────────────
import { Complaint, DashboardStats, Severity } from './types';

export const OPEN_STATUSES: string[] = [
  'Draft',
  'Submitted',
  'Acknowledged',
  'Under Investigation',
  'Action Assigned',
  'Action In Progress',
  'Verification',
  // legacy open
  'Under Review',
  'Assigned',
  'Inspection Required',
  'Escalated',
];

export const CLOSED_STATUSES: string[] = ['Resolved', 'Closed', 'Verified', 'Rejected'];
export const TERMINAL_STATUSES: string[] = ['Resolved', 'Closed', 'Verified', 'Rejected'];

export function computeStats(complaints: Complaint[], now = new Date()): DashboardStats {
  const total = complaints.length;
  const open = complaints.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const critical = complaints.filter((c) => c.severity === 'Critical').length;
  const resolved = complaints.filter((c) => ['Verified', 'Resolved', 'Closed'].includes(c.status)).length;
  const pendingVerification = complaints.filter((c) => ['Resolved', 'Verification'].includes(c.status)).length;

  const overdue = complaints.filter((c) => {
    if (!OPEN_STATUSES.includes(c.status)) return false;
    if (!c.due_date) return false;
    return new Date(c.due_date).getTime() < now.getTime();
  }).length;

  const closed = complaints.filter((c) => ['Resolved', 'Verified', 'Closed', 'Rejected'].includes(c.status));
  const compliancePct = total === 0 ? 100 : Math.round((resolved / total) * 100);

  // Average resolution time (hours) for complaints with a resolved_at
  const withResTime = complaints.filter((c) => c.resolved_at && c.reported_at);
  let avgResolutionHours = 0;
  if (withResTime.length) {
    const sum = withResTime.reduce((acc, c) => {
      const ms = new Date(c.resolved_at as string).getTime() - new Date(c.reported_at).getTime();
      return acc + ms / 3600000;
    }, 0);
    avgResolutionHours = Math.round(sum / withResTime.length);
  }

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  complaints.forEach((c) => {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1;
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const m = c.reported_at.slice(0, 7); // YYYY-MM
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  });

  return {
    total,
    open,
    critical,
    overdue,
    resolved,
    pendingVerification,
    compliancePct,
    avgResolutionHours,
    byCategory,
    bySeverity,
    byStatus,
    byMonth,
    resolvedVsPending: {
      resolved,
      pending: open,
    },
  };
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  Low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
  Medium: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
  High: 'text-orange-400 bg-orange-500/15 border-orange-500/40',
  Critical: 'text-rose-400 bg-rose-500/20 border-rose-500/50',
};

export const STATUS_COLORS: Record<string, string> = {
  Draft: 'text-warm-slate bg-carbon-700/40 border-carbon-600/60',
  Submitted: 'text-slate-300 bg-slate-500/15 border-slate-400/40',
  Acknowledged: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
  'Under Investigation': 'text-violet-400 bg-violet-500/15 border-violet-500/40',
  'Action Assigned': 'text-blue-400 bg-blue-500/15 border-blue-500/40',
  'Action In Progress': 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
  Verification: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/40',
  Resolved: 'text-teal-400 bg-teal-500/15 border-teal-500/40',
  Closed: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/50',
  'Under Review': 'text-sky-400 bg-sky-500/15 border-sky-500/40',
  Assigned: 'text-blue-400 bg-blue-500/15 border-blue-500/40',
  'Inspection Required': 'text-violet-400 bg-violet-500/15 border-violet-500/40',
  Verified: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
  Rejected: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
  Escalated: 'text-red-400 bg-red-500/15 border-red-500/50',
};

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
