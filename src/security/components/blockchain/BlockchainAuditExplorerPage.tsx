// Blockchain Audit Explorer
import React, { useEffect, useState, useCallback } from 'react';
import { Boxes, Fingerprint, ShieldCheck, ShieldAlert, RefreshCw, Loader2, Link2, Clock } from 'lucide-react';
import { fb } from '../../lib/firebaseDb';
import { IntegrityBadge, TxStatusBadge, TxHashCell } from './BlockchainBadges';
import { VerificationResult } from '../../../blockchain';

interface Row { id: string; timestamp?: string; action?: string; user_name?: string; role?: string; entity_id?: string; entity_type?: string; blockchain?: { recordHash?: string; txHash?: string; status?: string; verificationResult?: VerificationResult }; blockchainStatus?: string; verificationResult?: VerificationResult; }

export const BlockchainAuditExplorerPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fb('audit_logs').select().run<Row>();
      const list = (Array.isArray(data) ? data : data ? [data] : []) as Row[];
      setRows(list.sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? ''))).slice(0, 300));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-5 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Fingerprint className="w-6 h-6 text-copper-light" /> Immutable Audit Explorer</h2>
          <p className="text-xs text-warm-slate mt-1">Every important governance action is recorded with a cryptographic hash on the blockchain.</p>
        </div>
        <button onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} disabled={refreshing}
          className="px-3 py-2 rounded-lg bg-copper/15 hover:bg-copper/25 border border-copper/40 text-copper-light text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>

{loading ? (<div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-copper-light" /></div>) : (
        <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl shadow-panel overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Actor</th><th className="p-3">Record</th><th className="p-3">Integrity</th><th className="p-3">Tx Hash</th></tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-warm-slate">No audit events found.</td></tr>}
              {rows.map(r => {
                const meta = r.blockchain;
                const result = (r.verificationResult ?? meta?.verificationResult) as VerificationResult | undefined;
                const status = (r.blockchainStatus ?? meta?.status) as 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RETRY_REQUIRED' | undefined;
                return (
                  <tr key={r.id} className="hover:bg-carbon-800/80 align-top">
                    <td className="p-3 font-mono text-warm-slate whitespace-nowrap"><Clock className="w-3 h-3 inline" /> {r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}</td>
                    <td className="p-3"><div className="font-bold text-warm-pale">{r.action ?? '-'}</div><div className="text-[10px] text-warm-slate">{r.entity_type ?? ''}</div></td>
                    <td className="p-3"><div className="text-warm-sand">{r.user_name ?? '-'}</div><div className="text-[10px] font-mono text-warm-slate">{r.role ?? ''}</div></td>
                    <td className="p-3 font-mono text-[11px] text-copper-light break-all">{r.entity_id ?? '-'}</td>
                    <td className="p-3">{meta?.recordHash ? <IntegrityBadge result={result ?? 'PENDING'} /> : <span className="text-warm-slate text-[10px]">-</span>}</td>
                    <td className="p-3">{status ? <TxStatusBadge status={status} /> : <TxHashCell txHash={meta?.txHash} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] font-mono text-warm-slate p-3 bg-carbon-850 rounded-xl border border-carbon-700/60 flex-wrap">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> VERIFIED</span>
        <span className="flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> TAMPERED</span>
        <span className="flex items-center gap-1"><Boxes className="w-3.5 h-3.5 text-copper-light" /> PENDING</span>
        <span className="flex items-center gap-1 ml-auto"><Link2 className="w-3.5 h-3.5 text-copper-light" /> On-chain reference</span>
      </div>
    </div>
  );
};