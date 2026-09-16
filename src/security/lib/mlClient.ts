// ────────────────────────────────────────────────────────────────
// ML client — combines historical datasets (Python ML server :5001)
// with live runtime records from the offline-first firebaseDb layer.
// Predictions are ALWAYS a blend of datasets + live data; when the
// Python server is unreachable we fall back to a live-only estimate.
// ────────────────────────────────────────────────────────────────
const ML_BASE = 'http://localhost:5001/api';

export type RiskBand = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface LiveMineFeatures {
  complaint_count: number;
  open_complaints: number;
  critical_complaints: number;
  high_complaints: number;
  overdue_complaints: number;
  resolved_complaints: number;
  complaints_30d: number;
  critical_inspections: number;
  active_risk_alerts: number;
}

export interface LiveMine {
  mine_id: string;
  mine_name: string;
  features: LiveMineFeatures;
}

export interface CombinedPrediction {
  mine_id: string;
  mine_name: string;
  dataset_risk: number | null; // historical CSV datasets (public/data)
  live_risk: number;           // realtime records (complaints/inspections/alerts)
  predicted_risk: number;
  risk_band: RiskBand;
  sources: { dataset: number | null; live: number };
  contributors: Record<string, number>;
}

export interface CombinedPredictionResult {
  predictions: CombinedPrediction[];
  count: number;
  datasets_available: boolean;
  blend: { dataset: number; live: number };
}

/** Mirrors the Python weights (ml_server.py -> LIVE_FEATURE_WEIGHTS). */
export const LIVE_FEATURE_WEIGHTS: Record<keyof LiveMineFeatures, number> = {
  complaint_count: 0,
  open_complaints: 3,
  critical_complaints: 18,
  high_complaints: 9,
  overdue_complaints: 8,
  resolved_complaints: 0,
  complaints_30d: 2,
  critical_inspections: 12,
  active_risk_alerts: 25,
};

const OPEN_STATUSES = [
  'Submitted', 'Under Review', 'Assigned', 'Inspection Required', 'Action In Progress', 'Escalated',
];

export function computeLiveRisk(feats: Partial<LiveMineFeatures>): number {
  let raw = 0;
  (Object.keys(LIVE_FEATURE_WEIGHTS) as (keyof LiveMineFeatures)[]).forEach((k) => {
    raw += LIVE_FEATURE_WEIGHTS[k] * Math.max(0, feats[k] ?? 0);
  });
  const total = Math.max(0, feats.complaint_count ?? 0);
  const resolved = Math.max(0, feats.resolved_complaints ?? 0);
  if (total > 0) raw += (1 - Math.min(1, resolved / total)) * 15;
  return Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
}

export function riskBandFor(score: number): RiskBand {
  return score >= 70 ? 'Critical' : score >= 50 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
}

export interface AggregateLiveParams {
  mines: any[];
  complaints: any[];
  inspections: any[];
  riskAlerts: any[];
  scopeMineIds?: string[];
}
/**
 * Builds per-mine live feature vectors from the offline-first DB records.
 * Every mine in the `mines` collection is included; mine_ids that only
 * appear in records (complaints/inspections/alerts) are added too.
 */
export function aggregateLiveMines(p: AggregateLiveParams): LiveMine[] {
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 3600 * 1000;

  const emptyFeatures = (): LiveMineFeatures => ({
    complaint_count: 0,
    open_complaints: 0,
    critical_complaints: 0,
    high_complaints: 0,
    overdue_complaints: 0,
    resolved_complaints: 0,
    complaints_30d: 0,
    critical_inspections: 0,
    active_risk_alerts: 0,
  });

  const feats = new Map<string, LiveMineFeatures>();
  const nameById = new Map<string, string>();

  const ensure = (mineId: string | null | undefined) => {
    if (!mineId) return null;
    const mid = String(mineId).trim();
    if (!mid) return null;
    if (!feats.has(mid)) {
      feats.set(mid, emptyFeatures());
      nameById.set(mid, mid);
    }
    return feats.get(mid)!;
  };

  (p.mines ?? []).forEach((m: any) => {
    const mid = String((m && (m.id ?? m.mine_code ?? m.mine_id)) ?? '').trim();
    if (!mid) return;
    if (!feats.has(mid)) {
      feats.set(mid, emptyFeatures());
      nameById.set(mid, String(m.mine_name ?? m.name ?? m.mine_id ?? mid));
    }
  });

  (p.complaints ?? []).forEach((c: any) => {
    const f = ensure(c.mine_id);
    if (!f || c.is_archived === true) return;
    const status = c.status ?? '';
    const sev = String(c.severity ?? '').toLowerCase();
    f.complaint_count += 1;
    if (OPEN_STATUSES.includes(status)) {
      f.open_complaints += 1;
      if (c.due_date && new Date(c.due_date).getTime() < now) f.overdue_complaints += 1;
    }
    if (sev === 'critical') f.critical_complaints += 1;
    else if (sev === 'high') f.high_complaints += 1;
    if (status === 'Resolved' || status === 'Verified') f.resolved_complaints += 1;
    if (c.reported_at && new Date(c.reported_at).getTime() >= monthAgo) f.complaints_30d += 1;
  });

  (p.inspections ?? []).forEach((i: any) => {
    const f = ensure(i.mine_id);
    if (!f) return;
    const s = String(i.severity_assessment ?? i.severity ?? '').toLowerCase();
    if (s === 'critical' || s === 'high') f.critical_inspections += 1;
  });

  (p.riskAlerts ?? []).forEach((a: any) => {
    const f = ensure(a.mine_id);
    if (!f || a.is_active !== true) return;
    f.active_risk_alerts += 1;
  });

  let mines = [...feats.entries()].map(([mid, f]) => ({
    mine_id: mid,
    mine_name: nameById.get(mid) ?? mid,
    features: f,
  }));

  if (p.scopeMineIds && p.scopeMineIds.length) {
    const scope = new Set(p.scopeMineIds.map((s) => String(s).trim()));
    mines = mines.filter((m) => scope.has(m.mine_id));
  }

  mines.sort((a, b) => a.mine_id.localeCompare(b.mine_id));
  return mines;
}

async function postJson<T>(url: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCombinedPredictions(live: { mines: LiveMine[] }): Promise<CombinedPredictionResult | null> {
  return postJson<CombinedPredictionResult>(`${ML_BASE}/predict/combined`, { live });
}

/** Offline fallback — live-data-only estimate when the Python ML server is down. */
export function localFallbackPrediction(live: LiveMine): CombinedPrediction {
  const liveRisk = computeLiveRisk(live.features);
  return {
    mine_id: live.mine_id,
    mine_name: live.mine_name,
    dataset_risk: null,
    live_risk: liveRisk,
    predicted_risk: liveRisk,
    risk_band: riskBandFor(liveRisk),
    sources: { dataset: null, live: liveRisk },
    contributors: { ...live.features },
  };
}