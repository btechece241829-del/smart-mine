import React from 'react';
import { DatasetBundle } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { TrendingUp, Wrench } from 'lucide-react';

interface OperationsViewProps {
  data: DatasetBundle;
  selectedMineId: string;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  data,
  selectedMineId
}) => {
  const filteredTelemetry = selectedMineId === 'ALL'
    ? data.production
    : data.production.filter(p => p.mine_id === selectedMineId);

  const filteredEquipment = selectedMineId === 'ALL'
    ? data.equipment
    : data.equipment.filter(e => e.mine_id === selectedMineId);

  const totalTargetTonnes = filteredTelemetry.reduce((acc, p) => acc + (p.target_tonnes ?? p.production_target_t), 0);
  const totalActualTonnes = filteredTelemetry.reduce((acc, p) => acc + (p.actual_tonnes ?? p.actual_production_t), 0);
  const achievementPct = totalTargetTonnes > 0
    ? ((totalActualTonnes / totalTargetTonnes) * 100).toFixed(1)
    : 'N/A';

  const breakdownCount = filteredEquipment.filter(e => e.status === 'BREAKDOWN').length;
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-copper-light" />
            Operations & Heavy Equipment Fleet Governance
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Coal dispatch telemetry, production target tracking, and heavy machinery breakdown & health surveillance.
          </p>
        </div>
        <DemoSourceBadge source="production_telemetry.csv, equipment.csv" note="Handles CLOSED and DEVELOPING mine N/A states" />
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{totalTargetTonnes.toLocaleString()}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Target Production (T)</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-copper-light">{totalActualTonnes.toLocaleString()}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Actual Production (T)</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {achievementPct === 'N/A' ? 'N/A' : `${achievementPct}%`}
          </div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Production Achievement</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{breakdownCount}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Equipment Breakdowns</div>
        </div>
      </div>

      {/* Equipment Fleet Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
            <Wrench className="w-4 h-4 text-copper-light" />
            Heavy Equipment Fleet Health ({filteredEquipment.length})
          </h3>
          <span className="text-[10px] font-mono text-warm-slate">OPERATIONAL TELEMETRY</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Equipment Name / ID</th>
                <th className="p-2.5">Mine ID</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Health Score</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">24h Breakdown Hrs</th>
                <th className="p-2.5">Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredEquipment.map(eq => (
                <tr key={eq.equipment_id} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-medium text-warm-pale">
                    <div>{eq.equipment_name}</div>
                    <div className="text-[10px] font-mono text-warm-slate">{eq.equipment_id}</div>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{eq.mine_id}</td>
                  <td className="p-2.5 font-bold text-copper-light">{eq.equipment_type}</td>
                  <td className="p-2.5 font-mono font-bold">
                    <span className={eq.health_score < 70 ? 'text-rose-400' : 'text-emerald-400'}>
                      {eq.health_score}%
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      eq.status === 'BREAKDOWN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      eq.status === 'MAINTENANCE_DUE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      eq.status === 'IDLE' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {eq.status}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{eq.breakdown_hours_24h}h</td>
                  <td className="p-2.5 font-mono text-[10px] text-warm-slate">
                    {eq.latitude.toFixed(3)}, {eq.longitude.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

