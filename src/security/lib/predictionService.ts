// ────────────────────────────────────────────────────────────────────
// Predictive Analytics Service
// Blends Python ML server + live Firestore records for real predictions.
// ────────────────────────────────────────────────────────────────────
import { fb, fbInsertInto, fbUpdateOf } from './firebaseDb';
const ML_BASE = 'http://localhost:5001/api';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Prediction {
  id: string; prediction_id: string; asset_id: string | null; asset_name: string;
  asset_type: 'equipment' | 'mine_section' | 'system'; mine_id: string | null; mine_name: string | null;
  predicted_fault: string; probability: number; risk_level: RiskLevel; predicted_window: string;
  contributing_factors: string[]; historical_evidence: Record<string, number | string>;
  recommended_actions: string[]; model_version: string; prediction_status: 'ACTIVE' | 'EVALUATED' | 'CANCELLED';
  created_at: string; actual_occurred?: boolean | null; actual_fault_date?: string | null; outcome_notes?: string | null;
}

export interface RecurringIssue {
  id: string; issue_id: string; issue_type: string; title: string; description: string;
  location: string | null; mine_ids: string[]; occurrences: number; last_occurrence: string;
  frequency_trend: 'INCREASING' | 'STABLE' | 'DECREASING'; severity: RiskLevel;
  recurrence_risk: number; affected_records: string[]; created_at: string;
}

export interface ContributingFactor {
  factor: string; evidence: string;
  confidence: 'Likely cause' | 'Likely contributing factor' | 'Possible contributing factor' | 'Insufficient data';
}

export interface RootCauseAnalysis {
  issue_id: string; title: string; occurrences: number;
  contributing_factors: ContributingFactor[]; recommended_investigation: string; created_at: string;
}

export interface PreventiveAction {
  id: string; action_id: string; source_type: 'PREDICTION' | 'RECURRING_ISSUE'; source_id: string;
  title: string; description: string; responsible_role: string; deadline: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED'; priority: RiskLevel; created_at: string;
}

export interface PredictionOutcome {
  outcome_id: string; prediction_id: string; actual_occurred: boolean;
  actual_fault_date: string | null; notes: string | null; recorded_at: string;
}

export interface PredictionDashboard {
  summary: {
    total_active_predictions: number; high_risk_count: number; critical_count: number;
    medium_risk_count: number; low_risk_count: number; predicted_next_7d: number;
    predicted_next_30d: number; increasing_risk_assets: number; recurring_issues: number;
    preventive_actions_pending: number;
  };
  risk_by_category: Record<string, number>; risk_by_zone: Record<string, number>;
  risk_trend: { date: string; avg_risk: number; prediction_count: number }[];
}

export interface PredictionPerformance {
  total_evaluated: number; correct_predictions?: number; accuracy: number | null;
  predictions_total: number; predictions_active: number; predictions_evaluated: number;
  outcomes?: PredictionOutcome[]; message?: string;
}

export interface AggregateLiveData {
  complaints: Record<string, unknown>[]; inspections: Record<string, unknown>[];
  risk_assessments: Record<string, unknown>[]; corrective_actions: Record<string, unknown>[];
}
// ── HTTP helpers ───────────────────────────────────────────────
async function safeGet<T>(url: string, timeoutMs = 20000): Promise<T | null> {
  try { const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }); if (!res.ok) return null; return (await res.json()) as T; } catch { return null; }
}
async function safePost<T>(url: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
  try { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) }); if (!res.ok) return null; return (await res.json()) as T; } catch { return null; }
}
function severityWeight(sev: string | undefined): number { const s = String(sev ?? '').toLowerCase(); if (s.includes('crit')) return 3; if (s === 'high' || s === 'serious' || s === 'fatal') return 2; if (s === 'medium' || s === 'moderate') return 1; return 0.5; }
function openStatus(s: string | undefined): boolean { if (!s) return false; const t = s.toLowerCase(); return !['resolved', 'closed', 'verified', 'rejected', 'completed'].some((x) => t === x); }

export function aggregateLiveRisk(data: AggregateLiveData): Record<string, number> {
  const map: Record<string, number> = {};
  const bump = (key: string | null | undefined, pts: number) => { if (!key) return; const k = String(key).trim(); if (!k) return; map[k] = Math.min(100, (map[k] ?? 0) + pts); };
  (data.complaints ?? []).forEach((c) => { if (!openStatus(c.status as string)) return; bump(c.mine_id as string, 4 * severityWeight(c.severity as string)); if (c.zone) bump(c.zone as string, 3 * severityWeight(c.severity as string)); if (c.category) bump(`cat:${c.category}`, 2 * severityWeight(c.severity as string)); });
  (data.inspections ?? []).forEach((i) => { if (openStatus(i.status as string)) { bump(i.mine_id as string, 3 * severityWeight((i.severity ?? i.risk_level) as string)); if (i.zone) bump(i.zone as string, 3 * severityWeight((i.severity ?? i.risk_level) as string)); } });
  (data.risk_assessments ?? []).forEach((r) => { if (openStatus(r.status as string)) bump(r.mine_id as string, 5 * severityWeight(String(r.risk_level ?? r.severity))); });
  (data.corrective_actions ?? []).forEach((a) => { if (openStatus(a.status as string)) { bump(a.mine_id as string, 2); if (a.due_date && new Date(a.due_date as string).getTime() < Date.now()) bump(a.mine_id as string, 4); } });
  return map;
}

export function riskLevelFromScore(score: number): RiskLevel { if (score >= 70) return 'CRITICAL'; if (score >= 50) return 'HIGH'; if (score >= 30) return 'MEDIUM'; return 'LOW'; }
// ── Local persistence ──────────────────────────────────────────
const LS_PREFIX = 'smartmine_col_';
function localRead<T>(col: string): T[] { try { const raw = localStorage.getItem(`${LS_PREFIX}${col}`); return raw ? (JSON.parse(raw) as T[]) : []; } catch { return []; } }
function localWrite<T>(col: string, items: T[]): void { try { localStorage.setItem(`${LS_PREFIX}${col}`, JSON.stringify(items)); } catch { /* quota */ } }
function withId<T extends { id?: string }>(item: T): T & { id: string } { return { ...item, id: item.id || `pred_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }; }
async function persistCollection<T>(col: string, items: T[]): Promise<T[]> { const withIds = (items as { id?: string }[]).map(withId); localWrite(col, withIds); try { await fbInsertInto(col, withIds).run(); } catch { /* deferred */ } return withIds as T[]; }
async function readCollection<T>(col: string): Promise<T[]> { try { const { data } = await fb(col).select('*').run<T[]>(); return ((data ?? []) as T[]); } catch { return localRead<T>(col); } }

function categoryBreakdown(active: Prediction[]): Record<string, number> { const m: Record<string, number> = {}; active.forEach((p) => { m[p.asset_type] = (m[p.asset_type] ?? 0) + p.probability; }); return m; }
function zoneBreakdown(active: Prediction[]): Record<string, number> { const m: Record<string, number> = {}; active.forEach((p) => { const z = p.mine_id ?? p.asset_name; if (z) m[z] = Math.max(m[z] ?? 0, p.probability); }); return m; }
function recentTrend(active: Prediction[]): { date: string; avg_risk: number; prediction_count: number }[] {
  const now = Date.now(); const days: { date: string; risks: number[] }[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(now - i * 86400000); days.push({ date: d.toISOString().slice(0, 10), risks: [] }); }
  active.forEach((p) => { const d = String(p.created_at).slice(0, 10); const day = days.find((x) => x.date === d); if (day) day.risks.push(p.probability); });
  return days.map((d) => ({ date: d.date, avg_risk: d.risks.length ? Math.round((d.risks.reduce((a, b) => a + b, 0) / d.risks.length) * 10) / 10 : 0, prediction_count: d.risks.length }));
}
function mineNameFor(mid: string | null | undefined, live?: AggregateLiveData): string | null { if (!mid) return null; return live?.complaints?.find((c) => c.mine_id === mid)?.mine_name as string ?? mid; }
function liveContribution(p: any, lr?: Record<string, number>): number { if (!lr) return 0; let pts = 0; [p.asset_id, p.asset_name, p.mine_id].forEach((k) => { if (k && lr[String(k)]) pts = Math.max(pts, lr[String(k)]); }); return Math.round(pts); }
function deriveLivePredictions(live: AggregateLiveData, lr?: Record<string, number>): Prediction[] {
  const map = lr ?? aggregateLiveRisk(live); const now = new Date().toISOString();
  return Object.entries(map).filter(([, s]) => s >= 15).map(([key, score], i) => ({
    id: `PRED-LIVE-${i.toString().padStart(4, '0')}`, prediction_id: `PRED-LIVE-${i.toString().padStart(4, '0')}`,
    asset_id: key, asset_name: key, asset_type: 'mine_section' as const, mine_id: /^[A-Z]{1,4}\d+$/.test(key) ? key : null, mine_name: key,
    predicted_fault: 'Elevated risk from live operational records', probability: Math.round(score), risk_level: riskLevelFromScore(score),
    predicted_window: score >= 50 ? 'Next 7 days' : 'Next 30 days',
    contributing_factors: ['Derived from live data (ML server offline)'], historical_evidence: { live_risk_score: score },
    recommended_actions: ['Schedule inspection'], model_version: 'live_fallback_v1', prediction_status: 'ACTIVE' as const,
    created_at: now, actual_occurred: null, actual_fault_date: null, outcome_notes: null,
  }));
}
// ═══════════════════════════════════════════════════════════════
// PUBLIC SERVICE API
// ═══════════════════════════════════════════════════════════════
export const predictionService = {
  async generatePredictions(live?: AggregateLiveData): Promise<{ predictions: Prediction[]; from_ml: boolean }> {
    const ml = await safeGet<{ predictions: any[]; model_version?: string }>(`${ML_BASE}/predict/faults`);
    const lr = live ? aggregateLiveRisk(live) : undefined;
    let preds: Prediction[];
    if (ml?.predictions) {
      preds = ml.predictions.map((p) => ({ id: p.prediction_id, prediction_id: p.prediction_id, asset_id: p.asset_id ?? null, asset_name: p.asset_name ?? 'Unknown', asset_type: p.asset_type ?? 'equipment' as const, mine_id: p.mine_id ?? null, mine_name: mineNameFor(p.mine_id, live), predicted_fault: p.predicted_fault ?? 'General risk', probability: Math.min(100, Math.round(p.probability ?? 0) + liveContribution(p, lr)), risk_level: p.risk_level ?? riskLevelFromScore(p.probability ?? 0), predicted_window: p.predicted_window ?? 'Next 30 days', contributing_factors: p.contributing_factors ?? [], historical_evidence: p.historical_evidence ?? {}, recommended_actions: p.recommended_actions ?? [], model_version: p.model_version ?? 'rule_engine_v1', prediction_status: 'ACTIVE' as const, created_at: p.created_at ?? new Date().toISOString(), actual_occurred: null, actual_fault_date: null, outcome_notes: null }));
    } else {
      preds = deriveLivePredictions(live ?? { complaints: [], inspections: [], risk_assessments: [], corrective_actions: [] }, lr);
    }
    await persistCollection('predictions', preds);
    return { predictions: preds, from_ml: !!ml };
  },

  async getActivePredictions(): Promise<Prediction[]> { const all = await readCollection<Prediction>('predictions'); return all.filter((p) => p.prediction_status === 'ACTIVE').sort((a, b) => b.probability - a.probability); },

  async getPredictionsByAsset(assetId: string): Promise<Prediction[]> { const all = await readCollection<Prediction>('predictions'); return all.filter((p) => p.asset_id === assetId || p.asset_name === assetId); },

  async getPredictionHistory(): Promise<Prediction[]> { const all = await readCollection<Prediction>('predictions'); return all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); },

  async getRecurringIssues(): Promise<RecurringIssue[]> {
    const ml = await safeGet<{ issues: any[] }>(`${ML_BASE}/predict/recurring`);
    if (ml?.issues) {
      const issues = ml.issues.map((i) => withId<RecurringIssue>({ id: i.issue_id, issue_id: i.issue_id, issue_type: i.issue_type ?? 'RECURRING_INCIDENT', title: i.title ?? '', description: i.description ?? '', location: i.location ?? null, mine_ids: i.mine_ids ?? [], occurrences: i.occurrences ?? 0, last_occurrence: i.last_occurrence ?? 'Unknown', frequency_trend: i.frequency_trend ?? 'STABLE', severity: i.severity ?? 'MEDIUM', recurrence_risk: i.recurrence_risk ?? 0, affected_records: i.affected_records ?? [], created_at: i.created_at ?? new Date().toISOString() }));
      await persistCollection('recurring_issues', issues);
      return issues.sort((a, b) => b.recurrence_risk - a.recurrence_risk);
    }
    const stored = await readCollection<RecurringIssue>('recurring_issues');
    return stored.sort((a, b) => b.recurrence_risk - a.recurrence_risk);
  },

  async getRootCauses(): Promise<RootCauseAnalysis[]> {
    const ml = await safeGet<{ analyses: any[] }>(`${ML_BASE}/predict/root-cause`);
    if (ml?.analyses) return ml.analyses.map((a) => ({ issue_id: a.issue_id ?? '', title: a.title ?? '', occurrences: a.occurrences ?? 0, contributing_factors: a.contributing_factors ?? [], recommended_investigation: a.recommended_investigation ?? '', created_at: a.created_at ?? new Date().toISOString() }));
    const stored = await readCollection<RecurringIssue>('recurring_issues');
    return stored.map((s) => ({ issue_id: s.issue_id, title: s.title, occurrences: s.occurrences, contributing_factors: [{ factor: 'Pattern from aggregated data', evidence: `${s.occurrences} occurrences`, confidence: 'Possible contributing factor' as const }], recommended_investigation: `Investigate ${s.occurrences} recurring: "${s.title}"`, created_at: s.created_at }));
  },

  async getPreventiveActions(): Promise<PreventiveAction[]> {
    const ml = await safeGet<{ actions: any[] }>(`${ML_BASE}/predict/preventive`);
    if (ml?.actions) {
      const acts = ml.actions.map((a) => withId<PreventiveAction>({ id: a.action_id, action_id: a.action_id, source_type: a.source_type ?? 'PREDICTION', source_id: a.source_id ?? '', title: a.title ?? '', description: a.description ?? '', responsible_role: a.responsible_role ?? 'Safety Officer', deadline: a.deadline ?? new Date().toISOString(), status: a.status ?? 'PENDING', priority: a.priority ?? 'MEDIUM', created_at: a.created_at ?? new Date().toISOString() }));
      await persistCollection('preventive_actions', acts);
      return acts;
    }
    return readCollection<PreventiveAction>('preventive_actions');
  },

  async getDashboard(): Promise<PredictionDashboard | null> {
    const active = await this.getActivePredictions();
    const recurring = await readCollection<RecurringIssue>('recurring_issues');
    const actions = await readCollection<PreventiveAction>('preventive_actions');
    const ml = await safeGet<PredictionDashboard>(`${ML_BASE}/predict/dashboard`);
    return {
      summary: { total_active_predictions: active.length, high_risk_count: active.filter((p) => p.risk_level === 'HIGH').length, critical_count: active.filter((p) => p.risk_level === 'CRITICAL').length, medium_risk_count: active.filter((p) => p.risk_level === 'MEDIUM').length, low_risk_count: active.filter((p) => p.risk_level === 'LOW').length, predicted_next_7d: active.filter((p) => /3 days|7 days/.test(p.predicted_window)).length, predicted_next_30d: active.filter((p) => /14 days|30 days/.test(p.predicted_window)).length, increasing_risk_assets: active.filter((p) => p.probability >= 60).length, recurring_issues: recurring.length, preventive_actions_pending: actions.filter((a) => ['PENDING','ASSIGNED','IN_PROGRESS'].includes(a.status)).length },
      risk_by_category: ml?.risk_by_category ?? categoryBreakdown(active),
      risk_by_zone: ml?.risk_by_zone ?? zoneBreakdown(active),
      risk_trend: ml?.risk_trend ?? recentTrend(active),
    };
  },

  async recordOutcome(predictionId: string, actualOccurred: boolean, actualDate?: string, notes?: string): Promise<PredictionOutcome | null> {
    const outcome: PredictionOutcome = { outcome_id: `OUT-${Date.now().toString(36)}`.toUpperCase(), prediction_id: predictionId, actual_occurred: actualOccurred, actual_fault_date: actualDate ?? null, notes: notes ?? null, recorded_at: new Date().toISOString() };
    const all = await readCollection<Prediction>('predictions');
    const idx = all.findIndex((p) => p.prediction_id === predictionId || p.id === predictionId);
    if (idx >= 0) { all[idx] = { ...all[idx], prediction_status: 'EVALUATED', actual_occurred: actualOccurred, actual_fault_date: actualDate ?? null, outcome_notes: notes ?? null }; await persistCollection('predictions', all); try { await fbUpdateOf('predictions', all[idx]).eq('id', all[idx].id).run(); } catch { /* local */ } }
    await safePost(`${ML_BASE}/predict/outcomes`, { prediction_id: predictionId, actual_occurred: actualOccurred, actual_fault_date: actualDate ?? '', notes: notes ?? '' });
    return outcome;
  },

  async getPerformance(): Promise<PredictionPerformance | null> {
    const ml = await safeGet<PredictionPerformance>(`${ML_BASE}/predict/performance`);
    if (ml) return ml;
    const all = await readCollection<Prediction>('predictions');
    const evaluated = all.filter((p) => p.prediction_status === 'EVALUATED' && p.actual_occurred != null);
    if (evaluated.length === 0) return { total_evaluated: 0, accuracy: null, predictions_total: all.length, predictions_active: all.filter((p) => p.prediction_status === 'ACTIVE').length, predictions_evaluated: 0 };
    const correct = evaluated.filter((p) => p.actual_occurred === true).length;
    return { total_evaluated: evaluated.length, correct_predictions: correct, accuracy: Math.round((correct / evaluated.length) * 1000) / 10, predictions_total: all.length, predictions_active: all.filter((p) => p.prediction_status === 'ACTIVE').length, predictions_evaluated: evaluated.length };
  },

  async updatePreventiveAction(actionId: string, patch: Partial<PreventiveAction>): Promise<PreventiveAction[]> {
    const all = await readCollection<PreventiveAction>('preventive_actions');
    const idx = all.findIndex((a) => a.action_id === actionId || a.id === actionId);
    if (idx < 0) return all;
    all[idx] = { ...all[idx], ...patch, id: all[idx].id };
    await persistCollection('preventive_actions', all);
    try { await fbUpdateOf('preventive_actions', all[idx]).eq('id', all[idx].id).run(); } catch { /* local */ }
    return all;
  },
};

export default predictionService;
