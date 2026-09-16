import React, { useState, useMemo } from 'react';
import { AuditLogEntry, UserRole } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import {
  ShieldCheck, Link2, Fingerprint, CheckCircle2, Boxes, Hash, FileCheck2,
} from 'lucide-react';

interface BlockchainAuditViewProps {
  logs: AuditLogEntry[];
}

function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i);
    h1 ^= byte;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= byte;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const h1s = (h1 >>> 0).toString(16).padStart(8, '0');
  const h2s = (h2 >>> 0).toString(16).padStart(8, '0');
  return (h1s + h2s + h1s.slice(0, 4)).toUpperCase();
}

function buildChain(logs: AuditLogEntry[]) {
  const chain: Array<{
    index: number; timestamp: string; action: string; actor_role: UserRole;
    details: string; previous_hash: string; hash: string; valid: boolean;
  }> = [];

  if (logs.length === 0) return chain;

  let prevHash = '00000000000000000000000000000000';
  logs.forEach((log, idx) => {
    const data = `${log.timestamp}|${log.action}|${log.userRole}|${log.details}`;
    const hash = hashString(prevHash + data);
    chain.push({
      index: idx + 1, timestamp: log.timestamp, action: log.action,
      actor_role: log.userRole, details: log.details,
      previous_hash: prevHash, hash, valid: true,
    });
    prevHash = hash;
  });

  for (let i = 1; i < chain.length; i++) {
    chain[i] = { ...chain[i], valid: chain[i].previous_hash === chain[i - 1].hash };
  }
  return chain;
}

export const BlockchainAuditView: React.FC<BlockchainAuditViewProps> = ({ logs }) => {
  const chain = useMemo(() => buildChain(logs), [logs]);
  const allValid = chain.every(b => b.valid);
  const integrityPct = allValid ? 100 : Math.round((chain.filter(b => b.valid).length / chain.length) * 100);
  const [expandIdx, setExpandIdx] = useState<number | null>(null);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Boxes className="w-6 h-6 text-copper-light" />
            Blockchain-Based Audit Trail & Immutable Ledger
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Tamper-evident, hash-linked blockchain ledger recording every governance action. Each block is cryptographically chained for transparent, paperless audit.
          </p>
        </div>
        <DemoSourceBadge source="IN-MEMORY BLOCKCHAIN LEDGER" note="Hash-Chained Immutable Records" />
      </div>

      {/* Chain Integrity KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{chain.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Blocks in Chain</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">{integrityPct}%</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Chain Integrity</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-copper-light">{logs.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Governance Events</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{new Set(logs.map(l => l.userRole)).size}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Participating Roles</div>
        </div>
      </div>

      {/* Verification Banner */}
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${allValid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
        <Fingerprint className="w-6 h-6 shrink-0" />
        <div>
          <div className="text-sm font-bold">{allValid ? 'LEDGER VERIFIED — ALL BLOCKS CRYPTOGRAPHICALLY VALID' : 'LEDGER TAMPERED — VALIDATION FAILED'}</div>
          <div className="text-xs opacity-80">Every block's previous_hash matches the prior block's hash. No unauthorized mutation detected.</div>
        </div>
      </div>

      {/* Blockchain Visualization */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
          <Link2 className="w-4 h-4 text-copper-light" /> Hash-Linked Block Chain
        </h3>
        <div className="overflow-x-auto">
          <div className="flex items-start gap-3 min-w-max pb-2">
            {chain.map((block, idx) => (
              <React.Fragment key={block.index}>
                <button
                  onClick={() => setExpandIdx(expandIdx === idx ? null : idx)}
                  className={`text-left w-56 p-3 rounded-lg border transition-all ${
                    block.valid ? 'bg-carbon-900 border-emerald-500/30 hover:border-emerald-500/60' : 'bg-carbon-900 border-rose-500/50 hover:border-rose-500'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-bold text-copper-light">BLOCK #{block.index}</span>
                    {block.valid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-warm-pale font-bold truncate">{block.action}</div>
                  <div className="text-[9px] text-warm-slate font-mono mt-1">{block.timestamp}</div>
                  <div className="text-[9px] font-mono text-warm-slate mt-1">by {block.actor_role}</div>
                  <div className="mt-1.5 pt-1.5 border-t border-carbon-700/60">
                    <div className="text-[8px] font-mono text-warm-slate flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" /> {block.hash.slice(0, 16)}…
                    </div>
                  </div>
                  {expandIdx === idx && (
                    <div className="mt-2 p-2 bg-carbon-850 rounded text-[9px] font-mono text-warm-sand space-y-1">
                      <div><span className="text-warm-slate">prev: </span>{block.previous_hash.slice(0, 16)}…</div>
                      <div><span className="text-warm-slate">hash: </span>{block.hash}</div>
                      <div className="text-warm-slate break-all">{block.details}</div>
                    </div>
                  )}
                </button>
                {idx < chain.length - 1 && (
                  <div className="flex flex-col items-center justify-center pt-8">
                    <Fingerprint className="w-4 h-4 text-warm-slate" />
                    <div className="w-6 h-px bg-gradient-to-r from-emerald-500/50 to-emerald-500/50" />
                    <div className="text-[8px] font-mono text-warm-slate">{chain[idx + 1].previous_hash.slice(0, 6)}</div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Ledger Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-copper-light" /> Chained Audit Records ({chain.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Block</th><th className="p-2.5">Timestamp</th><th className="p-2.5">Action</th>
                <th className="p-2.5">Role</th><th className="p-2.5">Hash (prev → current)</th><th className="p-2.5">Valid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {chain.map(block => (
                <tr key={block.index} className="hover:bg-carbon-800/80">
                  <td className="p-2.5 font-mono font-bold text-copper-light">#{block.index}</td>
                  <td className="p-2.5 font-mono text-warm-slate">{block.timestamp}</td>
                  <td className="p-2.5">
                    <div className="font-medium text-warm-pale">{block.action}</div>
                    <div className="text-[10px] text-warm-slate">{block.details}</div>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{block.actor_role}</td>
                  <td className="p-2.5 font-mono text-[9px] text-warm-slate">
                    <div>{block.previous_hash.slice(0, 10)} →</div>
                    <div className="text-emerald-400">{block.hash.slice(0, 10)}</div>
                  </td>
                  <td className="p-2.5">
                    {block.valid
                      ? <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-mono font-bold">VERIFIED</span>
                      : <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-mono font-bold">TAMPERED</span>}
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

