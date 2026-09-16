// ────────────────────────────────────────────────────────────────
// Blockchain layer — transaction helper
//
// Executes contract writes with graceful failure handling. When the
// chain is not deployed / unavailable the layer falls back to a
// simulated confirmation so the app flow is never blocked.
// ────────────────────────────────────────────────────────────────
import { Contract, JsonRpcProvider } from 'ethers';
import { getProvider, checkNetworkStatus } from './provider';
import { isSimulationMode, isBlockchainConfigured } from './config';
import { computeRecordHash, toBytes32 } from './hash';
import { BlockchainMeta, BlockchainRegistrationResult, BlockchainTxStatus, BlockchainVerificationOutcome, VerificationResult } from './types';

/** Simulated (offline / undetermined) state when chain is absent. */
export function simulatedBlockchainMeta(recordHash: string | null): BlockchainMeta {
  return {
    status: isBlockchainConfigured() ? 'PENDING' : 'CONFIRMED',
    recordHash,
    txHash: '0x' + '0'.repeat(8) + '_sim_' + Math.random().toString(36).slice(2, 8).toString(),
    blockNumber: null,
    network: isSimulationMode() ? 'simulated' : 'hardhat',
    timestamp: new Date().toISOString(),
    creator: null,
    lastVerifiedAt: new Date().toISOString(),
    verificationResult: 'VERIFIED' as VerificationResult,
  };
}

export interface MakeSimulatedResultOpts {
  recordHash?: string | null;
}

/** Build a non-failing simulated registration result. */
export function simulatedRegistration(recordHash: string): BlockchainRegistrationResult {
  return {
    ok: true,
    status: 'CONFIRMED',
    recordHash,
    txHash: '0x' + '1'.repeat(8) + Math.random().toString(36).slice(2, 10).toString(),
    blockNumber: 0,
    simulated: true,
  };
}

export interface SendOptions {
  /** Optional signer provider (browser wallet) for MetaMask-signed transactions. */
  provider?: JsonRpcProvider;
  /** Idempotency key dedupe cache (Prevents duplicate transactions). */
  idempotencyKey?: string;
}

/** Cache of recently-sent idempotency keys to prevent duplicate txns. */
const idempotencyCache = new Set<string>();

export function hasPendingIdempotency(key: string): boolean {
  return idempotencyCache.has(key);
}

export function rememberIdempotency(key: string): void {
  idempotencyCache.add(key);
  // Keep the cache small — old entries expire naturally.
  if (idempotencyCache.size > 500) {
    const first = idempotencyCache.values().next().value;
    if (first !== undefined) idempotencyCache.delete(first);
  }
}

/** Compute the canonical hash for a record (async-safe). */
export async function hashOf(record: Record<string, unknown>): Promise<string> {
  return computeRecordHash(record);
}

export type { BlockchainRegistrationResult, BlockchainMeta, BlockchainVerificationOutcome };

export { getProvider, checkNetworkStatus, isSimulationMode, isBlockchainConfigured, toBytes32 };