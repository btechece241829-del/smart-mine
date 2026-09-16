// ──────────────────────────────────────────────────────────────────────
// Complaint Analytics — KPIs, status/severity/category breakdowns and
// SLA overview built from the complaint module queries.
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, AlertTriangle, Clock, CheckCircle2, Activity, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { listComplaints, isOverdue, listAwaitingVerification } from '../../lib/complaintModule';
import { OPEN_STATUSES } from '../../lib/analytics';
import { Complaint, PRIORITIES, Severity } from '../../lib/types';
import { Card, Spinner, EmptyState } from '../ui/primitives';

const STATUS_LABELS: Array<{ status: string; color: string }> = [
  { status: 'Submitted', color: 'bg-slate-400/70' },
  { status: 'Acknowledged', color: 'bg-sky-400/70' },
  { status: 'Under Investigation', color: 'bg-violet-400/70' },
  { status: 'Action Assigned', color: 'bg-blue-400/70' },
  { status: 'Action In Progress', color: 'bg-cyan-400/70' },
  { status: 'Verification', color: 'bg-fuchsia-400/70' },
  { status: 'Resolved', color: 'bg-teal-400/70' },
  { status: 'Closed', color: 'bg-emerald-400/70' },
  { status: 'Escalated', color: 'bg-red-400/70' },
  { status: 'Rejected', color: 'bg-rose-400/70' },
];

const SEVERITY_BAR: Record<Severity, string> = {
  Critical: 'bg-rose-500',
  High: 'bg-amber-500',
  Medium: 'bg-yellow-400',
  Low: 'bg-emerald-500',
};

function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = { Critical: 'bg-rose-500', High: 'bg-amber-500', Medium: 'bg-yellow-400', Low: 'bg-emerald-500' };
  return <span className={`w-2.5 h-2.5 rounded-full ${colors[severity]}`} />;
}

export const ComplaintAnalyticsPage: React.FC = () => {
  const { profile, role } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [checking, setChecking] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof listComplaints>[0] = {};
      if (profile?.mine_id && role !== 'super_admin' && role !== 'mine_manager') opts.mineId = profile.mine_id;
      setItems(await listComplaints(opts));
      setChecking(await listAwaitingVerification({ mineId: opts.mineId }));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [profile?.mine_id, role]);

  useEffect(() => {
    load().catch(() => {});
    const handleDbChange = (e: any) => {
      if (e.detail?.col === 'complaints') {
        load();
      }
    };
    window.addEventListener('smartmine_db_change', handleDbChange);
    return () => window.removeEventListener('smartmine_db_change', handleDbChange);
  }, [load]);

  const stats = useMemo(() => {
    const total = items.length;
    const open = items.filter((c) => OPEN_STATUSES.includes(c.status)).length;
    const critical = items.filter((c) => c.severity === 'Critical' || c.is_critical).length;
    const resolved = items.filter((c) => ['Resolved', 'Closed', 'Verified'].includes(c.status)).length;
    const overdue = items.filter((c) => isOverdue(c)).length;
    const compliance = total === 0 ? 100 : Math.round((resolved / total) * 100);
    return { total, open, critical, resolved, overdue, compliance };
  }, [items]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.status, (map.get(it.status) ?? 0) + 1);
    return STATUS_LABELS.map((s) => ({ ...s, count: map.get(s.status) ?? 0 }));
  }, [items]);

  const severityBreakdown = useMemo(() => PRIORITIES.map((p) => ({
    severity: p as Severity,
    count: items.filter((c) => c.severity === p).length,
  })), [items]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.category ?? 'Other', (map.get(it.category ?? 'Other') ?? 0) + 1);
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [items]);

  const trend = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map((m) => ({
      month: m,
      label: new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString('en-GB', { month: 'short' }),
      count: items.filter((c) => (c.reported_at ?? '').startsWith(m)).length,
    }));
  }, [items]);

  const maxTrend = Math.max(1, ...trend.map((t) => t.count));
  const maxCat = Math.max(1, ...categoryBreakdown.map((c) => c.count));
  const maxStatus = Math.max(1, ...statusBreakdown.map((s) => s.count));

  return (
    <div className="max-w-6xl mx-auto space-y-4 p-2">
      <Card title="Complaint Analytics" icon={<BarChart3 className="w-4 h-4" />} subtitle="Module-wide KPIs, trends and SLA health">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" label="Crunching analytics…" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border border-carbon-700 bg-carbon-850/60 p-3">
                <div className="text-[10px] font-mono uppercase text-warm-slate">Total</div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="rounded-lg border border-carbon-700 bg-carbon-850/60 p-3">
                <div className="text-[10px] font-mono uppercase text-warm-slate">Open</div>
                <div className="text-2xl font-bold text-sky-300">{stats.open}</div>
              </div>
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
                <div className="text-[10px] font-mono uppercase text-rose-300 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Critical</div>
                <div className="text-2xl font-bold text-rose-300">{stats.critical}</div>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="text-[10px] font-mono uppercase text-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" />Overdue</div>
                <div className="text-2xl font-bold text-amber-300">{stats.overdue}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                <div className="text-[10px] font-mono uppercase text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Compliance</div>
                <div className="text-2xl font-bold text-emerald-300">{stats.compliance}%</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-white mb-2">By status</div>
              <div className="space-y-1.5">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <span className="text-[10px] text-warm-slate w-40 truncate">{s.status}</span>
                    <div className="flex-1 h-2.5 rounded bg-carbon-800 overflow-hidden">
                      <div className={`h-full ${s.color}`} style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-warm-slate w-8 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <div className="text-xs font-semibold text-white mb-2">By severity</div>
                <div className="space-y-1.5">
                  {severityBreakdown.map((s) => (
                    <div key={s.severity} className="flex items-center gap-2">
                      <span className="text-[10px] text-warm-slate w-16">{s.severity}</span>
                      <div className="flex-1 h-2.5 rounded bg-carbon-800 overflow-hidden">
                        <div className={`h-full ${SEVERITY_BAR[s.severity]}`} style={{ width: `${(s.count / Math.max(1, ...severityBreakdown.map((x) => x.count))) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-warm-slate w-8 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-white mb-2">Reported — last 6 months</div>
                <div className="flex items-end gap-2 h-24">
                  {trend.map((t) => (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-warm-slate">{t.count}</div>
                      <div className="w-full rounded-t bg-copper/70" style={{ height: `${Math.max(4, (t.count / maxTrend) * 64)}px` }} />
                      <div className="text-[10px] text-warm-slate">{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {categoryBreakdown.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-white mb-2">By category</div>
                <div className="space-y-1.5">
                  {categoryBreakdown.map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-warm-slate w-44 truncate">{c.name}</span>
                      <div className="flex-1 h-2.5 rounded bg-carbon-800 overflow-hidden">
                        <div className="h-full bg-warm-sand/70" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-warm-slate w-8 text-right">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-carbon-800 pt-4">
              <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-fuchsia-400" />
                Awaiting verification ({checking.length})
              </div>
              {checking.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="w-5 h-5" />} title="Nothing awaiting verification" subtitle="All verified or none at verification stage." />
              ) : (
                <div className="space-y-1.5">
                  {checking.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-carbon-700 bg-carbon-850/60 px-3 py-2">
                      <span className="text-[10px] font-mono text-warm-slate">{c.complaint_number}</span>
                      <span className="text-[11px] text-white truncate flex-1">{c.title}</span>
                      <SeverityDot severity={c.severity} />
                      {c.verification_requested_at && (
                        <span className="text-[10px] text-warm-slate">
                          {Math.floor((Date.now() - new Date(c.verification_requested_at).getTime()) / 60000)}m waiting
                        </span>
                      )}
                      {isOverdue(c) && <span className="text-[10px] text-rose-400"><AlertTriangle className="w-3 h-3 inline" /> overdue</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};