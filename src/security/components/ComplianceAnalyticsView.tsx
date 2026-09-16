// ────────────────────────────────────────────────────────────────
// Compliance Analytics — charts and stats for mine manager / super admin
// Includes ML Risk Prediction built on datasets + live runtime data.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, Cpu, Database, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { computeStats, SEVERITY_COLORS, STATUS_COLORS } from '../lib/analytics';
import {
  aggregateLiveMines, fetchCombinedPredictions, localFallbackPrediction,
  CombinedPrediction, RiskBand,
} from '../lib/mlClient';
import { fb } from '../lib/firebaseDb';
import { Complaint, DashboardStats } from '../lib/types';
import { Card, Spinner } from './ui/primitives';

const BAND_BADGE: Record<RiskBand, string> = {
  Low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
  Moderate: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
  High: 'text-orange-400 bg-orange-500/15 border-orange-500/40',
  Critical: 'text-rose-400 bg-rose-500/20 border-rose-500/50',
};

const BAND_BAR: Record<RiskBand, string> = {
  Low: '#059669',
  Moderate: '#d97706',
  High: '#ea580c',
  Critical: '#e11d48',
};

export const ComplianceAnalyticsView: React.FC = () => {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<CombinedPrediction[] | null>(null);
  const [mlOnline, setMlOnline] = useState(false);
  const [datasetsAvailable, setDatasetsAvailable] = useState(false);
  const [predLoading, setPredLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      setLoading(true);
      const list = await complaintsService.list({ mineId: profile.mine_id ?? undefined });
      setStats(computeStats(list));
      setLoading(false);
    };
    load();
  }, [profile]);

  // ML prediction = historical datasets (Python ML server) + live runtime records.
  const loadPredictions = useCallback(async () => {
    setPredLoading(true);
    try {
      const [mineRes, compRes, inspRes, alertRes] = await Promise.all([
        fb('mines').select('*').run<any[]>(),
        fb('complaints').select('*').run<any[]>(),
        fb('inspections').select('*').run<any[]>(),
        fb('risk_alerts').select('*').run<any[]>(),
      ]);
      const scopeMineIds =
        role !== 'super_admin' && profile?.mine_id ? [profile.mine_id] : undefined;
      const liveMines = aggregateLiveMines({
        mines: mineRes?.data ?? [],
        complaints: compRes?.data ?? [],
        inspections: inspRes?.data ?? [],
        riskAlerts: alertRes?.data ?? [],
        scopeMineIds,
      });
      if (liveMines.length === 0) {
        setPredictions([]);
        setMlOnline(false);
        setDatasetsAvailable(false);
        return;
      }
      const res = await fetchCombinedPredictions({ mines: liveMines });
      if (res) {
        setPredictions(res.predictions);
        setDatasetsAvailable(res.datasets_available);
        setMlOnline(true);
      } else {
        // ML server offline → live-data-only estimate (local fallback).
        setPredictions(liveMines.map(localFallbackPrediction));
        setDatasetsAvailable(false);
        setMlOnline(false);
      }
    } catch {
      setPredictions([]);
      setMlOnline(false);
      setDatasetsAvailable(false);
    } finally {
      setPredLoading(false);
    }
  }, [profile, role]);

  useEffect(() => {
    if (!profile) return;
    loadPredictions();
  }, [loadPredictions, profile]);

  // Live data changed (local insert / Firestore sync / broadcast) → refresh.
  useEffect(() => {
    const handler = () => loadPredictions();
    window.addEventListener('smartmine_db_change', handler);
    return () => window.removeEventListener('smartmine_db_change', handler);
  }, [loadPredictions]);

  if (loading) return <Spinner size="lg" label="Loading analytics..." />;
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-copper-light" />
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">Compliance Analytics</h1>
          <p className="text-xs text-warm-slate">Overview of complaint resolution and compliance metrics</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4">
          <div className="text-[11px] text-warm-slate font-mono uppercase">Total Issues</div>
          <div className="text-2xl font-extrabold text-copper-light">{stats.total}</div>
        </div>
        <div className="bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4">
          <div className="text-[11px] text-warm-slate font-mono uppercase">Compliance Rate</div>
          <div className="text-2xl font-extrabold text-emerald-400">{stats.compliancePct}%</div>
        </div>
        <div className="bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4">
          <div className="text-[11px] text-warm-slate font-mono uppercase">Avg Resolution</div>
          <div className="text-2xl font-extrabold text-sky-400">{stats.avgResolutionHours}h</div>
        </div>
        <div className="bg-carbon-800/70 border border-carbon-700/60 rounded-xl p-4">
          <div className="text-[11px] text-warm-slate font-mono uppercase">Overdue</div>
          <div className="text-2xl font-extrabold text-rose-400">{stats.overdue}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Issues by Category">
          {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs mb-2">
              <span className="w-32 text-warm-slate text-right truncate">{k}</span>
              <div className="flex-1 h-4 bg-carbon-850 rounded-full overflow-hidden">
                <div className="h-full bg-copper/60 rounded-full" style={{ width: `${(v / Math.max(...Object.values(stats.byCategory), 1)) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-mono font-bold text-warm-pale">{v}</span>
            </div>
          ))}
        </Card>

        <Card title="Issues by Severity">
          {Object.entries(stats.bySeverity).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
            const colorClass = SEVERITY_COLORS[k as keyof typeof SEVERITY_COLORS] ?? 'text-warm-slate';
            return (
              <div key={k} className="flex items-center gap-2 text-xs mb-2">
                <span className="w-20 text-right font-semibold" style={{ color: k === 'Critical' ? '#fb7185' : k === 'High' ? '#fb923c' : k === 'Medium' ? '#facc15' : '#34d399' }}>{k}</span>
                <div className="flex-1 h-4 bg-carbon-850 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(v / Math.max(...Object.values(stats.bySeverity), 1)) * 100}%`,
                    backgroundColor: k === 'Critical' ? '#e11d48' : k === 'High' ? '#ea580c' : k === 'Medium' ? '#d97706' : '#059669',
                  }} />
                </div>
                <span className="w-8 text-right font-mono font-bold text-warm-pale">{v}</span>
              </div>
            );
          })}
        </Card>
      </div>

      <Card title="Monthly Trend">
        <div className="flex items-end gap-2 h-32">
          {Object.entries(stats.byMonth).sort().map(([k, v]) => {
            const max = Math.max(...Object.values(stats.byMonth), 1);
            return (
              <div key={k} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono text-warm-pale">{v}</span>
                <div className="w-full bg-copper/40 rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: 4 }} />
                <span className="text-[8px] font-mono text-warm-slate/60 truncate">{k}</span>
              </div>
            );
          })}
        </div>
      </Card>
    {/* ML Risk Prediction — datasets + live data */}
      <Card
        title="ML Risk Prediction — Datasets + Live Data"
        subtitle="Predicted risk per mine blends historical datasets (public/data CSVs) with live records (complaints, inspections, risk alerts)."
        icon={<Cpu className="w-4 h-4 text-copper-light" />}
        actions={
          <button
            onClick={loadPredictions}
            className="p-1.5 rounded bg-carbon-800 border border-carbon-700 text-warm-sand hover:text-copper-light transition-colors"
            title="Refresh predictions"
          >
            <RefreshCw className={`w-4 h-4 ${predLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {mlOnline ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
              <Database className="w-3 h-3 inline mr-1" />
              ML Server Online — {datasetsAvailable ? 'Datasets + Live' : 'Live Only'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40">
              <WifiOff className="w-3 h-3 inline mr-1" />
              ML Server Offline — Live-Data Estimate
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/40">
            50% Dataset · 50% Live
          </span>
        </div>

        {predLoading ? (
          <Spinner size="lg" label="Computing predictions..." />
        ) : !predictions || predictions.length === 0 ? (
          <p className="text-xs text-warm-slate text-center py-6">
            No mine data available for prediction yet. Upload datasets in the Data Hub or report issues to see predictions.
          </p>
        ) : (
          <div className="space-y-2">
            {predictions.map((p) => {
              const top = Object.entries(p.contributors)
                .filter(([, v]) => (v as number) > 0)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 3)
                .map(([k, v]) => ({ k: k.replace(/_/g, ' '), v: v as number }));
              return (
                <div key={p.mine_id} className="bg-carbon-900 border border-carbon-700/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-warm-pale truncate">{p.mine_name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{p.mine_id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono font-extrabold text-white">{p.predicted_risk}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${BAND_BADGE[p.risk_band]}`}>
                        {p.risk_band}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-carbon-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, p.predicted_risk)}%`, backgroundColor: BAND_BAR[p.risk_band] }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-warm-slate flex-wrap gap-1">
                    <span>
                      Dataset risk: <b className="text-copper-light">{p.sources.dataset ?? '—'}</b>
                    </span>
                    <span>
                      Live risk: <b className="text-sky-300">{p.sources.live}</b>
                    </span>
                    {top.length > 0 && (
                      <span className="text-warm-slate/70">
                        Drivers: {top.map((t) => `${t.k} ${t.v}`).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
