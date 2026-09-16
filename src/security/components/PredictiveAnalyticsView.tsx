// ────────────────────────────────────────────────────────────────────
// Predictive Analytics — future-fault prediction, recurring-issue
// detection, root-cause analysis, preventive actions & feedback loop.
// Super-admin only (routing is gated in securityMain/permissions).
// ────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BrainCircuit, Activity, AlertTriangle, TrendingUp, RefreshCw,
  ListChecks, ChevronDown, ChevronRight, ShieldAlert, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { fb } from '../lib/firebaseDb';
import {
  predictionService, Prediction, RecurringIssue, RootCauseAnalysis,
  PreventiveAction, PredictionDashboard, PredictionPerformance,
  AggregateLiveData, RiskLevel,
} from '../lib/predictionService';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { Modal, TextInput, TextArea } from './ui/inputs';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

const RISK_BADGE: Record<RiskLevel, string> = {
  LOW: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
  MEDIUM: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
  HIGH: 'text-orange-400 bg-orange-500/15 border-orange-500/40',
  CRITICAL: 'text-rose-400 bg-rose-500/20 border-rose-500/50',
};
const RISK_HEX: Record<RiskLevel, string> = {
  LOW: '#059669', MEDIUM: '#d97706', HIGH: '#ea580c', CRITICAL: '#e11d48',
};
const TREND_STYLE: Record<string, string> = {
  INCREASING: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  STABLE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DECREASING: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const KpiTile: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode }> = ({
  label, value, sub, color = 'text-copper-light', icon,
}) => (
  <div className="bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4 shadow-panel">
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-carbon-850 border border-carbon-700/60 ${color}`}>
        {icon ?? <Activity className="w-4 h-4" />}
      </div>
      <div>
        <div className="text-[11px] text-warm-slate uppercase font-mono tracking-wider">{label}</div>
        <div className={`text-xl font-extrabold ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-warm-slate mt-0.5">{sub}</div>}
      </div>
    </div>
  </div>
);
const PredictionRow: React.FC<{
  p: Prediction;
  expanded: boolean;
  onToggle: () => void;
  onRecordOutcome: (p: Prediction) => void;
}> = ({ p, expanded, onToggle, onRecordOutcome }) => (
  <div className="border-b border-carbon-700/50 last:border-0">
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-carbon-800/40 cursor-pointer" onClick={onToggle}>
      <ChevronRight className={`w-4 h-4 text-warm-slate transition-transform ${expanded ? 'rotate-90' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-warm-pale">{p.asset_name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${RISK_BADGE[p.risk_level]}`}>{p.risk_level}</span>
          <span className="text-[10px] text-warm-slate font-mono">{p.prediction_id}</span>
        </div>
        <div className="text-xs text-warm-slate mt-0.5 truncate">{p.predicted_fault}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-extrabold text-warm-pale">{p.probability}%</div>
        <div className="text-[10px] text-warm-slate">{p.predicted_window}</div>
      </div>
    </div>
    {expanded && (
      <div className="px-8 pb-4 pt-1 space-y-2 text-xs">
        {p.contributing_factors.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-mono text-warm-slate mb-1">Contributing factors</div>
            <ul className="space-y-1">
              {p.contributing_factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-warm-sand">
                  <span className="text-copper mt-1">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.recommended_actions.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-mono text-warm-slate mb-1">Recommended action</div>
            <ul className="space-y-1">
              {p.recommended_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />{a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Object.keys(p.historical_evidence).length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-mono text-warm-slate mb-1">Historical evidence</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(p.historical_evidence).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded bg-carbon-850 border border-carbon-700/50 font-mono text-[11px] text-warm-slate">
                  {k.replace(/_/g, ' ')}: <span className="text-warm-pale">{String(v)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="pt-1 flex items-center gap-3">
          <span className="text-[10px] text-warm-slate font-mono">Model: {p.model_version}</span>
          <span className="text-[10px] text-warm-slate font-mono">Generated: {new Date(p.created_at).toLocaleString()}</span>
          {p.prediction_status !== 'EVALUATED' && (
            <Button variant="ghost" className="ml-auto !px-2 !py-1 text-[11px]" onClick={(e) => { e.stopPropagation(); onRecordOutcome(p); }}>
              Record outcome
            </Button>
          )}
        </div>
      </div>
    )}
  </div>
);

const RiskPie: React.FC<{ data: { name: string; value: number }[] }> = ({ data }) => {
  const COLORS = ['#059669', '#d97706', '#ea580c', '#e11d48'];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1a1210', border: '1px solid #3a2c26', borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};
export const PredictiveAnalyticsView: React.FC = () => {
  const { role } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recurring, setRecurring] = useState<RecurringIssue[]>([]);
  const [rootCauses, setRootCauses] = useState<RootCauseAnalysis[]>([]);
  const [actions, setActions] = useState<PreventiveAction[]>([]);
  const [dashboard, setDashboard] = useState<PredictionDashboard | null>(null);
  const [perf, setPerf] = useState<PredictionPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [mlStatus, setMlStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [tab, setTab] = useState<'overview' | 'predictions' | 'recurring' | 'actions' | 'performance'>('overview');
  const [expandedPred, setExpandedPred] = useState<string | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<Prediction | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const loadLiveData = useCallback(async (): Promise<AggregateLiveData> => {
    const [c, i, ra, ca] = await Promise.all([
      fb('complaints').select('*').run<any[]>().then((r) => (r.data ?? []) as any[]).catch(() => []),
      fb('inspections').select('*').run<any[]>().then((r) => (r.data ?? []) as any[]).catch(() => []),
      fb('risk_assessments').select('*').run<any[]>().then((r) => (r.data ?? []) as any[]).catch(() => []),
      fb('corrective_actions').select('*').run<any[]>().then((r) => (r.data ?? []) as any[]).catch(() => []),
    ]);
    return { complaints: c, inspections: i, risk_assessments: ra, corrective_actions: ca };
  }, []);

  // Guard against re-entrant loadAll() calls. The Firestore reads / writes
  // below call saveLocalCollection → dispatch 'smartmine_db_change' synchronously,
  // so a naive handler would re-enter loadAll() mid-flight → runaway cascade that
  // freezes the UI (exponential Firestore reads + localStorage JSON.stringify +
  // ML-server calls). busy = one load in progress; queued = coalesce follow-ups
  // triggered while busy into a single re-run after the current pass completes.
  const loadAllBusyRef = useRef(false);
  const loadAllQueuedRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (loadAllBusyRef.current) {
      loadAllQueuedRef.current = true;
      return;
    }
    loadAllBusyRef.current = true;
    try {
      setLoading(true);
      const live = await loadLiveData();
      try {
        const gen = await predictionService.generatePredictions(live);
        setMlStatus(gen.from_ml ? 'online' : 'offline');
      } catch {
        setMlStatus('offline');
      }
      const [preds, recIssues, causes, actns, dash, perfRes] = await Promise.all([
        predictionService.getActivePredictions(),
        predictionService.getRecurringIssues(),
        predictionService.getRootCauses(),
        predictionService.getPreventiveActions(),
        predictionService.getDashboard(),
        predictionService.getPerformance(),
      ]);
      setPredictions(preds);
      setRecurring(recIssues);
      setRootCauses(causes);
      setActions(actns);
      setDashboard(dash);
      setPerf(perfRes);
      setLoading(false);
    } finally {
      loadAllBusyRef.current = false;
    }
    if (loadAllQueuedRef.current) {
      loadAllQueuedRef.current = false;
      void loadAll();
    }
  }, [loadLiveData]);

  useEffect(() => {
    loadAll();
    // NOTE: loadAll() reads live collections (complaints / inspections /
    // risk_assessments / corrective_actions) via fbQuery.select(), and mirrors
    // ML-server results into the predictive collections (predictions /
    // recurring_issues / preventive_actions) via fbInsertInto. Every successful
    // Firestore read/write calls saveLocalCollection() (see firebaseDb.ts),
    // which broadcasts a 'smartmine_db_change' event for that collection. If we
    // reload on ANY of these collections, every loadAll re-triggers itself
    // (complaints read → event → loadAll → 4 reads → 4 events → 4×loadAll → …) —
    // an exponential cascade that freezes the UI and hammers Firestore + the
    // ML server. User-driven mutations (recordOutcome / updatePreventiveAction)
    // already call loadAll() directly, and window 'focus' refreshes on tab
    // re-entry, so reloading here is only needed for genuinely external writes.
    const handler = (e: Event) => {
      const col = (e as CustomEvent<{ col?: string }>).detail?.col;
      // The view itself reads/writes ALL of these collections during loadAll():
      // fbInsertInto echoes events for the predictive collections, and every
      // successful fbQuery.select() read echoes events for the live collections
      // via saveLocalCollection -> 'smartmine_db_change'. Reloading on any of
      // them would re-trigger loadAll() -> exponential cascade -> UI freeze.
      // Genuine external writes (col not in this set) still trigger a reload;
      // window 'focus' refreshes on tab re-entry, and user mutations call
      // loadAll() directly, so skipping this full internal set is safe.
      if (col && ['predictions', 'recurring_issues', 'preventive_actions',
        'complaints', 'inspections', 'risk_assessments', 'corrective_actions'].includes(col)) return;
      loadAll();
    };
    const focusHandler = () => loadAll();
    window.addEventListener('smartmine_db_change', handler);
    window.addEventListener('focus', focusHandler);
    return () => {
      window.removeEventListener('smartmine_db_change', handler);
      window.removeEventListener('focus', focusHandler);
    };
  }, [loadAll]);

  const riskBreakdown: { name: string; value: number }[] = [
    { name: 'LOW', value: dashboard?.summary.low_risk_count ?? 0 },
    { name: 'MEDIUM', value: dashboard?.summary.medium_risk_count ?? 0 },
    { name: 'HIGH', value: dashboard?.summary.high_risk_count ?? 0 },
    { name: 'CRITICAL', value: dashboard?.summary.critical_count ?? 0 },
  ].filter((d) => d.value > 0);

  const categoryData = Object.entries(dashboard?.risk_by_category ?? {}).map(([k, v]) => ({ name: k.replace(/_/g, ' '), risk: v }));
  const zoneData = Object.entries(dashboard?.risk_by_zone ?? {}).map(([k, v]) => ({ name: k, risk: v })).sort((a, b) => b.risk - a.risk).slice(0, 8);
  const trendData = [...(dashboard?.risk_trend ?? [])].reverse();
  const issueFreq = [...recurring].sort((a, b) => b.occurrences - a.occurrences).slice(0, 8).map((r) => ({ name: (r.location ?? r.title).slice(0, 18), occurrences: r.occurrences }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
        <span className="ml-3 text-warm-slate text-sm">Loading predictive analytics from real mine data…</span>
      </div>
    );
  }

  const mlBadge =
    mlStatus === 'online'
      ? <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">ML engine online</span>
      : mlStatus === 'offline'
        ? <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">ML engine offline · local fallback</span>
        : <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-carbon-700 text-warm-slate border border-carbon-600">checking…</span>;

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'predictions', label: `Predictions (${predictions.length})` },
    { key: 'recurring', label: `Recurring Issues (${recurring.length})` },
    { key: 'actions', label: `Preventive Actions (${actions.length})` },
    { key: 'performance', label: 'Performance' },
  ];

  const action_state = (s: string) => {
    switch (s) {
      case 'COMPLETED': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'VERIFIED': return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
      case 'IN_PROGRESS': return 'bg-copper/15 text-copper-light border-copper/40';
      case 'ASSIGNED': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40';
      default: return 'bg-carbon-700 text-warm-slate border-carbon-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-copper" />
            Predictive Analytics
          </h1>
          <p className="text-xs text-warm-slate mt-1">
            Future fault &amp; incident risk from historical mine data · separate from anomaly detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mlBadge}
          <Button variant="secondary" onClick={loadAll}><RefreshCw className="w-4 h-4" /> Refresh</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-carbon-700/60 pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition-colors ${tab === t.key ? 'text-copper-light border-copper bg-carbon-800/50' : 'text-warm-slate border-transparent hover:text-warm-pale'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <KpiTile label="Active predictions" value={dashboard?.summary.total_active_predictions ?? 0} icon={<Activity className="w-4 h-4" />} />
            <KpiTile label="High risk" value={dashboard?.summary.high_risk_count ?? 0} color="text-orange-400" icon={<AlertTriangle className="w-4 h-4" />} />
            <KpiTile label="Critical" value={dashboard?.summary.critical_count ?? 0} color="text-rose-400" icon={<ShieldAlert className="w-4 h-4" />} />
            <KpiTile label="Faults next 7 days" value={dashboard?.summary.predicted_next_7d ?? 0} icon={<TrendingUp className="w-4 h-4" />} />
            <KpiTile label="Faults next 30 days" value={dashboard?.summary.predicted_next_30d ?? 0} icon={<TrendingUp className="w-4 h-4" />} />
            <KpiTile label="Recurring issues" value={dashboard?.summary.recurring_issues ?? 0} color="text-amber-400" icon={<ListChecks className="w-4 h-4" />} />
            <KpiTile label="Increasing-risk assets" value={dashboard?.summary.increasing_risk_assets ?? 0} color="text-orange-400" icon={<AlertTriangle className="w-4 h-4" />} />
            <KpiTile label="Preventive pending" value={dashboard?.summary.preventive_actions_pending ?? 0} color="text-emerald-400" icon={<CheckCircle2 className="w-4 h-4" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Fault risk trend (avg)" icon={<TrendingUp className="w-4 h-4 text-copper" />}>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a2c26" />
                    <XAxis dataKey="date" tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#a89a90', fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#1a1210', border: '1px solid #3a2c26', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="avg_risk" stroke="#d97a3f" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No risk trend yet" subtitle="Predictions will build a trend over time." />}
            </Card>

            <Card title="Risk distribution" icon={<Activity className="w-4 h-4 text-copper" />}>
              {riskBreakdown.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-1/2"><RiskPie data={riskBreakdown} /></div>
                  <div className="flex-1 space-y-2">
                    {riskBreakdown.map((r) => (
                      <div key={r.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-warm-sand">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_HEX[r.name as RiskLevel] }} />
                          {r.name}
                        </span>
                        <span className="font-mono text-warm-pale">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState title="No risk distribution" />}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Recurring issue frequency" icon={<ListChecks className="w-4 h-4 text-copper" />}>
              {issueFreq.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={issueFreq} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a2c26" />
                    <XAxis type="number" tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1210', border: '1px solid #3a2c26', borderRadius: 8 }} />
                    <Bar dataKey="occurrences" fill="#d97a3f" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No recurring issues" />}
            </Card>

            <Card title="Risk by mine section" icon={<ShieldAlert className="w-4 h-4 text-copper" />}>
              {zoneData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={zoneData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a2c26" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1210', border: '1px solid #3a2c26', borderRadius: 8 }} />
                    <Bar dataKey="risk" fill="#e11d48" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No zone risk data" />}
            </Card>

            <Card title="Risk by category" icon={<Activity className="w-4 h-4 text-copper" />}>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a2c26" />
                    <XAxis dataKey="name" tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#a89a90', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1210', border: '1px solid #3a2c26', borderRadius: 8 }} />
                    <Bar dataKey="risk" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No category risk data" />}
            </Card>
          </div>
        </>
      )}

      {tab === 'predictions' && (
        <Card title="Active predictions" subtitle="Future faults & risks predicted from historical mine data" icon={<BrainCircuit className="w-4 h-4 text-copper" />} padded={false}>
          {predictions.length === 0 ? (
            <EmptyState title="No predictions yet" subtitle="Generate predictions from the refresh button when historical data is available." />
          ) : (
            <div>
              {predictions.slice(0, 60).map((p) => (
                <PredictionRow
                  key={p.prediction_id + p.created_at}
                  p={p}
                  expanded={expandedPred === p.prediction_id}
                  onToggle={() => setExpandedPred(expandedPred === p.prediction_id ? null : p.prediction_id)}
                  onRecordOutcome={(pred) => { setOutcomeFor(pred); setOutcomeNote(''); }}
                />
              ))}
            </div>
          )}
        </Card>
      )}

        {tab === 'recurring' && (
        <Card title="Recurring issues & root-cause analysis" subtitle="Issues that repeat across incidents, complaints, inspections, faults & violations" icon={<ListChecks className="w-4 h-4 text-copper" />} padded={false}>
          {recurring.length === 0 ? (
            <EmptyState title="No recurring issues detected" subtitle="When the same issue repeats across records it will appear here." />
          ) : (
            <div>
              {recurring.slice(0, 40).map((iss) => {
                const rc = rootCauses.find((c) => c.issue_id === iss.issue_id);
                const isOpen = expandedIssue === iss.issue_id;
                return (
                  <div key={iss.issue_id} className="border-b border-carbon-700/50 last:border-0">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-carbon-800/40 cursor-pointer" onClick={() => setExpandedIssue(isOpen ? null : iss.issue_id)}>
                      <ChevronRight className={`w-4 h-4 text-warm-slate transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-warm-pale">{iss.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${RISK_BADGE[iss.severity]}`}>{iss.severity}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${TREND_STYLE[iss.frequency_trend] ?? TREND_STYLE.STABLE}`}>{iss.frequency_trend}</span>
                        </div>
                        <div className="text-xs text-warm-slate mt-0.5">Location: {iss.location ?? 'Unknown'} · Last: {new Date(iss.last_occurrence).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-warm-pale">{iss.occurrences}×</div>
                        <div className="text-[10px] text-warm-slate">recur • {iss.recurrence_risk}% risk</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-8 pb-4 pt-1 space-y-3 text-xs">
                        <p className="text-warm-sand">{iss.description}</p>
                        {rc && rc.contributing_factors.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-mono text-warm-slate mb-1">Possible root cause / contributing factors</div>
                            <ul className="space-y-1.5">
                              {rc.contributing_factors.map((f, i) => (
                                <li key={i} className="bg-carbon-850 border border-carbon-700/50 rounded-lg p-2.5">
                                  <div className="flex items-center gap-2 text-warm-pale font-semibold">
                                    <span className="text-copper">›</span>
                                    <span>{f.factor}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ml-auto ${f.confidence.includes('Likely') ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-carbon-700 text-warm-slate border-carbon-600'}`}>{f.confidence}</span>
                                  </div>
                                  <div className="text-[11px] text-warm-slate mt-1 ml-4">{f.evidence}</div>
                                </li>
                              ))}
                            </ul>
                            <div className="text-[10px] text-warm-slate mt-2 italic">Root causes are labeled as possible/likely — correlation is not certainty.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
{tab === 'actions' && (
        <Card title="Preventive actions" subtitle="Actions generated from predictions & recurring issues to prevent future faults" icon={<CheckCircle2 className="w-4 h-4 text-copper" />} padded={false}>
          {actions.length === 0 ? (
            <EmptyState title="No preventive actions" subtitle="Actions are generated automatically for high-risk predictions and recurring issues." />
          ) : (
            <div>
              {actions.slice(0, 60).map((a) => (
                <div key={a.action_id} className="border-b border-carbon-700/50 last:border-0 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${RISK_BADGE[a.priority]}`}>{a.priority}</span>
                      <span className="text-sm font-semibold text-warm-pale">{a.title}</span>
                    </div>
                    <div className="text-xs text-warm-slate mt-0.5">{a.description}</div>
                    <div className="text-[10px] text-warm-slate mt-0.5">
                      Responsible: <span className="text-warm-sand">{a.responsible_role}</span> · Deadline: <span className="text-warm-sand">{new Date(a.deadline).toLocaleDateString()}</span> · {a.source_type}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${action_state(a.status)}`}>{a.status}</span>
                    {a.status !== 'VERIFIED' && (
                      <select
                        className="text-[10px] bg-carbon-850 border border-carbon-700 rounded px-1 py-0.5 text-warm-sand outline-none"
                        value={a.status}
                        onChange={(e) => predictionService.updatePreventiveAction(a.action_id, { status: e.target.value as PreventiveAction['status'] }).then(setActions)}
                      >
                        {['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'].map((s) => <option key={s} value={s} className="bg-carbon-900">{s}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'performance' && (
        <Card title="Prediction performance" subtitle="Feedback-loop accuracy based on recorded outcomes" icon={<Activity className="w-4 h-4 text-copper" />}>
          {!perf ? (
            <EmptyState title="Performance unavailable" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-5 text-center">
                <div className="text-3xl font-extrabold text-warm-pale">{perf.accuracy != null ? `${perf.accuracy}%` : '—'}</div>
                <div className="text-[11px] text-warm-slate uppercase font-mono tracking-wider mt-1">Accuracy</div>
                {perf.accuracy == null && <div className="text-[11px] text-warm-slate mt-2">{perf.message ?? 'No outcomes recorded yet — outcomes appear as predictions are evaluated.'}</div>}
              </div>
              <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-5 text-center">
                <div className="text-3xl font-extrabold text-warm-pale">{perf.total_evaluated ?? 0}</div>
                <div className="text-[11px] text-warm-slate uppercase font-mono tracking-wider mt-1">Outcomes recorded</div>
                {perf.correct_predictions != null && <div className="text-[11px] text-emerald-400 mt-1">{perf.correct_predictions} correct</div>}
              </div>
              <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-5 text-center">
                <div className="text-3xl font-extrabold text-warm-pale">{perf.predictions_total ?? 0}</div>
                <div className="text-[11px] text-warm-slate uppercase font-mono tracking-wider mt-1">Total predictions</div>
                <div className="text-[11px] text-warm-slate mt-1">{perf.predictions_active ?? 0} active · {perf.predictions_evaluated ?? 0} evaluated</div>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={!!outcomeFor} onClose={() => setOutcomeFor(null)} title="Record prediction outcome">
        {outcomeFor && (
          <div className="space-y-4">
            <div className="text-xs text-warm-slate">
              <span className="font-semibold text-warm-pale">{outcomeFor.asset_name}</span> · {outcomeFor.predicted_fault} · predicted {outcomeFor.probability}% ({outcomeFor.risk_level})
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="danger" onClick={async () => {
                await predictionService.recordOutcome(outcomeFor.prediction_id, true, new Date().toISOString(), outcomeNote || 'Fault occurred');
                setOutcomeFor(null); loadAll();
              }}>Fault occurred</Button>
              <Button variant="success" onClick={async () => {
                await predictionService.recordOutcome(outcomeFor.prediction_id, false, undefined, outcomeNote || 'No fault occurred');
                setOutcomeFor(null); loadAll();
              }}>No fault</Button>
            </div>
            <TextArea
              placeholder="Notes (optional)"
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
