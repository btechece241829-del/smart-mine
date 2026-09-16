import React from 'react';
import { motion } from 'framer-motion';
import {
  DerivedMineMetrics,
  DatasetBundle,
  RuleDerivedAlert
} from '../../types/minegov';
import { KPICard } from '../common/KPICard';
import { RiskBadge } from '../common/RiskBadge';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { GISMap } from '../gis/GISMap';
import {
  ShieldAlert,
  FileCheck2,
  BellRing,
  AlertTriangle,
  ClipboardCheck,
  TrendingUp,
  Leaf,
  Wrench,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface CommandCenterViewProps {
  metrics: DerivedMineMetrics[];
  data: DatasetBundle;
  alerts: RuleDerivedAlert[];
  selectedMineId: string;
  onSelectMine: (mineId: string) => void;
  onNavigateView: (view: any) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  metrics,
  data,
  alerts,
  selectedMineId,
  onSelectMine,
  onNavigateView
}) => {
  // Aggregate KPIs
  const totalMines = metrics.length;
  const avgRisk = totalMines > 0
    ? (metrics.reduce((acc, m) => acc + m.domainRisk.overallRisk, 0) / totalMines).toFixed(1)
    : '0';

  const avgComplianceScore = totalMines > 0
    ? (metrics.reduce((acc, m) => acc + m.complianceScore, 0) / totalMines).toFixed(1)
    : '0';

  const criticalAlertsCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const totalOpenViolations = metrics.reduce((acc, m) => acc + m.openViolations, 0);
  const totalOverdueCAPA = metrics.reduce((acc, m) => acc + m.overdueCAPA, 0);

  const operatingMines = metrics.filter(m => m.mine.operational_status === 'OPERATING');
  const avgProductionAch = operatingMines.length > 0
    ? (operatingMines.reduce((acc, m) => acc + (isNaN(m.avgProductionAchievement) ? 0 : m.avgProductionAchievement), 0) / operatingMines.length).toFixed(1)
    : 'N/A';

  const envExceedanceCount = data.environmentReadings.filter(e => e.compliance_status === 'EXCEEDED').length;

  const avgEquipHealth = data.equipment.length > 0
    ? (data.equipment.reduce((acc, e) => acc + e.health_score, 0) / data.equipment.length).toFixed(1)
    : '100';

  const sortedRiskMines = [...metrics].sort(
    (a, b) => b.domainRisk.overallRisk - a.domainRisk.overallRisk
  );

  const domainRiskChartData = totalMines > 0
    ? [
        { domain: 'Safety',      risk: (metrics.reduce((s, m) => s + m.domainRisk.safetyRisk, 0) / totalMines) },
        { domain: 'Compliance',  risk: (metrics.reduce((s, m) => s + m.domainRisk.complianceRisk, 0) / totalMines) },
        { domain: 'Environment', risk: (metrics.reduce((s, m) => s + m.domainRisk.environmentRisk, 0) / totalMines) },
        { domain: 'Equipment',   risk: (metrics.reduce((s, m) => s + m.domainRisk.equipmentRisk, 0) / totalMines) },
        { domain: 'Contractor',  risk: (metrics.reduce((s, m) => s + m.domainRisk.contractorRisk, 0) / totalMines) },
        { domain: 'Operations',  risk: (metrics.reduce((s, m) => s + m.domainRisk.operationsRisk, 0) / totalMines) },
      ].map(d => ({ ...d, risk: parseFloat(d.risk.toFixed(1)) }))
    : [];

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Title & Lineage */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Enterprise Governance Command Center
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Real-time compliance intelligence, risk prioritization & statutory surveillance across {totalMines} coal mines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoSourceBadge source="13 CSV DATA LAYER" note="No hardcoded KPIs - All values calculated live" />
        </div>
      </div>

      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <KPICard
          index={0}
          title="Avg Prioritization Risk"
          value={`${avgRisk}/100`}
          subtext={`Across ${totalMines} monitored mines`}
          icon={ShieldAlert}
          statusColor={Number(avgRisk) >= 50 ? 'red' : 'amber'}
          onClick={() => onNavigateView('safety_ai')}
        />
        <KPICard
          index={1}
          title="Overall Compliance Score"
          value={`${avgComplianceScore}%`}
          subtext="Statutory weighted compliance"
          icon={FileCheck2}
          statusColor={Number(avgComplianceScore) >= 80 ? 'green' : 'amber'}
          onClick={() => onNavigateView('compliance')}
        />
        <KPICard
          index={2}
          title="Critical Alerts"
          value={criticalAlertsCount}
          subtext="Immediate action required"
          icon={BellRing}
          statusColor={criticalAlertsCount > 0 ? 'red' : 'green'}
          onClick={() => onNavigateView('alerts_escalation')}
        />
        <KPICard
          index={3}
          title="Open Violations"
          value={totalOpenViolations}
          subtext="Statutory inspection gaps"
          icon={AlertTriangle}
          statusColor={totalOpenViolations > 5 ? 'orange' : 'amber'}
          onClick={() => onNavigateView('inspections_capa')}
        />
        <KPICard
          index={4}
          title="Overdue CAPA"
          value={totalOverdueCAPA}
          subtext="Corrective actions overdue"
          icon={ClipboardCheck}
          statusColor={totalOverdueCAPA > 0 ? 'red' : 'green'}
          onClick={() => onNavigateView('inspections_capa')}
        />
        <KPICard
          index={5}
          title="Production Achievement"
          value={avgProductionAch === 'N/A' ? 'N/A' : `${avgProductionAch}%`}
          subtext="Operating mines performance"
          icon={TrendingUp}
          statusColor="amber"
          onClick={() => onNavigateView('operations')}
        />
      </div>

      {/* Main Grid: Mine Risk Ranking Table + Mini GIS Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mine Risk Ranking Table (2 cols) */}
        <div className="lg:col-span-2 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
              Mine Governance & Risk Ranking
              <span className="text-xs font-mono text-warm-slate">({totalMines} Mines)</span>
            </h3>
            <button
              onClick={() => onNavigateView('safety-ai')}
              className="text-xs text-copper-light hover:underline flex items-center gap-1 font-mono"
            >
              Full Risk Details <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                <tr>
                  <th className="p-2.5">Mine Name / ID</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Compliance Score</th>
                  <th className="p-2.5">Open Vio / CAPA</th>
                  <th className="p-2.5">Prioritization Risk</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-800">
                {sortedRiskMines.map((m) => (
                  <tr
                    key={m.mine.mine_id}
                    className={`hover:bg-carbon-800/80 transition-colors ${
                      m.mine.mine_id === selectedMineId ? 'bg-copper/10 border-l-2 border-copper' : ''
                    }`}
                  >
                    <td className="p-2.5 font-medium text-warm-pale">
                      <div>{m.mine.mine_name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{m.mine.mine_id} • {m.mine.subsidiary}</div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        m.mine.operational_status === 'OPERATING' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        m.mine.operational_status === 'DEVELOPING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                      }`}>
                        {m.mine.operational_status}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-semibold">
                      <span className={m.complianceScore < 70 ? 'text-rose-400' : 'text-emerald-400'}>
                        {m.complianceScore}%
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-warm-sand">
                      {m.openViolations} Vio / {m.overdueCAPA} CAPA
                    </td>
                    <td className="p-2.5">
                      <RiskBadge score={m.domainRisk.overallRisk} band={m.domainRisk.riskBand} size="sm" />
                    </td>
                    <td className="p-2.5">
                      <button
                        onClick={() => onSelectMine(m.mine.mine_id)}
                        className="px-2 py-1 rounded bg-carbon-800 hover:bg-copper hover:text-white border border-carbon-700 text-[11px] transition-colors"
                      >
                        Focus Mine
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Mini GIS Map (1 col) */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-warm-pale">GIS Spatial Overview</h3>
            <button
              onClick={() => onNavigateView('gis')}
              className="text-xs text-copper-light hover:underline font-mono flex items-center gap-1"
            >
              Expand GIS <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <GISMap
            mines={data.mines}
            inspections={data.inspections}
            violations={data.violations}
            incidents={data.incidents}
            selectedMineId={selectedMineId}
            onSelectMine={onSelectMine}
            height="360px"
          />
        </div>
      </div>

      {/* Secondary Grid: Domain Risk Breakdown & AI Priority Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Domain Risk Distribution Bar Chart */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <h3 className="text-sm font-bold text-warm-pale">Domain Risk Breakdown Across Monitored Fleet</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainRiskChartData}>
                <XAxis dataKey="domain" stroke="#727976" fontSize={11} />
                <YAxis stroke="#727976" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#17100E', borderColor: 'rgba(212,180,163,0.3)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="risk" fill="#9E5839" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Priority Findings Feed */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-copper-light" />
              AI Risk Priority Findings
            </h3>
            <span className="text-[10px] font-mono text-warm-slate">RULE-DERIVED FACT TRUTH</span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {sortedRiskMines[0]?.domainRisk.topDrivers.map((driver, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-carbon-900 border border-carbon-700/60 flex items-start gap-3"
              >
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                  driver.impact === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                }`}>
                  {driver.impact}
                </span>
                <div>
                  <div className="text-xs font-semibold text-warm-pale">{driver.domain} Risk Driver</div>
                  <div className="text-xs text-warm-sand/80 mt-0.5">{driver.factor}</div>
                </div>
              </div>
            ))}
            {data.sensorReadings.filter(s => s.status === 'CRITICAL').slice(0, 2).map((s, idx) => (
              <div key={`sensor-${idx}`} className="p-2.5 rounded-lg bg-carbon-900 border border-rose-500/30 flex items-start gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  TELEMETRY
                </span>
                <div>
                  <div className="text-xs font-semibold text-warm-pale">Sensor Anomaly Exceedance</div>
                  <div className="text-xs text-warm-sand/80 mt-0.5">
                    Sensor {s.sensor_id} in {s.zone} ({s.mine_id}) read {s.value} {s.unit} (Anomaly Score: {(s.anomaly_score * 100).toFixed(0)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

