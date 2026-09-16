import React, { useState } from 'react';
import { RuleDerivedAlert } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { BellRing, Filter } from 'lucide-react';

interface AlertsEscalationViewProps {
  alerts: RuleDerivedAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onAuditLog?: (action: string, details: string) => void;
}

export const AlertsEscalationView: React.FC<AlertsEscalationViewProps> = ({
  alerts,
  onAcknowledgeAlert,
  onResolveAlert,
  onAuditLog
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filteredAlerts = alerts.filter(a => severityFilter === 'ALL' || a.severity === severityFilter);

  const handleEscalate = (alert: RuleDerivedAlert) => {
    onAuditLog?.('ALERT_MANUAL_ESCALATION', `Escalated alert #${alert.alertId} to Corporate HQ Management`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <BellRing className="w-6 h-6 text-rose-400 animate-pulse" />
            Rule-Derived Alert & Escalation Matrix
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Deterministic statutory surveillance alerts derived across 8 risk domains with automated 3-tier escalation triggers.
          </p>
        </div>
        <DemoSourceBadge source="13 CSV DATA LAYER" note="Live Rule Engine Notifications" />
      </div>

      {/* Filter Bar */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-copper-light" />
          <span className="text-warm-slate">Filter Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-carbon-900 border border-carbon-700 rounded px-2.5 py-1 text-xs text-warm-sand outline-none font-mono"
          >
            <option value="ALL">All Severities ({alerts.length})</option>
            <option value="CRITICAL">Critical ({alerts.filter(a => a.severity === 'CRITICAL').length})</option>
            <option value="HIGH">High ({alerts.filter(a => a.severity === 'HIGH').length})</option>
            <option value="WARNING">Warning ({alerts.filter(a => a.severity === 'WARNING').length})</option>
          </select>
        </div>
      </div>

      {/* Alert Feed Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Alert ID & Category</th>
                <th className="p-2.5">Mine ID</th>
                <th className="p-2.5">Severity</th>
                <th className="p-2.5">Escalation Status</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5">Recommended Statutory Action</th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredAlerts.map(alert => (
                <tr key={alert.alertId} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-medium text-warm-pale">
                    <div>{alert.category}</div>
                    <div className="text-[10px] font-mono text-warm-slate">{alert.alertId}</div>
                  </td>
                  <td className="p-2.5 font-mono text-copper-light font-bold">{alert.mineId}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-warm-slate">
                    {alert.escalationLevel}
                  </td>
                  <td className="p-2.5 text-warm-sand max-w-xs">{alert.title}</td>
                  <td className="p-2.5 text-gray-300 font-mono text-[11px] bg-carbon-900 p-2 rounded border border-carbon-700/60 max-w-xs">
                    {alert.actionRequired}
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5">
                      {!alert.acknowledged ? (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.alertId)}
                          className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-mono"
                        >
                          Ack
                        </button>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                          Acked
                        </span>
                      )}
                      <button
                        onClick={() => handleEscalate(alert)}
                        className="px-2 py-1 bg-carbon-800 hover:bg-copper text-copper-light hover:text-white rounded text-[10px] font-mono border border-carbon-700"
                      >
                        Escalate
                      </button>
                    </div>
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
