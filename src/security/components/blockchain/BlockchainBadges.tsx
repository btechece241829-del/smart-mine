// ────────────────────────────────────────────────────────────────
// Blockchain UI — reusable badges and indicators
// ────────────────────────────────────────────────────────────────
import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Link2, Boxes } from 'lucide-react';
import { VerificationResult, BlockchainTxStatus } from '../../../blockchain/types';

const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold';
const baseMd = 'px-2.5 py-1';

export const IntegrityBadge: React.FC<{ result: VerificationResult | null | undefined; size?: 'sm' | 'md' }> = ({ result, size = 'sm' }) => {
  if (!result || result === 'PENDING' || result === 'NOT_FOUND') {
    return (
      <span className={`${base} ${size === 'md' ? baseMd : ''} bg-slate-500/10 text-slate-300 border-slate-500/40`}>
        <ShieldQuestion className="w-3 h-3" />
        {result === 'PENDING' ? 'VERIFICATION PENDING' : 'NOT REGISTERED'}
      </span>
    );
  }
  if (result === 'VERIFIED') {
    return (
      <span className={`${base} ${size === 'md' ? baseMd : ''} bg-emerald-500/15 text-emerald-400 border-emerald-500/40`}>
        <ShieldCheck className="w-3 h-3" />
        VERIFIED
      </span>
    );
  }
  return (
    <span className={`${base} ${size === 'md' ? baseMd : ''} bg-rose-500/15 text-rose-400 border-rose-500/50`}>
      <ShieldAlert className="w-3 h-3" />
      TAMPER DETECTED
    </span>
  );
};

export const TxStatusBadge: React.FC<{ status: BlockchainTxStatus | null | undefined }> = ({ status }) => {
  if (!status) return null;
  const meta: Record<BlockchainTxStatus, { label: string; cls: string }> = {
    PENDING: { label: 'PENDING', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
    CONFIRMED: { label: 'CONFIRMED', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
    FAILED: { label: 'FAILED', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/50' },
    RETRY_REQUIRED: { label: 'RETRY REQUIRED', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' },
  };
  const m = meta[status];
  return (
    <span className={`${base} text-[10px] ${m.cls}`}>
      {status === 'PENDING' || status === 'RETRY_REQUIRED' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Link2 className="w-2.5 h-2.5" />}
      {m.label}
    </span>
  );
};

export const BlockchainNetworkBadge: React.FC<{ connected: boolean; network: string; blockNumber: number | null; syncing?: boolean }> = ({ connected, network, blockNumber, syncing }) => {
  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold ${
      syncing
        ? 'bg-sky-500/10 text-sky-400 border-sky-500/40'
        : connected
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
          : 'bg-slate-500/10 text-slate-400 border-slate-500/40'
    }`}>
      <Boxes className="w-3 h-3" />
      {syncing ? 'SYNCING' : connected ? 'CONNECTED' : 'OFFLINE'}
      <span className="opacity-60">•</span>
      {network}
      {blockNumber !== null && <span className="opacity-60">• #{blockNumber}</span>}
    </span>
  );
};
export const TxHashCell: React.FC<{ txHash: string | null | undefined; short?: boolean }> = ({ txHash, short = true }) => {
  if (!txHash) return <span className="text-warm-slate text-xs">—</span>;
  const display = short && txHash.length > 18 ? `${txHash.slice(0, 10)}…${txHash.slice(-6)}` : txHash;
  return (
    <span className="text-[11px] font-mono text-copper-light break-all" title={`${txHash}`}>
      {display}
    </span>
  );
};

export const RecordHashCell: React.FC<{ hash: string | null | undefined }> = ({ hash }) => {
  if (!hash) return <span className="text-warm-slate text-xs">—</span>;
  return (
    <span className="text-[10px] font-mono text-warm-sand break-all" title={hash}>
      {hash.slice(0, 16)}…
    </span>
  );
};