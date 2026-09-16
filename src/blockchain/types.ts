// ────────────────────────────────────────────────────────────────
// Blockchain layer — shared type definitions
// ────────────────────────────────────────────────────────────────

/** Transaction lifecycle states used throughout the app. */
export type BlockchainTxStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RETRY_REQUIRED';

/** Integrity result of a hash comparison against the ledger. */
export type VerificationResult = 'VERIFIED' | 'TAMPERED' | 'NOT_FOUND' | 'PENDING';

/** The blockchain metadata block stored on every anchored Firestore record. */
export interface BlockchainMeta {
  status: BlockchainTxStatus;
  recordHash: string | null;
  txHash: string | null;
  blockNumber: number | null;
  network: string | null;
  timestamp: string | null;
  creator: string | null;
  lastVerifiedAt: string | null;
  verificationResult?: VerificationResult | null;
  error?: string | null;
}

export type BlockchainRecordType =
  | 'ATTENDANCE'
  | 'INSPECTION'
  | 'COMPLAINT'
  | 'INCIDENT'
  | 'DOCUMENT'
  | 'COMPLIANCE'
  | 'APPROVAL'
  | 'GENERAL'
  | 'MINE';

export type BlockchainNetwork = 'hardhat' | 'localhost' | 'sepolia' | 'permissioned' | 'unknown';

export interface BlockchainNetworkStatus {
  connected: boolean;
  network: BlockchainNetwork;
  chainId: number | null;
  blockNumber: number | null;
  syncing: boolean;
  lastCheckedAt: string | null;
  error: string | null;
}

export interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  networkName: string;
  contractAddresses: Record<string, string>;
  walletEnabled: boolean;
  simulateMode: boolean;
}

/** Result of recording a record to the blockchain ledger. */
export interface BlockchainRegistrationResult {
  ok: boolean;
  status: BlockchainTxStatus;
  recordHash: string | null;
  txHash: string | null;
  blockNumber: number | null;
  error?: string | null;
  simulated?: boolean;
}

/** Result of verifying a record's integrity against the ledger. */
export interface BlockchainVerificationOutcome {
  result: VerificationResult;
  originalHash: string | null;
  currentHash: string | null;
  timestamp: string | null;
  txHash: string | null;
  blockNumber: number | null;
  creator: string | null;
  network: string | null;
  error?: string | null;
  simulated?: boolean;
}

export interface BlockchainSignatureRequest {
  message: string;
  account?: string | null;
}

export interface BlockchainSignature {
  address: string;
  signature: string;
  message: string;
  messageHash: string;
  signedAt: string;
}

/** A digitally-signed approval. */
export interface SignedApproval {
  approvalId: string;
  recordId: string;
  recordType: BlockchainRecordType;
  signerAddress: string;
  signerName: string;
  signature: string;
  messageHash: string;
  status: 'Approved' | 'Rejected';
  timestamp: string;
  blockchain: BlockchainMeta | null;
}