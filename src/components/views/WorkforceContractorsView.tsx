import React, { useState } from 'react';
import { DatasetBundle } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { Users, HardHat } from 'lucide-react';

interface WorkforceContractorsViewProps {
  data: DatasetBundle;
  selectedMineId: string;
}

export const WorkforceContractorsView: React.FC<WorkforceContractorsViewProps> = ({
  data,
  selectedMineId
}) => {
  const [activeTab, setActiveTab] = useState<'contractors' | 'workforce'>('contractors');

  const filteredContractors = selectedMineId === 'ALL'
    ? data.contractors
    : data.contractors.filter(c => c.mine_id === selectedMineId);

  const highRiskContractors = filteredContractors.filter(c => c.status === 'HIGH_RISK');

  const filteredWorkforce = selectedMineId === 'ALL'
    ? data.workers
    : data.workers.filter(w => w.mine_id === selectedMineId);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Users className="w-6 h-6 text-copper-light" />
            Workforce & Contractor Risk Governance
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Contractor safety audit scores, statutory worker competency verification, and medical fitness tracking.
          </p>
        </div>
        <DemoSourceBadge source="contractors.csv, workforce_records.csv" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-carbon-700 pb-2">
        <button
          onClick={() => setActiveTab('contractors')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'contractors' ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
          }`}
        >
          <HardHat className="w-4 h-4" />
          Contractor Performance & Risk Tier ({filteredContractors.length})
        </button>
        <button
          onClick={() => setActiveTab('workforce')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'workforce' ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Worker Competency & Fitness ({filteredWorkforce.length})
        </button>
      </div>

      {/* Tab 1: Contractors */}
      {activeTab === 'contractors' && (
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale">Contractor Safety Audit Table</h3>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-xs font-mono">
              {highRiskContractors.length} High-Risk Contractors
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                <tr>
                  <th className="p-2.5">Contractor Name / ID</th>
                  <th className="p-2.5">Mine ID</th>
                  <th className="p-2.5">Worker Count</th>
                  <th className="p-2.5">Safety Audit Score</th>
                  <th className="p-2.5">Risk Tier</th>
                  <th className="p-2.5">Statutory Clearance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-800">
                {filteredContractors.map(c => (
                  <tr key={c.contractor_id} className="hover:bg-carbon-800/80 transition-colors">
                    <td className="p-2.5 font-medium text-warm-pale">
                      <div>{c.contractor_name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{c.contractor_id}</div>
                    </td>
                    <td className="p-2.5 font-mono text-warm-sand">{c.mine_id}</td>
                    <td className="p-2.5 font-mono text-white">{c.worker_count}</td>
                    <td className="p-2.5 font-mono font-bold">
                      <span className={c.contractor_risk_score > 70 ? 'text-rose-400' : 'text-emerald-400'}>
                        {c.training_compliance_pct}%
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        c.status === 'HIGH_RISK' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        c.status === 'WATCH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        (c.licence_expiry ?? '') >= '2026-01-01' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {(c.licence_expiry ?? '') >= '2026-06-01' ? 'ACTIVE' : 'EXPIRING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Workforce */}
      {activeTab === 'workforce' && (
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <h3 className="text-sm font-bold text-warm-pale">Worker Statutory Competency & Fitness Register</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                <tr>
                  <th className="p-2.5">Worker Name / ID</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">Employer</th>
                  <th className="p-2.5">Training Status</th>
                  <th className="p-2.5">Medical Fitness</th>
                  <th className="p-2.5">PPE Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-800">
                {filteredWorkforce.map(w => (
                  <tr key={w.worker_id} className="hover:bg-carbon-800/80 transition-colors">
                    <td className="p-2.5 font-medium text-warm-pale">
                      <div>{w.name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{w.worker_id} • {w.mine_id}</div>
                    </td>
                    <td className="p-2.5 font-bold text-copper-light">{w.role}</td>
                    <td className="p-2.5 text-warm-sand">{w.department}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        w.training_status === 'VALID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {w.training_status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        w.fitness_status === 'VALID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {w.fitness_status}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-white">{w.ppe_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


