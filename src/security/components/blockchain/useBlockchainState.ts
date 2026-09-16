// ────────────────────────────────────────────────────────────────
// Blockchain UI — shared react hook for network status & metrics
// ────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useRef } from 'react';
import { checkNetworkStatus, onNetworkStatus } from '../../../blockchain';
import { BlockchainNetworkStatus } from '../../../blockchain';
import { isSimulationMode } from '../../../blockchain';
import { fb } from '../../lib/firebaseDb';

export interface BlockchainMetrics {
  totalRecords: number;
  verifiedRecords: number;
  pendingTransactions: number;
  failedVerification: number;
  tamperAlerts: number;
  signedApprovals: number;
  verifiedDocuments: number;
  auditEvents: number;
  recordsByType: Record<string, number>;
  verificationHistory: Array<{ ts: string; total: number; verified: number }>;
}

export const emptyMetrics: BlockchainMetrics = {
  totalRecords: 0,
  verifiedRecords: 0,
  pendingTransactions: 0,
  failedVerification: 0,
  tamperAlerts: 0,
  signedApprovals: 0,
  verifiedDocuments: 0,
  auditEvents: 0,
  recordsByType: {},
  verificationHistory: [],
};

/**
 * Loads blockchain data from the Firestore `blockchain_records` collection
 * (written by the service integrations) and tracks live network status.
 */
export function useBlockchainState() {
  const [status, setStatus] = useState<BlockchainNetworkStatus>({
    connected: false,
    network: isSimulationMode() ? 'unknown' : 'hardhat',
    chainId: null,
    blockNumber: null,
    syncing: false,
    lastCheckedAt: null,
    error: null,
  });
  const [metrics, setMetrics] = useState<BlockchainMetrics>(emptyMetrics);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [initialized, setInitialized] = useState(false);
  const mounted = useRef(true);

  const refreshMetrics = useCallback(async () => {
    try {
      const { data } = await fb('blockchain_records').select().run<any[]>();
      const rows = data ?? [];

      let totalRecords = 0;
      let verifiedRecords = 0;
      let pendingTransactions = 0;
      let failedVerification = 0;
      let tamperAlerts = 0;
      let signedApprovals = 0;
      let verifiedDocuments = 0;
      let auditEvents = 0;
      const recordsByType: Record<string, number> = {};

      const recent = rows.slice();
      for (const row of recent) {
        const statusT = row.status ?? row.blockchainStatus ?? 'CONFIRMED';
        const result = row.verificationResult ?? row.verification_status ?? 'VERIFIED';
        const rtype = row.recordType ?? row.record_type ?? 'GENERAL';
        totalRecords += 1;
        recordsByType[rtype] = (recordsByType[rtype] ?? 0) + 1;
        if (result === 'VERIFIED') verifiedRecords += 1;
        else if (result === 'TAMPERED') {
          tamperAlerts += 1;
          failedVerification += 1;
        }
        if (statusT === 'PENDING' || statusT === 'RETRY_REQUIRED') pendingTransactions += 1;
        if (rtype === 'APPROVAL') signedApprovals += 1;
        if (rtype === 'DOCUMENT') verifiedDocuments += 1;
        if (rtype === 'GENERAL' || rtype === 'AUDIT') auditEvents += 1;
      }

      setMetrics({
        totalRecords,
        verifiedRecords,
        pendingTransactions,
        failedVerification,
        tamperAlerts,
        signedApprovals,
        verifiedDocuments,
        auditEvents: verifiedDocuments + signedApprovals + Math.max(0, totalRecords - verifiedDocuments - signedApprovals),
        recordsByType,
        verificationHistory: recent.slice(0, 12).map((r) => ({
          ts: r.timestamp ?? r.created_at ?? r.registeredAt ?? new Date().toISOString(),
          total: 1,
          verified: r.verificationResult === 'VERIFIED' ? 1 : 0,
        })),
      });
      setRecentEvents(recent.slice(0, 25));
    } catch (e) {
      console.warn('[useBlockchainState] metric load failed:', e);
    } finally {
      if (mounted.current) setInitialized(true);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const st = await checkNetworkStatus();
    if (mounted.current) setStatus(st);
    return st;
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshStatus();
    refreshMetrics();
    const unsub = onNetworkStatus((st) => {
      if (mounted.current) setStatus(st);
    });
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [refreshStatus, refreshMetrics]);

  return { status, metrics, recentEvents, initialized, refreshStatus, refreshMetrics };
}