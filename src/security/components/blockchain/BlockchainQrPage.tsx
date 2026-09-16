// ────────────────────────────────────────────────────────────────
// QR Attestation — displays QR codes for any blockchain-anchored record
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { QrCode, Loader2 } from 'lucide-react';
import { getDocById, fb } from '../../lib/firebaseDb';
import { BlockchainQrCode, QrVerificationCard, QrVerificationTarget } from './BlockchainQrView';
import { computeRecordHash } from '../../../blockchain';

const QR_COLLECTIONS = [
  { col: 'complaints', type: 'COMPLAINT' },
  { col: 'inspections', type: 'INSPECTION' },
  { col: 'corrective_actions', type: 'COMPLIANCE' },
  { col: 'documents', type: 'DOCUMENT' },
  { col: 'attendance', type: 'ATTENDANCE' },
];

export const BlockchainQrPage: React.FC = () => {
  const [recordId, setRecordId] = useState('');
  const [target, setTarget] = useState<QrVerificationTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQr = async () => {
    const term = recordId.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    try {
      for (const cand of QR_COLLECTIONS) {
        const found = await getDocById(cand.col, term);
        if (found) {
          const meta = found.blockchain as any;
          const hash = await computeRecordHash(found as Record<string, unknown>);
          setTarget({
            recordId: found.id,
            recordType: cand.type,
            issuingOrg: found.mine_name ?? found.mine_id ?? 'Smart Mine Authority',
            timestamp: found.created_at ?? found.reported_at ?? new Date().toISOString(),
            blockchain: {
              recordHash: meta?.recordHash ?? hash,
              txHash: meta?.txHash ?? null,
              network: meta?.network ?? 'blockchain',
            },
            status: meta?.recordHash
              ? (meta.recordHash.toLowerCase() === hash.toLowerCase() ? 'VERIFIED' : 'TAMPERED')
              : 'PENDING',
          });
          return;
        }
        try {
          const { data } = await fb(cand.col).select().eq('id', term).run<any[]>();
          if (data && data.length > 0) {
            const found2 = data[0];
            const meta2 = found2.blockchain as any;
            const hash2 = await computeRecordHash(found2 as Record<string, unknown>);
            setTarget({
              recordId: String(found2.id ?? term),
              recordType: cand.type,
              issuingOrg: found2.mine_name ?? found2.mine_id ?? 'Smart Mine Authority',
              timestamp: found2.created_at ?? found2.reported_at ?? new Date().toISOString(),
              blockchain: {
                recordHash: meta2?.recordHash ?? hash2,
                txHash: meta2?.txHash ?? null,
                network: meta2?.network ?? 'blockchain',
              },
              status: meta2?.recordHash
                ? (meta2.recordHash.toLowerCase() === hash2.toLowerCase() ? 'VERIFIED' : 'TAMPERED')
                : 'PENDING',
            });
            return;
          }
        } catch { /* collection may not exist */ }
      }
      setError('Record not found. Enter a Complaint, Inspection, Document, Corrective Action, or Attendance ID.');
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to generate QR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-5 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <QrCode className="w-6 h-6 text-copper-light" />
            QR Verification Attestation
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Generate a scannable QR code carrying the blockchain verification URL for any anchored record.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={recordId}
          onChange={(e) => setRecordId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generateQr()}
          placeholder="Record ID — e.g. complaint / inspection / document id"
          className="flex-1 px-4 py-2.5 rounded-lg bg-carbon-850 border border-carbon-700 text-sm text-warm-pale placeholder-warm-slate/60 outline-none focus:border-copper transition-colors"
        />
        <button
          onClick={generateQr}
          disabled={loading || !recordId.trim()}
          className="px-5 py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-copper-glow"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate QR'}
        </button>
      </div>

      {error && <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/5 text-sm text-rose-400">{error}</div>}

      {target && (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          <BlockchainQrCode target={target} />
          <QrVerificationCard target={target} />
        </div>
      )}
    </div>
  );
};