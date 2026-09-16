import React from 'react';
import { Loader2, Boxes, ShieldCheck } from 'lucide-react';
import { VerificationResult } from '../../../blockchain/types';
import { IntegrityBadge, RecordHashCell, TxHashCell } from './BlockchainBadges';

/** Full blockchain meta panel shown on record detail views. */
export const BlockchainMetaPanel: React.FC<{
  meta: { status?: string; recordHash?: string | null; txHash?: string | null; blockNumber?: number | null; network?: string | null; timestamp?: string | null; lastVerifiedAt?: string | null; verificationResult?: string | null } | null | undefined;
  onVerify?: () => void;
  verifying?: boolean;
}> = ({ meta, onVerify, verifying }) => {
  if (!meta) return null;
  return (
    <div className="p-3 rounded-lg bg-carbon-900/80 border border-copper/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-copper-light uppercase tracking-wider">
          <Boxes className="w-3.5 h-3.5" />
          Blockchain Anchor
        </div>
        <IntegrityBadge result={((meta.verificationResult ?? 'PENDING') as VerificationResult)} size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
        <div className="text-warm-slate">Network</div>
        <div className="text-warm-sand">{meta.network ?? '—'}</div>
        <div className="text-warm-slate">Block #</div>
        <div className="text-warm-sand">{meta.blockNumber ?? '—'}</div>
        <div className="text-warm-slate">Record Hash</div>
        <RecordHashCell hash={meta.recordHash} />
        <div className="text-warm-slate">Tx Hash</div>
        <TxHashCell txHash={meta.txHash} />
        <div className="text-warm-slate">Anchored At</div>
        <div className="text-warm-sand">{meta.timestamp ? new Date(meta.timestamp).toLocaleString() : '—'}</div>
      </div>
      {onVerify && (
        <button
          onClick={onVerify}
          disabled={verifying}
          className="w-full px-2 py-1.5 rounded bg-copper/15 hover:bg-copper/25 border border-copper/40 text-copper-light text-[11px] font-mono font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
          {verifying ? 'Verifying…' : 'Verify Integrity'}
        </button>
      )}
    </div>
  );
};