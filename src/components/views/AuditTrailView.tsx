import React, { useState } from 'react';
import { AuditLogEntry } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { ShieldCheck, History, Search, Filter } from 'lucide-react';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userRole.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <History className="w-6 h-6 text-copper-light" />
            Immutable Governance Audit Trail & Lineage Log
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Tamper-evident statutory record tracking all human-in-the-loop decisions, CAPA status mutations, and document verifications.
          </p>
        </div>
        <DemoSourceBadge source="IN-MEMORY IMMUTABLE LOG" note="Regulatory Compliance Audit" />
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-1.5 w-full sm:w-80">
          <Search className="w-4 h-4 text-warm-slate shrink-0" />
          <input
            type="text"
            placeholder="Search action, role, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-warm-sand placeholder-warm-slate outline-none w-full font-mono"
          />
        </div>

        <div className="text-xs font-mono text-warm-slate">
          Total Logged Governance Events: <span className="text-copper-light font-bold">{logs.length}</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Log ID</th>
                <th className="p-2.5">User Persona / Role</th>
                <th className="p-2.5">Action Event</th>
                <th className="p-2.5">Details & Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-mono text-warm-slate whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-2.5 font-mono text-copper-light font-bold">{log.id}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 font-mono text-[10px] text-warm-pale">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono font-bold text-emerald-400">{log.action}</td>
                  <td className="p-2.5 text-warm-sand font-mono text-[11px]">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
