// Blockchain Dashboard
import React, { useEffect, useState } from 'react';
import { Activity, Boxes, ShieldCheck, ShieldAlert, Fingerprint, Link2, Loader2, RefreshCw, Wallet, FileCheck2, Layers, Hash, Clock } from 'lucide-react';
import { useBlockchainState } from './useBlockchainState';
import { BlockchainNetworkBadge, IntegrityBadge, TxStatusBadge, TxHashCell } from './BlockchainBadges';
import { networkLabel, isSimulationMode } from '../../../blockchain';
import { getWalletAccount } from '../../../blockchain';
import { Spinner } from '../ui/primitives';

const Kpi: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: string; sub?: string }> = ({ label, value, icon, accent = "text-copper-light", sub }) => (
  <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-4 shadow-panel">
    <div className="flex items-center justify-between">
      <div className={accent}>{icon}</div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">{label}</span>
    </div>
    <div className="mt-2 text-3xl font-bold font-mono text-white">{value}</div>
    {sub && <div className="mt-1 text-[10px] font-mono text-warm-slate">{sub}</div>}
  </div>
);

export const BlockchainDashboardPage: React.FC = () => {
  const { status, metrics, recentEvents, initialized, refreshStatus, refreshMetrics } = useBlockchainState();
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (!isSimulationMode()) getWalletAccount().then(setWalletAddr).catch(() => {}); }, []);

  const handleRefresh = async () => { setRefreshing(true); try { await refreshStatus(); await refreshMetrics(); } finally { setRefreshing(false); } };
  const connectWallet = async () => { setLoadingWallet(true); try { const addr = await getWalletAccount(); setWalletAddr(addr); } finally { setLoadingWallet(false); } };
  const verifiedPct = metrics.totalRecords > 0 ? Math.round((metrics.verifiedRecords / metrics.totalRecords) * 100) : 0;
  const statusColor = status.connected ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-5 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Boxes className="w-6 h-6 text-copper-light" /> Blockchain Trust &amp; Integrity Dashboard
          </h2>
          <p className="text-xs text-warm-slate mt-1">Cryptographic proof layer anchoring attendance, inspections, complaints, documents, and compliance events.</p>
        </div>
        <div className="flex items-center gap-3">
          <BlockchainNetworkBadge connected={status.connected} network={networkLabel()} blockNumber={status.blockNumber} syncing={status.syncing} />
          <button onClick={handleRefresh} disabled={refreshing} className="px-3 py-1.5 rounded-lg bg-copper/15 hover:bg-copper/25 border border-copper/40 text-copper-light text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50">
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-4 shadow-panel lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-copper-light" /><h3 className="text-sm font-bold text-warm-pale">Blockchain Network Status</h3></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><div className="text-warm-slate font-mono text-[10px] uppercase">Status</div><div className={`font-bold font-mono ${statusColor}`}>{status.connected ? 'CONNECTED' : status.syncing ? 'SYNCING' : 'OFFLINE'}</div></div>
            <div><div className="text-warm-slate font-mono text-[10px] uppercase">Network</div><div className="font-bold font-mono text-warm-pale">{networkLabel()}</div></div>
            <div><div className="text-warm-slate font-mono text-[10px] uppercase">Chain ID</div><div className="font-bold font-mono text-warm-pale">{status.chainId ?? '—'}</div></div>
            <div><div className="text-warm-slate font-mono text-[10px] uppercase">Latest Block</div><div className="font-bold font-mono text-warm-pale">{status.blockNumber ?? '—'}</div></div>
          </div>
          {status.error && <div className="mt-3 text-[11px] font-mono text-rose-400">{status.error}</div>}
        </div>
        <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-4 shadow-panel">
          <div className="flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-copper-light" /><h3 className="text-sm font-bold text-warm-pale">Signing Wallet</h3></div>
          {walletAddr ? (<div className="font-mono text-[11px] text-emerald-400 break-all bg-carbon-900 rounded p-2 border border-emerald-500/30">{walletAddr}</div>)
          : (<button onClick={connectWallet} disabled={loadingWallet || isSimulationMode()} className="w-full px-3 py-2 rounded-lg bg-copper/15 hover:bg-copper/25 border border-copper/40 text-copper-light text-xs font-mono font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {loadingWallet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />} {isSimulationMode() ? 'Simulation Mode' : 'Connect MetaMask'}
            </button>)}
        </div>
      </div>
      {!initialized ? (<div className="py-12"><Spinner label="Loading ledger…" /></div>) : (
        <><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Blockchain Records" value={metrics.totalRecords} icon={<Fingerprint className="w-5 h-5" />} />
          <Kpi label="Verified Records" value={metrics.verifiedRecords} icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} accent="text-emerald-400" sub={`${verifiedPct}% of all records`} />
          <Kpi label="Pending Transactions" value={metrics.pendingTransactions} icon={<Clock className="w-5 h-5 text-amber-400" />} accent="text-amber-400" />
          <Kpi label="Tamper Alerts" value={metrics.tamperAlerts} icon={<ShieldAlert className="w-5 h-5 text-rose-400" />} accent="text-rose-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Signed Approvals" value={metrics.signedApprovals} icon={<Fingerprint className="w-5 h-5 text-sky-400" />} accent="text-sky-400" />
          <Kpi label="Verified Documents" value={metrics.verifiedDocuments} icon={<FileCheck2 className="w-5 h-5 text-teal-400" />} accent="text-teal-400" />
          <Kpi label="Audit Events" value={metrics.auditEvents} icon={<Hash className="w-5 h-5 text-violet-400" />} accent="text-violet-400" />
          <Kpi label="Failed Verification" value={metrics.failedVerification} icon={<ShieldAlert className="w-5 h-5 text-orange-400" />} accent="text-orange-400" />
        </div></>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-4 shadow-panel">
          <div className="flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-copper-light" /><h3 className="text-sm font-bold text-warm-pale">Anchored Records by Type</h3></div>
          {Object.keys(metrics.recordsByType).length === 0 ? (<p className="text-xs text-warm-slate">No anchored records yet.</p>) : (
            <div className="space-y-2">{Object.entries(metrics.recordsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const pct = Math.round((count / metrics.totalRecords) * 100);
              return (<div key={type}><div className="flex justify-between text-[11px] font-mono"><span className="text-warm-sand">{type}</span><span className="text-warm-pale">{count}</span></div><div className="h-1.5 bg-carbon-900 rounded-full mt-1"><div className="h-1.5 bg-copper rounded-full" style={{ width: `${pct}%` }} /></div></div>);
            })}</div>
          )}
        </div>
        <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-4 shadow-panel">
          <div className="flex items-center gap-2 mb-3"><Link2 className="w-4 h-4 text-copper-light" /><h3 className="text-sm font-bold text-warm-pale">Recent Ledger Events</h3></div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {recentEvents.length === 0 ? (<p className="text-xs text-warm-slate">No blockchain events yet.</p>) : (
              recentEvents.map((ev: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 bg-carbon-900/80 border border-carbon-700/50 rounded-lg">
                  <div className="min-w-0"><div className="text-[11px] font-bold text-warm-pale truncate">{ev.recordType ?? 'GENERAL'} · {ev.recordId ?? '—'}</div>
                  <div className="text-[10px] font-mono text-warm-slate">{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}</div><TxHashCell txHash={ev.txHash} /></div>
                  <div className="flex flex-col items-end gap-1"><IntegrityBadge result={ev.verificationResult ?? 'PENDING'} /><TxStatusBadge status={ev.status} /></div>
                </div>
              )))}
          </div>
        </div>
      </div>
      {isSimulationMode() && (<div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 text-xs text-sky-300 font-mono">
        <div className="flex items-center gap-2 font-bold mb-1"><Fingerprint className="w-4 h-4" /> SIMULATION MODE ACTIVE</div>
        Run <span className="bg-carbon-900 px-1.5 py-0.5 rounded">npm run blockchain:start</span> then <span className="bg-carbon-900 px-1.5 py-0.5 rounded">npm run blockchain:deploy</span> to switch to a real local chain.
      </div>)}
    </div>
  );
};
