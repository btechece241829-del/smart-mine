// Blockchain Record Verification Page
import React, { useState } from 'react';
import { Search, ShieldCheck, ShieldAlert, Loader2, Boxes, Link2, Hash, Clock, User } from 'lucide-react';
import { computeRecordHash } from '../../../blockchain';
import { getDocById, fb } from '../../lib/firebaseDb';
import { IntegrityBadge, TxHashCell } from './BlockchainBadges';
import { VerificationResult } from '../../../blockchain';

interface VState {
  recordId: string; recordType: string; currentHash: string; originalHash: string | null;
  result: VerificationResult; txHash: string | null; blockNumber: number | null;
  timestamp: string | null; network: string | null;
}

const COLS = ['attendance', 'complaints', 'inspections', 'corrective_actions', 'documents', 'audit_logs'];

async function lookup(term: string): Promise<{ id: string; type: string; record: any } | null> {
  const t = term.trim(); if (!t) return null;
  for (const col of COLS) {
    try {
      const f = await getDocById(col, t);
      if (f) return { id: f.id, type: col.toUpperCase(), record: f };
      const { data } = await fb(col).select().eq('id', t).run<any[]>();
      if (data?.length) return { id: String(data[0].id), type: col.toUpperCase(), record: data[0] };
    } catch { /* skip */ }
  }
  return null;
}

async function evaluate(lk: { id: string; type: string; record: any }): Promise<VState> {
  const currentHash = await computeRecordHash(lk.record as Record<string, unknown>);
  const m = (lk.record.blockchain ?? {}) as any;
  const orig: string | null = m.recordHash ?? null;
  const result: VerificationResult = orig && orig.toLowerCase() === currentHash.toLowerCase() ? 'VERIFIED' : orig ? 'TAMPERED' : 'NOT_FOUND';
  return { recordId: lk.id, recordType: lk.type, currentHash, originalHash: orig, result, txHash: m.txHash ?? null, blockNumber: m.blockNumber ?? null, timestamp: m.timestamp ?? null, network: m.network ?? null };
}

const PANELS: Record<VerificationResult, { t: string; b: string; c: string; i: React.ReactNode }> = {
  VERIFIED: { t: 'VERIFIED - integrity confirmed', b: 'Current record hash matches the blockchain anchor.', c: 'border-emerald-500/40 bg-emerald-500/5', i: <ShieldCheck className="w-10 h-10 text-emerald-400" /> },
  TAMPERED: { t: 'TAMPER DETECTED - integrity mismatch', b: 'Record was modified after it was anchored on-chain.', c: 'border-rose-500/50 bg-rose-500/5', i: <ShieldAlert className="w-10 h-10 text-rose-400" /> },
  NOT_FOUND: { t: 'No blockchain proof found', b: 'This record is not anchored on the blockchain yet.', c: 'border-carbon-600 bg-carbon-900/40', i: <Search className="w-10 h-10 text-warm-slate" /> },
  PENDING: { t: 'Verification pending', b: 'Blockchain transaction still awaiting confirmation.', c: 'border-amber-500/40 bg-amber-500/5', i: <Loader2 className="w-10 h-10 text-amber-400 animate-spin" /> },
};

export const BlockchainVerifyPage: React.FC = () => {
  const [term, setTerm] = useState('');
  const [v, setV] = useState<VState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setLoading(true); setError(null);
    try {
      const lk = await lookup(term);
      if (!lk) { setError('No record found. Check the ID and try again.'); setV(null); return; }
      setV(await evaluate(lk));
    } catch (e: any) { setError(e.message ?? 'Verification failed'); } finally { setLoading(false); }
  };

  const panel = v ? PANELS[v.result] : null;

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-carbon-850 p-5 rounded-xl border border-carbon-700/60 shadow-panel">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Boxes className="w-6 h-6 text-copper-light" /> Blockchain Record Verification</h2>
        <p className="text-xs text-warm-slate mt-1">Enter any Record ID, Complaint, Inspection, Document, or Audit ID to verify its blockchain integrity.</p>
      </div>
      <div className="flex gap-3">
        <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="Record ID / Complaint # / Inspection #"
          className="flex-1 px-4 py-2.5 rounded-lg bg-carbon-850 border border-carbon-700 text-sm text-warm-pale placeholder-warm-slate/60 outline-none focus:border-copper" />
        <button onClick={go} disabled={loading || !term.trim()}
          className="px-5 py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shadow-copper-glow">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Verifying…' : 'Verify Record'}
        </button>
      </div>
      {error && <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/5 text-sm text-rose-400">{error}</div>}
      {v && panel && (
        <div className={`rounded-xl border p-5 shadow-panel ${panel.c}`}>
          <div className="flex items-start gap-4">
            <div className="shrink-0">{panel.i}</div>
            <div><h3 className="text-lg font-bold text-white">{panel.t}</h3><p className="text-sm text-warm-slate mt-1">{panel.b}</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs font-mono">
            <div><div className="text-warm-slate uppercase text-[10px] mb-1">Record</div><div className="text-warm-pale font-bold">{v.recordId}</div><div className="text-copper-light">{v.recordType}</div></div>
            <div><div className="text-warm-slate uppercase text-[10px] mb-1">Status</div><IntegrityBadge result={v.result} size="md" /></div>
            <div className="md:col-span-2"><div className="text-warm-slate uppercase text-[10px] mb-1">Current Hash (Firestore)</div><div className="text-warm-sand break-all bg-carbon-900/80 border border-carbon-700 rounded p-2">{v.currentHash}</div></div>
            <div className="md:col-span-2"><div className="text-warm-slate uppercase text-[10px] mb-1">Anchored Hash (Blockchain)</div>
              <div className="break-all bg-carbon-900/80 border border-carbon-700 rounded p-2">
                <div className={v.originalHash ? 'text-copper-light' : 'text-warm-slate'}>{v.originalHash ?? 'No blockchain proof found'}</div>
                {v.originalHash && v.currentHash !== v.originalHash && <div className="text-rose-400 text-[11px] mt-1">Hash mismatch - record modified after anchoring.</div>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 border-t border-carbon-700/60 pt-4 text-xs font-mono">
            <div><div className="text-warm-slate text-[10px] uppercase"><Link2 className="w-3 h-3 inline" /> Tx</div><div className="mt-1"><TxHashCell txHash={v.txHash} short={false} /></div></div>
            <div><div className="text-warm-slate text-[10px] uppercase"><Hash className="w-3 h-3 inline" /> Block</div><div className="text-warm-pale mt-1">{v.blockNumber ?? '—'}</div></div>
            <div><div className="text-warm-slate text-[10px] uppercase"><Clock className="w-3 h-3 inline" /> Time</div><div className="text-warm-pale mt-1">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</div></div>
            <div><div className="text-warm-slate text-[10px] uppercase"><User className="w-3 h-3 inline" /> Network</div><div className="text-warm-pale mt-1">{v.network ?? '—'}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};