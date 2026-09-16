// ────────────────────────────────────────────────────────────────
// Blockchain layer — record verification
//
// Compares the current Firebase record hash with the hash anchored in
// the smart contract to detect tampering.
// ────────────────────────────────────────────────────────────────
import { Contract } from 'ethers';
import { getContract, ContractKey } from './contracts';
import { isSimulationMode } from './config';
import { computeRecordHash, toBytes32 } from './hash';
import { BlockchainVerificationOutcome, VerificationResult, BlockchainMeta } from './types';

/** Extract a single verification outcome from a contract verify() call. */
function outcomeFromRaw(
  raw: { isMatch?: boolean; match?: boolean; _match?: boolean; originalHash?: string; recordHash?: string; timestamp?: bigint | number | string; success?: boolean },
  currentHash: string,
  network: string | null,
): BlockchainVerificationOutcome {
  const isMatch = raw.isMatch ?? raw.match ?? raw._match ?? raw.success ?? false;
  const originalHash = raw.originalHash ?? raw.recordHash ?? null;
  const ts = raw.timestamp;
  const timestamp = ts === undefined || ts === null ? null : new Date(Number(ts) * 1000).toISOString();
  return {
    result: isMatch ? 'VERIFIED' : 'TAMPERED',
    originalHash: originalHash ? `0x${(originalHash as string).replace(/^0x/, '').toLowerCase()}` : null,
    currentHash,
    timestamp,
    txHash: null,
    blockNumber: null,
    creator: null,
    network,
  };
}

/**
 * Verify a record's integrity by comparing its current hash against the
 * hash in the on-chain ledger.
 *
 * @param contractKey which ledger contract holds this record
 * @param verifyFn callback that invokes the contract's verify function
 * @param record the current Firestore record (hash computed automatically)
 */
export async function verifyRecordOnChain(
  contractKey: ContractKey,
  verifyFn: (contract: Contract, recordHash: string, invocation: any) => Promise<unknown>,
  record: Record<string, unknown>,
): Promise<BlockchainVerificationOutcome> {
  const currentHash = await computeRecordHash(record);

  // Simulation mode: verify locally against the meta hash if present.
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
        blockNumber: meta.blockNumber,
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

  const contract = getContract(contractKey);
  if (!contract) {
    return {
      result: 'NOT_FOUND',
      originalHash: null,
      currentHash,
      timestamp: null,
      txHash: null,
      blockNumber: null,
      creator: null,
      network: null,
      error: 'Contract not deployed',
    };
  }

  try {
    const raw = await verifyFn(contract, toBytes32(currentHash), contract);
    // Try common return shapes
    if (Array.isArray(raw)) {
      const [match, originalHash, timestamp] = raw as [boolean, string, bigint | number | string];
      return outcomeFromRaw({ isMatch: match, originalHash: originalHash as string, timestamp }, currentHash, 'blockchain');
    }
    if (typeof raw === 'object' && raw !== null) {
      return outcomeFromRaw(raw as Record<string, unknown> as never, currentHash, 'blockchain');
    }
    return {
      result: 'PENDING',
      originalHash: null,
      currentHash,
      timestamp: null,
      txHash: null,
      blockNumber: null,
      creator: null,
      network: 'blockchain',
    };
  } catch (e: unknown) {
    return {
      result: 'NOT_FOUND',
      originalHash: null,
      currentHash,
      timestamp: null,
      txHash: null,
      blockNumber: null,
      creator: null,
      network: 'blockchain',
      error: (e as { message?: string }).message ?? 'Verification failed',
    };
  }
}

/** Generic helper to run a write + read-back of a registration. */
export async function registerAndConfirm(
  contractKey: ContractKey,
  invoke: (contract: Contract, ctx: any) => Promise<unknown>,
): Promise<{ ok: boolean; txHash: string | null; blockNumber: number | null; error?: string }> {
  const contract = getContract(contractKey);
  if (!contract) {
    return { ok: true, txHash: null, blockNumber: null, error: undefined }; // simulation / not configured
  }
  try {
    const result = await invoke(contract, contract.runner);
    if (typeof result === 'object' && result !== null && 'hash' in (result as Record<string, unknown>)) {
      return { ok: true, txHash: (result as { hash: string }).hash, blockNumber: null, error: undefined };
    }
    return { ok: true, txHash: null, blockNumber: null, error: undefined };
  } catch (e: unknown) {
    return { ok: false, txHash: null, blockNumber: null, error: (e as { message?: string }).message ?? 'Transaction failed' };
  }
}

export type { VerificationResult };
export { getContract };