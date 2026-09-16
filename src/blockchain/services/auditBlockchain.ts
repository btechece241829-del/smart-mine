// ────────────────────────────────────────────────────────────────
// Audit trail → Blockchain integration
//
// Anchors audit events to the AuditTrail contract so the log is
// tamper-evident. Firestore keeps the full detail; the chain holds the
// proof hash + timestamp + signer.
// ────────────────────────────────────────────────────────────────
import { getContract, ContractKey } from '../contracts';
import { isSimulationMode } from '../config';
import { computeRecordHash, toBytes32 } from '../hash';
import { BlockchainRegistrationResult, BlockchainVerificationOutcome, BlockchainMeta, BlockchainRecordType } from '../types';

export interface AuditEventLike {
  id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  user_name?: string;
  role?: string;
  old_status?: string;
  new_status?: string;
  description?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/** Convert a Firestore audit entry into a record type enum byte. */
export function auditEventTypeToEnum(entityType?: string): number {
  const t = (entityType ?? '').toUpperCase();
  if (t.includes('ATTENDANCE')) return 0;
  if (t.includes('INSPECTION')) return 1;
  if (t.includes('COMPLAINT')) return 2;
  if (t.includes('INCIDENT')) return 3;
  if (t.includes('DOCUMENT')) return 4;
  if (t.includes('COMPLIANCE')) return 5;
  if (t.includes('APPROVAL')) return 6;
  return 7; // GENERAL
}

export async function registerAuditEventOnChain(event: AuditEventLike): Promise<BlockchainRegistrationResult> {
  const recordHash = await computeRecordHash(event as Record<string, unknown>);
  const recordId = event.id ?? event.entity_id ?? `audit_${Date.now()}`;

  if (isSimulationMode()) {
    return {
      ok: true,
      status: 'CONFIRMED',
      recordHash,
      txHash: `0x${'f'.repeat(12)}${Math.random().toString(36).slice(2, 12)}`,
      blockNumber: 444,
      simulated: true,
    };
  }

  const contract = getContract('AuditTrail' as ContractKey);
  if (!contract) {
    return { ok: false, status: 'FAILED', recordHash, txHash: null, blockNumber: null, error: 'AuditTrail not deployed' };
  }

  try {
    const recordType = auditEventTypeToEnum(event.entity_type);
    const tx = await contract.registerRecord(recordId, recordType, toBytes32(recordHash), 'hardhat');
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
      error: (e as { message?: string }).message ?? 'Audit event registration failed',
    };
  }
}

export async function verifyAuditEventOnChain(event: AuditEventLike): Promise<BlockchainVerificationOutcome> {
  const currentHash = await computeRecordHash(event as Record<string, unknown>);
  const recordId = event.id ?? event.entity_id ?? '';

  if (isSimulationMode()) {
    const meta = event.blockchain as BlockchainMeta | undefined;
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

  const contract = getContract('AuditTrail' as ContractKey);
  if (!contract) return { result: 'NOT_FOUND', originalHash: null, currentHash, timestamp: null, txHash: null, blockNumber: null, creator: null, network: null };

  try {
    const [match, , timestamp] = await contract.verifyRecord(recordId, toBytes32(currentHash));
    return {
      result: match ? 'VERIFIED' : 'TAMPERED',
      originalHash: null,
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

export type { BlockchainRecordType };