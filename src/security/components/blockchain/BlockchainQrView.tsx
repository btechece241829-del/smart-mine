// ────────────────────────────────────────────────────────────────
// QR Code Verification — generate & scan verification QR codes
// ────────────────────────────────────────────────────────────────
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldCheck, QrCode } from 'lucide-react';
import { IntegrityBadge, TxHashCell } from './BlockchainBadges';
import { VerificationResult } from '../../../blockchain';

export interface QrVerificationTarget {
  recordId: string;
  recordType: string;
  issuingOrg: string;
  timestamp: string;
  blockchain: {
    recordHash?: string | null;
    txHash?: string | null;
    network?: string | null;
  } | null;
  status: VerificationResult | 'PENDING';
}

const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';

/** Build the verification URL encoded in the QR code. */
export function buildVerificationUrl(target: QrVerificationTarget): string {
  const params = new URLSearchParams({
    type: target.recordType,
    id: target.recordId,
    org: target.issuingOrg,
    ts: target.timestamp,
  });
  return `${baseUrl}?verify=1&${params.toString()}`;
}

/** QR code canvas with the verification URL. */
export const BlockchainQrCode: React.FC<{ target: QrVerificationTarget; size?: number }> = ({ target, size = 140 }) => {
  const url = buildVerificationUrl(target);
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl">
      <QRCodeCanvas value={url} size={size} level="M" includeMargin />
      <div className="text-[9px] font-mono text-gray-700 break-all text-center max-w-[160px]">{url}</div>
    </div>
  );
};

/** Display card summarizing a QR verification target (used on scan). */
export const QrVerificationCard: React.FC<{ target: QrVerificationTarget }> = ({ target }) => (
  <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-5 shadow-panel space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-copper-light">
        <QrCode className="w-5 h-5" />
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide">Blockchain Proof Verified</h3>
      </div>
      <IntegrityBadge result={target.status === 'PENDING' ? 'PENDING' : target.status} size="md" />
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
      <div className="text-warm-slate">Record</div>
      <div className="text-warm-pale truncate" title={target.recordId}>{target.recordId}</div>
      <div className="text-warm-slate">Type</div>
      <div className="text-warm-sand">{target.recordType}</div>
      <div className="text-warm-slate">Issuing Org</div>
      <div className="text-warm-sand">{target.issuingOrg}</div>
      <div className="text-warm-slate">Timestamp</div>
      <div className="text-warm-sand">{new Date(target.timestamp).toLocaleString()}</div>
      <div className="text-warm-slate">Network</div>
      <div className="text-warm-sand">{target.blockchain?.network ?? '—'}</div>
      <div className="text-warm-slate">Record Hash</div>
      <div className="text-copper-light truncate" style={{ alignSelf: 'center' }}>
        <TxHashCell txHash={target.blockchain?.recordHash} />
      </div>
      <div className="text-warm-slate">Tx Hash</div>
      <TxHashCell txHash={target.blockchain?.txHash} />
    </div>
    <div className="flex items-center gap-2 p-2 rounded-lg bg-carbon-900/80 border border-copper/30">
      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
      <p className="text-[11px] text-warm-sand">Authenticity independently verifiable. Any modification to this record after issuance is automatically detectable.</p>
    </div>
  </div>
);

export { QrCode };