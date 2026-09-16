// ────────────────────────────────────────────────────────────────
// Blockchain layer — EIP712-style signed messages
//
// Wallet-based digital signatures for important trust actions
// (approvals, signing inspection reports, etc.).
// ────────────────────────────────────────────────────────────────
import { getBrowserProvider, getWalletAccount } from './provider';
import { sha256Hex } from './hash';
import { BlockchainSignature } from './types';
import { verifyMessage } from 'ethers';

export interface SignMessageOptions {
  account?: string | null;
}

/**
 * Request the user's wallet to sign a message (MetaMask personal_sign).
 * Used for approvals, inspections sign-off, document authentication.
 */
export async function signMessage(message: string, opts?: SignMessageOptions): Promise<BlockchainSignature | null> {
  const browserProvider = await getBrowserProvider();
  if (!browserProvider) {
    return null;
  }
  try {
    const signer = await browserProvider.getSigner(opts?.account || undefined);
    const address = await signer.getAddress();
    const signature = await signer.signMessage(message);
    const messageHash = await sha256Hex(message);
    return {
      address,
      signature,
      message,
      messageHash,
      signedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    console.warn('[blockchain/signer] signing failed:', (e as { message?: string }).message ?? e);
    return null;
  }
}

/** Verify a signature's holder (simplified recovery). */
export function verifySignatureAddress(message: string, signature: string): string | null {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered;
  } catch {
    return null;
  }
}

/** Build the canonical message string for a signed record event. */
export function buildSigningMessage(recordId: string, recordType: string, action: string, timestamp: string): string {
  return [
    `Smart Mine Blockchain`,
    `Action: ${action}`,
    `Record: ${recordType}:${recordId}`,
    `Timestamp: ${timestamp}`,
    `Chain: ${import.meta.env.VITE_BLOCKCHAIN_NETWORK_NAME || 'hardhat'}`,
  ].join('\n');
}

export { getWalletAccount };