import React, { useState } from 'react';
import { DatasetBundle } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { Leaf, Wind } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface EnvironmentViewProps {
  data: DatasetBundle;
  selectedMineId: string;
}

export const EnvironmentView: React.FC<EnvironmentViewProps> = ({
  data,
  selectedMineId
}) => {
  const [paramFilter, setParamFilter] = useState<string>('ALL');

  const items = selectedMineId === 'ALL'
    ? data.environmentReadings
    : data.environmentReadings.filter(e => e.mine_id === selectedMineId);

  const filteredItems = items.filter(e => paramFilter === 'ALL' || e.parameter === paramFilter);

  const exceedances = items.filter(e => e.compliance_status === 'EXCEEDED');
  const normalReadings = items.filter(e => e.compliance_status === 'NORMAL');

  const stationAggMap: Record<string, { station: string; avgValue: number; count: number }> = {};
  filteredItems.forEach(item => {
    if (!stationAggMap[item.station_id]) {
      stationAggMap[item.station_id] = { station: item.station_id, avgValue: 0, count: 0 };
    }
    stationAggMap[item.station_id].avgValue += item.value;
    stationAggMap[item.station_id].count += 1;
  });

  const chartData = Object.values(stationAggMap).map(s => ({
    station: s.station,
    avgValue: Number((s.avgValue / s.count).toFixed(1))
  }));
  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-400" />
            Environmental Compliance & Monitoring Intelligence
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Real-time environmental surveillance for Ambient Air Quality (PM2.5, PM10, SO2, NO2), Water Discharge pH & Noise Levels.
          </p>
        </div>
        <DemoSourceBadge source="env_monitoring.csv" note="Simulated sensor station readings" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{items.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Total Monitoring Logs</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">{normalReadings.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Compliant Within Limits</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{exceedances.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Parameter Exceedances</div>
        </div>
      </div>

      {/* Filter & Bar Chart */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
            <Wind className="w-4 h-4 text-copper-light" />
            Station Parameter Averages
          </h3>
          <select
            value={paramFilter}
            onChange={(e) => setParamFilter(e.target.value)}
            className="bg-carbon-900 border border-carbon-700 rounded px-2.5 py-1 text-xs text-warm-sand outline-none font-mono"
          >
            <option value="ALL">All Parameters</option>
            <option value="PM2.5">PM2.5</option>
            <option value="PM10">PM10</option>
            <option value="SO2">SO2</option>
            <option value="NO2">NO2</option>
            <option value="Noise">Noise</option>
            <option value="Water_pH">Water pH</option>
          </select>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="station" stroke="#727976" fontSize={11} />
              <YAxis stroke="#727976" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#17100E', borderColor: 'rgba(212,180,163,0.3)', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="avgValue" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exceedance Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <h3 className="text-sm font-bold text-warm-pale">Environmental Logs Table ({filteredItems.length})</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Reading ID & Station</th>
                <th className="p-2.5">Mine ID</th>
                <th className="p-2.5">Parameter</th>
                <th className="p-2.5">Recorded Value</th>
                <th className="p-2.5">Statutory Limit</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Exceedance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredItems.map(item => (
                <tr key={item.reading_id} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-mono text-warm-pale">
                    <div>{item.reading_id}</div>
                    <div className="text-[10px] text-warm-slate">{item.station_id}</div>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{item.mine_id}</td>
                  <td className="p-2.5 font-bold text-copper-light">{item.parameter}</td>
                  <td className="p-2.5 font-mono font-bold text-white">{item.value} {item.unit}</td>
                  <td className="p-2.5 font-mono text-warm-slate">{item.prescribed_limit} {item.unit}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.compliance_status === 'EXCEEDED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {item.compliance_status}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">
                    {item.exceedance_pct > 0 ? `+${item.exceedance_pct}%` : '0%'}
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

