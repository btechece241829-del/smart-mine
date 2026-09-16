import React, { useMemo } from 'react';
import { DerivedMineMetrics, DatasetBundle, SubsidiaryMetrics } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { Building2, TrendingUp, ShieldCheck, Boxes, Layers, Gauge } from 'lucide-react';

interface SubsidiaryComparativeViewProps {
  data: DatasetBundle;
  metrics: DerivedMineMetrics[];
  selectedMineId: string;
}

function computeSubsidiaryMetrics(data: DatasetBundle, metrics: DerivedMineMetrics[]): SubsidiaryMetrics[] {
  const subsidiaries = [...new Set(data.mines.map(m => m.subsidiary))];
  return subsidiaries.map(s => {
    const mines = data.mines.filter(m => m.subsidiary === s);
    const mineIds = new Set(mines.map(m => m.mine_id));
    const subsMetrics = metrics.filter(m => mineIds.has(m.mine.mine_id));
    const violations = data.violations.filter(v => mineIds.has(v.mine_id)).length;
    const incidents = data.incidents.filter(i => mineIds.has(i.mine_id)).length;
    const overdueCapa = data.correctiveActions.filter(c => mineIds.has(c.mine_id) && c.status === 'OVERDUE').length;
    const avgRisk = subsMetrics.length ? Math.round(subsMetrics.reduce((a, m) => a + m.domainRisk.overallRisk, 0) / subsMetrics.length) : 0;
    const avgComp = subsMetrics.length ? Math.round(subsMetrics.reduce((a, m) => a + m.complianceScore, 0) / subsMetrics.length) : 100;
    const avgEqHealth = subsMetrics.length ? Math.round(subsMetrics.reduce((a, m) => a + m.avgEquipmentHealth, 0) / subsMetrics.length) : 85;
    const riskBand: SubsidiaryMetrics['risk_band'] = avgRisk >= 70 ? 'Critical' : avgRisk >= 50 ? 'High' : avgRisk >= 30 ? 'Moderate' : 'Low';
    return {
      subsidiary: s, mine_count: mines.length, mine_names: mines.map(m => m.mine_name),
      avg_risk_score: avgRisk, avg_compliance_score: avgComp,
      total_violations: violations, total_incidents: incidents, total_overdue_capa: overdueCapa,
      avg_equipment_health: avgEqHealth, risk_band: riskBand,
    };
  }).sort((a, b) => b.avg_risk_score - a.avg_risk_score);
}

const bandColor = (band: string) =>
  band === 'Critical' ? 'text-rose-400 bg-rose-500/20 border-rose-500/30' :
  band === 'High' ? 'text-orange-400 bg-orange-500/20 border-orange-500/30' :
  band === 'Moderate' ? 'text-amber-400 bg-amber-500/20 border-amber-500/30' :
  'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';

export const SubsidiaryComparativeView: React.FC<SubsidiaryComparativeViewProps> = ({ data, metrics }) => {
  const subs = useMemo(() => computeSubsidiaryMetrics(data, metrics), [data, metrics]);
  const maxRisk = Math.max(...subs.map(s => s.avg_risk_score), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Layers className="w-6 h-6 text-copper-light" />
            Cross-Subsidiary Governance Comparison
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Scalable enterprise portfolio view benchmarking risk, compliance, safety, and operational health across every subsidiary and its constituent mines.
          </p>
        </div>
        <DemoSourceBadge source="01_mines.csv + All Metric Layers" note="Multi-Subsidiary Enterprise Portfolio" />
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{subs.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Subsidiaries</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{data.mines.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Total Mines Deployed</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-copper-light">
            {subs.length ? Math.round(subs.reduce((a, s) => a + s.avg_risk_score, 0) / subs.length) : 0}
          </div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Fleet Avg Risk</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {subs.length ? Math.round(subs.reduce((a, s) => a + s.avg_compliance_score, 0) / subs.length) : 100}%
          </div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Fleet Avg Compliance</div>
        </div>
      </div>

      {/* Subsidiary Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {subs.map(sub => (
          <div key={sub.subsidiary} className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-copper/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-copper-light" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{sub.subsidiary}</div>
                  <div className="text-[10px] text-warm-slate font-mono">{sub.mine_count} mines • {sub.mine_names.join(', ')}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${bandColor(sub.risk_band)}`}>{sub.risk_band}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-carbon-900 p-2.5 rounded-lg border border-carbon-700/50">
                <div className="flex items-center gap-1 text-[10px] text-warm-slate"><Gauge className="w-3 h-3" /> Risk Score</div>
                <div className="text-lg font-bold font-mono text-white">{sub.avg_risk_score}/100</div>
              </div>
              <div className="bg-carbon-900 p-2.5 rounded-lg border border-carbon-700/50">
                <div className="flex items-center gap-1 text-[10px] text-warm-slate"><ShieldCheck className="w-3 h-3" /> Compliance</div>
                <div className="text-lg font-bold font-mono text-emerald-400">{sub.avg_compliance_score}%</div>
              </div>
              <div className="bg-carbon-900 p-2.5 rounded-lg border border-carbon-700/50">
                <div className="flex items-center gap-1 text-[10px] text-warm-slate"><TrendingUp className="w-3 h-3" /> Violations</div>
                <div className="text-lg font-bold font-mono text-rose-400">{sub.total_violations}</div>
              </div>
              <div className="bg-carbon-900 p-2.5 rounded-lg border border-carbon-700/50">
                <div className="flex items-center gap-1 text-[10px] text-warm-slate"><Boxes className="w-3 h-3" /> Incidents</div>
                <div className="text-lg font-bold font-mono text-amber-400">{sub.total_incidents}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-warm-slate font-mono">RELATIVE RISK vs FLEET MAX</span>
                <span className="font-mono font-bold text-white">{sub.avg_risk_score}</span>
              </div>
              <div className="h-2.5 bg-carbon-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${sub.risk_band === 'Critical' ? 'bg-rose-500' : sub.risk_band === 'High' ? 'bg-orange-500' : sub.risk_band === 'Moderate' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${maxRisk ? (sub.avg_risk_score / maxRisk) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-warm-slate font-mono">
                <span>Overdue CAPA: {sub.total_overdue_capa}</span>
                <span>Equip Health: {sub.avg_equipment_health}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

