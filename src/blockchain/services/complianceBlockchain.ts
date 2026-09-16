// ────────────────────────────────────────────────────────────────
// Compliance → Blockchain integration
// ────────────────────────────────────────────────────────────────
import { getContract, ContractKey } from '../contracts';
import { isSimulationMode } from '../config';
import { computeRecordHash, toBytes32 } from '../hash';
import { BlockchainRegistrationResult, BlockchainVerificationOutcome, BlockchainMeta } from '../types';

export interface ComplianceRecordLike {
  id?: string;
  compliance_id?: string;
  regulation_ref?: string;
  mine_id?: string;
  evidence_hash?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export async function registerComplianceOnChain(record: ComplianceRecordLike): Promise<BlockchainRegistrationResult> {
  const recordHash = await computeRecordHash(record as Record<string, unknown>);

  if (isSimulationMode()) {
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: `0x${'e'.repeat(12)}${Math.random().toString(36).slice(2, 12)}`,
      blockNumber: 555,
      simulated: true,
    };
  }

  const contract = getContract('ComplianceLedger' as ContractKey);
  if (!contract) {
    return { ok: false, status: 'FAILED', recordHash, txHash: null, blockNumber: null, error: 'ComplianceLedger not deployed' };
  }

  try {
    const tx = await contract.registerCompliance(
      record.id ?? record.compliance_id ?? '',
      record.regulation_ref ?? '',
      record.mine_id ?? '',
      toBytes32(recordHash),
      0, // Pending
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
      error: (e as { message?: string }).message ?? 'Compliance registration failed',
    };
  }
}

export async function verifyComplianceOnChain(record: ComplianceRecordLike): Promise<BlockchainVerificationOutcome> {
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

  const contract = getContract('ComplianceLedger' as ContractKey);
  if (!contract) return { result: 'NOT_FOUND', originalHash: null, currentHash, timestamp: null, txHash: null, blockNumber: null, creator: null, network: null };

  try {
    const [match, originalHash, , timestamp] = await contract.verifyCompliance(record.id ?? record.compliance_id ?? '', toBytes32(currentHash));
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