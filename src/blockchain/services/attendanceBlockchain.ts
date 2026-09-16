// ────────────────────────────────────────────────────────────────
// Attendance → Blockchain integration
//
// Anchors each attendance record hash to the AttendanceLedger contract
// and provides integrity verification (tamper detection).
// ────────────────────────────────────────────────────────────────
import { getContract, ContractKey } from '../contracts';
import { isSimulationMode } from '../config';
import { computeRecordHash, toBytes32 } from '../hash';
import { getProvider } from '../provider';
import { BlockchainRegistrationResult, BlockchainMeta, BlockchainVerificationOutcome } from '../types';

export interface AttendanceRecordLike {
  id?: string;
  mine_id?: string;
  worker_id?: string;
  attendance_date?: string;
  shift?: string;
  status?: string;
  verification_status?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Register an attendance record on-chain. Returns the transaction hash.
 * Never throws — returns a graceful FAILED result instead.
 */
export async function registerAttendanceOnChain(
  record: AttendanceRecordLike,
): Promise<BlockchainRegistrationResult> {
  const recordHash = await computeRecordHash(record as Record<string, unknown>);

  if (isSimulationMode()) {
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: `0x${'a'.repeat(16)}${Math.random().toString(36).slice(2, 10)}`,
      blockNumber: 999,
      simulated: true,
    };
  }

  const contract = getContract('AttendanceLedger' as ContractKey);
  if (!contract) {
    return { ok: false, status: 'FAILED', recordHash, txHash: null, blockNumber: null, error: 'AttendanceLedger not deployed' };
  }

  try {
    const tx = await contract.recordAttendance(
      record.id ?? '',
      record.mine_id ?? '',
      record.worker_id ?? '',
      record.attendance_date ?? '',
      toBytes32(recordHash),
    );
    const receipt = await tx.wait();
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: receipt.hash ?? (tx.hash as string) ?? null,
      blockNumber: receipt.blockNumber ?? null,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 'FAILED',
      recordHash,
      txHash: null,
      blockNumber: null,
      error: (e as { message?: string }).message ?? 'Attendance registration failed',
    };
  }
}

/**
 * Verify attendance integrity: current Firestore hash vs on-chain hash.
 */
export async function verifyAttendanceOnChain(
  record: AttendanceRecordLike,
): Promise<BlockchainVerificationOutcome> {
  const currentHash = await computeRecordHash(record as Record<string, unknown>);

  if (isSimulationMode()) {
    const meta = record.blockchain as BlockchainMeta | undefined;
    if (meta?.recordHash) {
      const match = (meta.recordHash as string).toLowerCase() === currentHash.toLowerCase();
      return {
        result: match ? 'VERIFIED' : 'TAMPERED',
        originalHash: meta.recordHash,
        currentHash,
        timestamp: meta.timestamp ?? null,
        txHash: meta.txHash ?? null,
        blockNumber: meta.blockNumber ?? null,
        creator: meta.creator ?? null,
        network: meta.network ?? 'simulated',
        simulated: true,
      };
    }
    return {
      result: 'NOT_FOUND',
      originalHash: null,
      currentHash,
      timestamp: null,
      txHash: null,
      blockNumber: null,
      creator: null,
      network: 'simulated',
      simulated: true,
    };
  }

  const contract = getContract('AttendanceLedger' as ContractKey);
  if (!contract) return { result: 'NOT_FOUND', originalHash: null, currentHash, timestamp: null, txHash: null, blockNumber: null, creator: null, network: null };

  try {
    const [match, originalHash, timestamp] = await contract.verifyAttendanceIntegrity(record.id ?? '', toBytes32(currentHash));
    return {
      result: match ? 'VERIFIED' : 'TAMPERED',
      originalHash: (originalHash as string).replace(/^0x/, '').toLowerCase(),
      currentHash,
      timestamp: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
      txHash: null,
      blockNumber: null,
      creator: null,
      network: 'blockchain',
    };
  } catch {
    return { result: 'NOT_FOUND', originalHash: null, currentHash, timestamp: null, txHash: null, blockNumber: null, creator: null, network: 'blockchain' };
  }
}

export { getProvider };