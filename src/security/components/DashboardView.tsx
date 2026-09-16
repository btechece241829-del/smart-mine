// ────────────────────────────────────────────────────────────────
// Dashboard — role-specific KPI cards, chart placeholders
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, BarChart3, FileWarning, Activity, Shield,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { computeStats, formatDate, STATUS_COLORS } from '../lib/analytics';
import { Complaint, DashboardStats, UserRole } from '../lib/types';
import { Card, Spinner } from './ui/primitives';

// ── KPI card ──
const KpiCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode;
  color?: string; sub?: string; onClick?: () => void;
}> = ({ label, value, icon, color = 'text-copper-light', sub, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4 shadow-panel transition-all ${
      onClick ? 'cursor-pointer hover:border-copper/50 hover:bg-carbon-800' : ''
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-')}/15`}>
        {icon}
      </div>
      <div>
        <div className="text-[11px] text-warm-slate uppercase font-mono tracking-wider">{label}</div>
        <div className={`text-xl font-extrabold ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-warm-slate mt-0.5">{sub}</div>}
      </div>
    </div>
  </div>
);

// ── Mini bar chart ──
const MiniBar: React.FC<{ data: Record<string, number>; title: string }> = ({ data, title }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  return (
    <Card title={title}>
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-warm-slate text-right">{k}</span>
            <div className="flex-1 h-3 bg-carbon-850 rounded-full overflow-hidden">
              <div className="h-full bg-copper/70 rounded-full transition-all" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono font-bold text-warm-pale">{v}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-warm-slate text-center py-4">No data</p>}
      </div>
    </Card>
  );
};

// ── Status donut placeholder ──
const StatusBreakdown: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const total = Object.values(data).reduce((s, v) => s + v, 0) || 1;
  return (
    <Card title="Status Breakdown">
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
          const pct = Math.round((v / total) * 100);
          const colorCls = STATUS_COLORS[k] ?? 'text-warm-slate bg-carbon-700/30';
          return (
            <div key={k} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${colorCls.split(' ')[1]}`} />
              <span className="flex-1 text-xs text-warm-sand truncate">{k}</span>
              <span className="text-[11px] font-mono text-warm-slate">{v}</span>
              <span className="text-[10px] font-mono text-warm-slate/60 w-10 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Recent complaints ──
const RecentComplaints: React.FC<{ items: Complaint[]; onSelect?: (id: string) => void }> = ({ items, onSelect }) => (
  <Card title="Recent Complaints" subtitle="Last 5 submitted">
    <div className="space-y-2">
      {items.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect?.(c.id)}
          className={`flex items-center gap-2 text-xs p-2 rounded-lg bg-carbon-850/50 border border-carbon-700/40 transition-all ${
            onSelect ? 'cursor-pointer hover:border-copper/40 hover:bg-carbon-800' : ''
          }`}
        >
          <span className="font-mono text-copper-light font-bold w-28 truncate">{c.complaint_number}</span>
          <span className="flex-1 truncate text-warm-pale">{c.title}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[c.status] ?? 'text-warm-slate'}`}>{c.status}</span>
          <span className="text-warm-slate">{formatDate(c.reported_at)}</span>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-warm-slate text-center py-4">No complaints yet</p>}
    </div>
  </Card>
);

interface DashboardViewProps {
  onNavigate?: (page: any) => void;
  onSelectComplaint?: (id: string) => void;
}

// ── Dashboard page ──
export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onSelectComplaint }) => {
  const { profile, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  // Re-entrancy guard: our own complaints read below triggers a
  // 'smartmine_db_change' event (fbQuery.run → saveLocalCollection → dispatch)
  // for 'complaints'. Without a guard, that event reloads load(), which reads
  // complaints again → event → reload → … an endless Firestore read loop.
  const loadBusyRef = useRef(false);
  const loadQueuedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      if (loadBusyRef.current) {
        loadQueuedRef.current = true;
        return;
      }
      loadBusyRef.current = true;
      try {
        setLoading(true);
        // Mine managers and super admins should see all complaints or their mine
        const mineIdToUse = (role === 'super_admin' || role === 'mine_manager') ? undefined : (profile.mine_id ?? undefined);
        const list = await complaintsService.list({ mineId: mineIdToUse });
        setComplaints(list);
        setStats(computeStats(list));
        setLoading(false);
      } finally {
        loadBusyRef.current = false;
      }
      if (loadQueuedRef.current) {
        loadQueuedRef.current = false;
        void load();
      }
    };
    load();

    // Skip 'complaints' and 'mines' — load() reads both collections
    // (complaints via complaintsService.list, mines via loadMinesLookup).
    // Every successful Firestore read echoes its collection back through
    // saveLocalCollection -> 'smartmine_db_change'. If we reload on either,
    // each load triggers the next -> endless Firestore read loop.
    const LOAD_READ_COLS = new Set(['complaints', 'mines']);
    const handleDbChange = (e: any) => {
      const col = e.detail?.col;
      if (!col || LOAD_READ_COLS.has(col)) return;
      load();
    };
    window.addEventListener('smartmine_db_change', handleDbChange);
    return () => window.removeEventListener('smartmine_db_change', handleDbChange);
  }, [profile, role]);

  if (loading) return <Spinner size="lg" label="Loading dashboard..." />;
  if (!stats) return null;

  const recent = [...complaints].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()).slice(0, 5);

  // Navigate to list view for appropriate role
  const targetComplaintsPage = role === 'worker' ? 'my_complaints'
    : role === 'mining_mate' || role === 'overman' ? 'assigned_complaints'
    : role === 'safety_officer' ? 'safety_complaints'
    : role === 'mine_manager' ? 'all_mine_complaints'
    : 'all_complaints';

  // Role-specific KPI cards
  const kpis = getKpisForRole(role, stats).map((k) => ({
    ...k,
    onClick: onNavigate ? () => onNavigate(targetComplaintsPage) : undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale">
            {role === 'super_admin' ? 'System' : role === 'mine_manager' ? 'Mine Manager' : 'Dashboard'}
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            Welcome back, {profile?.full_name} · {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniBar data={stats.byCategory} title="Issues by Category" />
        <StatusBreakdown data={stats.byStatus} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniBar data={stats.bySeverity} title="By Severity" />
        <MiniBar data={stats.byMonth} title="Monthly Trend" />
      </div>

      {/* Recent complaints */}
      <RecentComplaints items={recent} onSelect={onSelectComplaint} />
    </div>
  );
};

// ── KPI config per role ──
function getKpisForRole(role: UserRole | null, s: DashboardStats) {
  const base = [
    { label: 'Total Issues', value: s.total, icon: <FileWarning className="w-5 h-5 text-copper-light" />, color: 'text-copper-light' },
    { label: 'Open Issues', value: s.open, icon: <Clock className="w-5 h-5 text-amber-400" />, color: 'text-amber-400', sub: `${s.overdue} overdue` },
    { label: 'Resolved', value: s.resolved, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400', sub: `${s.compliancePct}% compliance` },
    { label: 'Critical', value: s.critical, icon: <AlertTriangle className="w-5 h-5 text-rose-400" />, color: 'text-rose-400' },
  ];

  if (role === 'mine_manager' || role === 'super_admin') {
    return [
      ...base,
      { label: 'Avg Resolution', value: `${s.avgResolutionHours}h`, icon: <TrendingUp className="w-5 h-5 text-sky-400" />, color: 'text-sky-400' },
      { label: 'Pending Verify', value: s.pendingVerification, icon: <Shield className="w-5 h-5 text-violet-400" />, color: 'text-violet-400' },
      { label: 'Compliance', value: `${s.compliancePct}%`, icon: <BarChart3 className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400' },
      { label: 'Overdue', value: s.overdue, icon: <Activity className="w-5 h-5 text-rose-400" />, color: 'text-rose-400' },
    ];
  }
  return base;
};

