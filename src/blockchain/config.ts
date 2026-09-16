// ────────────────────────────────────────────────────────────────
// Blockchain layer — configuration
//
// Reads deployment addresses from .env (VITE_BLOCKCHAIN_*) after the
// `npm run blockchain:deploy` script has populated them. When no
// addresses are present, the system runs in SIMULATION MODE so the
// whole app keeps working with mocked ledger entries.
// ────────────────────────────────────────────────────────────────
import { BlockchainConfig } from './types';

const env = import.meta.env;

export const blockchainConfig: BlockchainConfig = {
  rpcUrl: (env.VITE_BLOCKCHAIN_RPC_URL as string) || 'http://127.0.0.1:8545',
  chainId: Number(env.VITE_BLOCKCHAIN_CHAIN_ID || 31337),
  networkName: (env.VITE_BLOCKCHAIN_NETWORK_NAME as string) || 'hardhat',
  contractAddresses: {
    MineRegistry: (env.VITE_BLOCKCHAIN_MINE_REGISTRY as string) || '',
    UserRoleRegistry: (env.VITE_BLOCKCHAIN_ROLE_REGISTRY as string) || '',
    AuditTrail: (env.VITE_BLOCKCHAIN_AUDIT_TRAIL as string) || '',
    AttendanceLedger: (env.VITE_BLOCKCHAIN_ATTENDANCE_LEDGER as string) || '',
    InspectionLedger: (env.VITE_BLOCKCHAIN_INSPECTION_LEDGER as string) || '',
    ComplaintLedger: (env.VITE_BLOCKCHAIN_COMPLAINT_LEDGER as string) || '',
    IncidentLedger: (env.VITE_BLOCKCHAIN_INCIDENT_LEDGER as string) || '',
    DocumentRegistry: (env.VITE_BLOCKCHAIN_DOCUMENT_REGISTRY as string) || '',
    ApprovalWorkflow: (env.VITE_BLOCKCHAIN_APPROVAL_WORKFLOW as string) || '',
    ComplianceLedger: (env.VITE_BLOCKCHAIN_COMPLIANCE_LEDGER as string) || '',
  },
  walletEnabled: (env.VITE_BLOCKCHAIN_WALLET_ENABLED as string) !== 'false',
  simulateMode: !(env.VITE_BLOCKCHAIN_ATTENDANCE_LEDGER as string),
};

/** True when any contract address is configured (real chain present). */
export function isBlockchainConfigured(): boolean {
  return Object.values(blockchainConfig.contractAddresses).some((a) => !!a);
}

export function isSimulationMode(): boolean {
  return blockchainConfig.simulateMode;
}

export function networkLabel(): string {
  return isSimulationMode() ? 'SIMULATED LEDGER' : blockchainConfig.networkName.toUpperCase();
}