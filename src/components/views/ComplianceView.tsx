import React, { useState } from 'react';
import { DatasetBundle, DerivedMineMetrics } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { Search, Filter, ShieldCheck, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';

interface ComplianceViewProps {
  data: DatasetBundle;
  metrics: DerivedMineMetrics[];
  selectedMineId: string;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  data,
  metrics,
  selectedMineId
}) => {
  const [search, setSearch] = useState('');
  const [authorityFilter, setAuthorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter compliance records by selectedMineId
  const items = selectedMineId === 'ALL'
    ? data.compliances
    : data.compliances.filter(c => c.mine_id === selectedMineId);

  const filteredItems = items.filter(item => {
    const matchesSearch =
      (item.item_name ?? item.regulation_name).toLowerCase().includes(search.toLowerCase()) ||
      item.authority.toLowerCase().includes(search.toLowerCase()) ||
      (item.statutory_reference ?? item.source_rule_reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesAuth = authorityFilter === 'ALL' || item.authority === authorityFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesAuth && matchesStatus;
  });

  const totalApplicable = items.filter(i => i.status !== 'NOT_APPLICABLE').length;
  const compliantCount = items.filter(i => i.status === 'COMPLIANT').length;
  const dueSoonCount = items.filter(i => i.status === 'DUE_SOON').length;
  const overdueCount = items.filter(i => i.status === 'OVERDUE').length;
  const nonCompliantCount = items.filter(i => i.status === 'NON_COMPLIANT').length;

  const currentMetric = metrics.find(m => m.mine.mine_id === selectedMineId);
  const aggregateScore = selectedMineId === 'ALL'
    ? (metrics.reduce((acc, m) => acc + m.complianceScore, 0) / (metrics.length || 1)).toFixed(1)
    : (currentMetric?.complianceScore.toFixed(1) || '100');

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-copper-light" />
            Statutory Compliance Register
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Prioritized compliance math following statutory priority weights (CRITICAL 3.0x, HIGH 2.0x, MEDIUM 1.5x, LOW 1.0x).
          </p>
        </div>
        <DemoSourceBadge source="statutory_compliance.csv" note="Filtered excluding NOT_APPLICABLE items" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
          <div className="text-2xl font-bold font-mono text-copper-light">{aggregateScore}%</div>
          <div className="text-[11px] text-warm-slate mt-1 font-medium">Weighted Score</div>
        </div>
        <div className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">{compliantCount}</div>
          <div className="text-[11px] text-warm-slate mt-1 font-medium">Compliant</div>
        </div>
        <div className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
          <div className="text-2xl font-bold font-mono text-amber-400">{dueSoonCount}</div>
          <div className="text-[11px] text-warm-slate mt-1 font-medium">Due Soon</div>
        </div>
        <div className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{overdueCount}</div>
          <div className="text-[11px] text-warm-slate mt-1 font-medium">Overdue</div>
        </div>
        <div className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
          <div className="text-2xl font-bold font-mono text-orange-400">{nonCompliantCount}</div>
          <div className="text-[11px] text-warm-slate mt-1 font-medium">Non-Compliant</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-warm-slate" />
          <input
            type="text"
            placeholder="Search compliance item, authority, act reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-copper"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-copper-light" />
            <span className="text-warm-slate">Authority:</span>
            <select
              value={authorityFilter}
              onChange={(e) => setAuthorityFilter(e.target.value)}
              className="bg-carbon-900 border border-carbon-700 rounded px-2 py-1 text-xs text-warm-sand outline-none font-mono"
            >
              <option value="ALL">All Authorities</option>
              <option value="DGMS">DGMS</option>
              <option value="MoEFCC">MoEFCC</option>
              <option value="CPCB">CPCB</option>
              <option value="State PCB">State PCB</option>
              <option value="PESO">PESO</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-warm-slate">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-carbon-900 border border-carbon-700 rounded px-2 py-1 text-xs text-warm-sand outline-none font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="DUE_SOON">Due Soon</option>
              <option value="OVERDUE">Overdue</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Compliance Register Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-warm-pale">Statutory Items ({filteredItems.length})</h3>
          <span className="text-[10px] font-mono text-warm-slate">Live Statutory Rules Engine</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Item Name & ID</th>
                <th className="p-2.5">Authority</th>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Due Date / Validity</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Statutory Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredItems.map((item) => (
                <tr key={item.compliance_id} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-medium text-warm-pale">
                    <div>{item.item_name ?? item.regulation_name}</div>
                    <div className="text-[10px] font-mono text-warm-slate">{item.compliance_id} • {item.mine_id}</div>
                  </td>
                  <td className="p-2.5 font-mono text-copper-light font-bold">
                    {item.authority}
                  </td>
                  <td className="p-2.5 text-warm-sand">
                    {item.category}
                  </td>
                  <td className="p-2.5 font-mono text-[10px]">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      item.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      item.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      item.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">
                    {item.due_date}
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                      item.status === 'COMPLIANT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      item.status === 'DUE_SOON' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      item.status === 'OVERDUE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      item.status === 'NON_COMPLIANT' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-warm-slate">
                    {item.statutory_reference}
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
