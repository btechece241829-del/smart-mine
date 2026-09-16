// ────────────────────────────────────────────────────────────────
// Complaint → Blockchain integration
// ────────────────────────────────────────────────────────────────
import { getContract, ContractKey } from '../contracts';
import { isSimulationMode } from '../config';
import { computeRecordHash, toBytes32 } from '../hash';
import { BlockchainRegistrationResult, BlockchainVerificationOutcome, BlockchainMeta } from '../types';

export interface ComplaintRecordLike {
  id?: string;
  complaint_number?: string;
  mine_id?: string | null;
  reported_by?: string;
  title?: string;
  severity?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export async function registerComplaintOnChain(record: ComplaintRecordLike): Promise<BlockchainRegistrationResult> {
  const recordHash = await computeRecordHash(record as Record<string, unknown>);

  if (isSimulationMode()) {
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: `0x${'c'.repeat(12)}${Math.random().toString(36).slice(2, 12)}`,
      blockNumber: 777,
      simulated: true,
    };
  }

  const contract = getContract('ComplaintLedger' as ContractKey);
  if (!contract) {
    return { ok: false, status: 'FAILED', recordHash, txHash: null, blockNumber: null, error: 'ComplaintLedger not deployed' };
  }

  try {
    const tx = await contract.registerComplaint(
      record.id ?? '',
      record.mine_id ?? '',
      record.reported_by ?? '',
      toBytes32(recordHash),
      record.severity ?? 'Medium',
    );
    const receipt = await tx.wait();
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: receipt.hash ?? tx.hash ?? null,
      blockNumber: receipt.blockNumber ?? null,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 'FAILED',
      recordHash,
      txHash: null,
      blockNumber: null,
      error: (e as { message?: string }).message ?? 'Complaint registration failed',
    };
  }
}

export async function verifyComplaintOnChain(record: ComplaintRecordLike): Promise<BlockchainVerificationOutcome> {
  const currentHash = await computeRecordHash(record as Record<string, unknown>);

  if (isSimulationMode()) {
    const meta = record.blockchain as BlockchainMeta | undefined;
    const match = meta?.recordHash ? meta.recordHash.toLowerCase() === currentHash.toLowerCase() : false;
    return {
      result: meta?.recordHash ? (match ? 'VERIFIED' : 'TAMPERED') : 'NOT_FOUND',
      originalHash: meta?.recordHash ?? null,
      currentHash,
      timestamp: meta?.timestamp ?? null,
      txHash: meta?.txHash ?? null,
      blockNumber: meta?.blockNumber ?? null,
      creator: null,
      network: 'simulated',
      simulated: true,
    };
  }

  const contract = getContract('ComplaintLedger' as ContractKey);
  if (!contract) return { result: 'NOT_FOUND', originalHash: null, currentHash, timestamp: null, txHash: null, blockNumber: null, creator: null, network: null };

  try {
    const [match, originalHash, timestamp] = await contract.verifyComplaint(record.id ?? '', toBytes32(currentHash));
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