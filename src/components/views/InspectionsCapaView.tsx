import { dbClient } from '../../services/dbClient';
import React, { useState } from 'react';
import { DatasetBundle, CAPAItem } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { ClipboardList, AlertOctagon, CheckCircle2, Clock, MapPin, ArrowRight, UserCheck } from 'lucide-react';

interface InspectionsCapaViewProps {
  data: DatasetBundle;
  selectedMineId: string;
  onAuditLog?: (action: string, details: string) => void;
  capaItems?: CAPAItem[];
  setCapaItems?: React.Dispatch<React.SetStateAction<CAPAItem[]>>;
  dbStatus?: string;
}

export const InspectionsCapaView: React.FC<InspectionsCapaViewProps> = ({
  data,
  selectedMineId,
  onAuditLog,
  capaItems,
  setCapaItems,
  dbStatus
}) => {
  const [activeTab, setActiveTab] = useState<'inspections' | 'violations' | 'capa'>('capa');
  const capaList = capaItems && capaItems.length > 0 ? capaItems : data.correctiveActions;

  const filteredInspections = selectedMineId === 'ALL'
    ? data.inspections
    : data.inspections.filter(i => i.mine_id === selectedMineId);

  const filteredViolations = selectedMineId === 'ALL'
    ? data.violations
    : data.violations.filter(v => v.mine_id === selectedMineId);

  const filteredCapa = selectedMineId === 'ALL'
    ? capaList
    : capaList.filter(c => c.mine_id === selectedMineId);

  const handleUpdateCapaStatus = (capaId: string, newStatus: CAPAItem['status']) => {
    setCapaItems?.(prev => prev.map(item => item.action_id === capaId ? { ...item, status: newStatus } : item));
    onAuditLog?.('CAPA_STATUS_CHANGE', `Updated CAPA #${capaId} status to ${newStatus}`);
  };

  const openCapa = filteredCapa.filter(c => c.status === 'OPEN');
  const inProgCapa = filteredCapa.filter(c => c.status === 'IN_PROGRESS');
  const pendingCapa = filteredCapa.filter(c => c.status === 'PENDING_VERIFICATION');
  const overdueCapa = filteredCapa.filter(c => c.status === 'OVERDUE');
  const closedCapa = filteredCapa.filter(c => c.status === 'CLOSED');

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-copper-light" />
            Inspections, Violations & CAPA Management
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            End-to-end statutory inspection audit log, violation resolution workflow, and interactive CAPA aging board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoSourceBadge source="inspections.csv, violations.csv, capa_items.csv" />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-carbon-700 pb-2">
        <button
          onClick={() => setActiveTab('capa')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'capa' ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Interactive CAPA Kanban Board ({filteredCapa.length})
        </button>
        <button
          onClick={() => setActiveTab('violations')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'violations' ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Statutory Violations ({filteredViolations.length})
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'inspections' ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Inspection Audit Logs ({filteredInspections.length})
        </button>
      </div>

      {/* Tab 1: CAPA Kanban Board */}
      {activeTab === 'capa' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Column: OPEN */}
          <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-700">
              <span className="text-xs font-bold text-amber-400 font-mono">OPEN</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">{openCapa.length}</span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
              {openCapa.map(c => (
                <div key={c.action_id} className="p-3 bg-carbon-900 rounded-lg border border-carbon-700 space-y-2 text-xs">
                  <div className="font-bold text-warm-pale">{c.corrective_action}</div>
                  <div className="text-[10px] text-warm-slate font-mono">ID: {c.action_id}</div>
                  <div className="text-warm-sand">Assigned To: {c.assigned_to_role}</div>
                  <div className="text-[10px] font-mono text-warm-slate">Due: {c.due_date}</div>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleUpdateCapaStatus(c.action_id, 'IN_PROGRESS')}
                      className="px-2 py-1 bg-carbon-800 hover:bg-copper text-copper-light hover:text-white rounded text-[10px] font-mono border border-carbon-700"
                    >
                      Start Work &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column: IN_PROGRESS */}
          <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-700">
              <span className="text-xs font-bold text-blue-400 font-mono">IN PROGRESS</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">{inProgCapa.length}</span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
              {inProgCapa.map(c => (
                <div key={c.action_id} className="p-3 bg-carbon-900 rounded-lg border border-blue-500/30 space-y-2 text-xs">
                  <div className="font-bold text-warm-pale">{c.corrective_action}</div>
                  <div className="text-[10px] text-warm-slate font-mono">ID: {c.action_id}</div>
                  <div className="text-warm-sand">Assigned To: {c.assigned_to_role}</div>
                  <div className="text-[10px] font-mono text-warm-slate">Due: {c.due_date}</div>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleUpdateCapaStatus(c.action_id, 'PENDING_VERIFICATION')}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-mono"
                    >
                      Submit for Verification &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column: PENDING_VERIFICATION */}
          <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-700">
              <span className="text-xs font-bold text-purple-400 font-mono">PENDING VERIFY</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">{pendingCapa.length}</span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
              {pendingCapa.map(c => (
                <div key={c.action_id} className="p-3 bg-carbon-900 rounded-lg border border-carbon-700 space-y-2 text-xs">
                  <div className="font-bold text-warm-pale">{c.corrective_action}</div>
                  <div className="text-[10px] text-warm-slate font-mono">ID: {c.action_id}</div>
                  <div className="text-warm-sand">Assigned To: {c.assigned_to_role}</div>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleUpdateCapaStatus(c.action_id, 'CLOSED')}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-mono"
                    >
                      Verify & Close &check;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column: OVERDUE */}
          <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-700">
              <span className="text-xs font-bold text-rose-400 font-mono">OVERDUE</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono">{overdueCapa.length}</span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
              {overdueCapa.map(c => (
                <div key={c.action_id} className="p-3 bg-carbon-900 rounded-lg border border-rose-500/40 space-y-2 text-xs">
                  <div className="font-bold text-rose-300">{c.corrective_action}</div>
                  <div className="text-[10px] text-rose-400/80 font-mono">ID: {c.action_id}</div>
                  <div className="text-warm-sand">Assigned To: {c.assigned_to_role}</div>
                  <div className="text-[10px] font-mono text-rose-400 font-bold">Target Date Passed ({c.due_date})</div>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleUpdateCapaStatus(c.action_id, 'IN_PROGRESS')}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-mono"
                    >
                      Escalate & Expedite &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column: CLOSED */}
          <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-700">
              <span className="text-xs font-bold text-emerald-400 font-mono font-semibold">CLOSED</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">{closedCapa.length}</span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
              {closedCapa.map(c => (
                <div key={c.action_id} className="p-3 bg-carbon-900/60 rounded-lg border border-carbon-700 opacity-80 space-y-2 text-xs">
                  <div className="font-bold text-gray-300 line-through">{c.corrective_action}</div>
                  <div className="text-[10px] text-gray-400 font-mono">ID: {c.action_id}</div>
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Statutory Verified
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Violations Table */}
      {activeTab === 'violations' && (
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                <tr>
                  <th className="p-2.5">Violation ID & Mine</th>
                  <th className="p-2.5">Type & Zone</th>
                  <th className="p-2.5">Severity</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5">Issued Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-800">
                {filteredViolations.map(vio => (
                  <tr key={vio.violation_id} className="hover:bg-carbon-800/80">
                    <td className="p-2.5 font-mono text-warm-pale">
                      <div>{vio.violation_id}</div>
                      <div className="text-[10px] text-warm-slate">{vio.mine_id}</div>
                    </td>
                    <td className="p-2.5 font-medium text-copper-light">
                      {vio.violation_type} ({vio.zone})
                    </td>
                    <td className="p-2.5 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        vio.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        vio.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {vio.severity}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        vio.status === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {vio.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-warm-sand max-w-xs">{vio.description}</td>
                    <td className="p-2.5 font-mono text-warm-slate">{vio.reported_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Inspection Feed */}
      {activeTab === 'inspections' && (
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInspections.map(insp => (
              <div key={insp.inspection_id} className="p-4 bg-carbon-900 rounded-xl border border-carbon-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-copper-light">{insp.inspection_type} Inspection</span>
                  <span className="px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 text-xs font-mono font-bold text-warm-pale">
                    Score: {insp.checklist_score_pct}%
                  </span>
                </div>
                <div className="text-xs text-warm-slate font-mono">
                  ID: {insp.inspection_id} • Mine: {insp.mine_id} • Inspector: {insp.inspector_role}
                </div>
                <div className="text-xs text-warm-sand">
                  <strong>Zone:</strong> {insp.zone} | <strong>Date:</strong> {insp.inspection_date}
                </div>
                <div className="text-xs text-gray-300 bg-carbon-850 p-2.5 rounded border border-carbon-700/60">
                  {insp.observation_summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

