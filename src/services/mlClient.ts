// ML Client Service — communicates with the Python Flask ML server on :5001
const ML_BASE = 'http://localhost:5001/api';

export interface MineRiskResult {
  mine_id: string;
  mine_name: string;
  overall_risk: number;
  risk_band: 'Low' | 'Moderate' | 'High' | 'Critical';
  compliance_risk: number;
  compliance_score: number;
  safety_risk: number;
  environment_risk: number;
  equipment_risk: number;
  contractor_risk: number;
  operations_risk: number;
  open_critical_violations: number;
  severe_incidents: number;
  env_exceedances: number;
  breakdowns: number;
  avg_equipment_health: number;
  avg_production_achievement: number;
  expired_worker_fitness: number;
}

export interface AnomalyDetection {
  index: number;
  is_anomaly: boolean;
  anomaly_score: number;
}

export interface AnomalyResult {
  dataset: string;
  anomaly_count: number;
  total: number;
  detections: AnomalyDetection[];
}

export interface UploadResult {
  filename: string;
  rows: number;
  columns: string[];
  numeric: string[];
  stats: Record<string, { mean: number; std: number; min: number; max: number }>;
  anomaly_count: number;
  anomalies: AnomalyDetection[];
}

export interface MLHealthStatus {
  status: string;
  service: string;
  time: string;
  sklearn: boolean;
}

async function safeFetch<T>(url: string, opts?: RequestInit, timeoutMs = 10000): Promise<T | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function fetchMLHealth(): Promise<MLHealthStatus | null> {
  return safeFetch<MLHealthStatus>(`${ML_BASE}/health`);
}

export async function fetchMLRiskScores(): Promise<{ mines: MineRiskResult[]; count: number } | null> {
  return safeFetch<{ mines: MineRiskResult[]; count: number }>(`${ML_BASE}/risk`);
}

export async function fetchAnomalies(dataset: 'sensor' | 'environment' = 'sensor', mineId?: string): Promise<AnomalyResult | null> {
  const params = new URLSearchParams({ dataset });
  if (mineId && mineId !== 'ALL') params.set('mine_id', mineId);
  return safeFetch<AnomalyResult>(`${ML_BASE}/anomalies?${params}`);
}

export async function uploadDatasetForML(file: File): Promise<UploadResult | null> {
  const form = new FormData();
  form.append('file', file);
  return safeFetch<UploadResult>(`${ML_BASE}/upload`, { method: 'POST', body: form }, 30000);
}
