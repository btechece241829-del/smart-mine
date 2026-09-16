// ────────────────────────────────────────────────────────────────
// Blockchain layer — contract instances & ABI
//
// Minimal ABIs (function signatures used by the app). Kept inline so
// the frontend does not need artifact files. Interface IDs match the
// Solidity contracts in /contracts.
// ────────────────────────────────────────────────────────────────
import { Contract, JsonRpcProvider } from 'ethers';
import { blockchainConfig } from './config';
import { getProvider } from './provider';

const singleInputAbi = [
  'function totalRecords() view returns (uint256)',
  'function registerRecord(string recordId, uint8 recordType, bytes32 recordHash, string network) returns (uint256)',
  'function verifyRecord(string recordId, bytes32 currentHash) view returns (bool, bytes32, uint256)',
  'function getRecord(string recordId) view returns (tuple(string recordId, uint8 recordType, bytes32 recordHash, uint256 timestamp, address creator, string network, uint256 blockNumber, bool exists))',
];

const attendanceAbi = [
  'function recordAttendance(string recordId, string mineId, string workerId, string attendanceDate, bytes32 recordHash) returns (uint256)',
  'function verifyAttendanceIntegrity(string recordId, bytes32 currentHash) view returns (bool, bytes32, uint256)',
  'function getAttendance(string recordId) view returns (tuple(string recordId, string mineId, string workerId, string attendanceDate, bytes32 recordHash, uint256 timestamp, address creator, bool verified, uint256 blockNumber))',
];

const mineRegistryAbi = [
  'function registerMine(string mineId, bytes32 dataHash, string organization)',
  'function getMineHash(string mineId) view returns (bytes32)',
  'function getMine(string mineId) view returns (tuple(string mineId, bytes32 dataHash, string organization, uint256 registeredAt, uint256 updatedAt, bool active, address registeredBy))',
];

const documentAbi = [
  'function registerDocument(string documentId, bytes32 documentHash, string documentType, string issuer, string recordType)',
  'function verifyDocument(string documentId, bytes32 currentHash) view returns (uint8, bool, bytes32, uint256)',
  'function getDocument(string documentId) view returns (tuple(string documentId, bytes32 documentHash, string documentType, string issuer, string recordType, uint256 timestamp, address registeredBy, uint8 status, string txHash))',
];

const approvalAbi = [
  'function signApproval(string approvalId, string recordId, string recordType, bytes32 recordHash, string notes)',
  'function rejectApproval(string approvalId, string recordId, string notes)',
  'function getApproval(string approvalId) view returns (tuple(string approvalId, string recordId, string recordType, uint8 status, address approver, bytes32 recordHash, uint256 timestamp, string notes))',
];

const complianceAbi = [
  'function registerCompliance(string complianceId, string regulationRef, string mineId, bytes32 evidenceHash, uint8 initialStatus)',
  'function verifyCompliance(string complianceId, bytes32 currentHash) view returns (bool, bytes32, uint8, uint256)',
  'function getCompliance(string complianceId) view returns (tuple(string complianceId, string regulationRef, string mineId, bytes32 evidenceHash, uint8 status, address responsibleAuthority, uint256 timestamp, address registeredBy))',
];

export type ContractKey =
  | 'AuditTrail'
  | 'AttendanceLedger'
  | 'MineRegistry'
  | 'DocumentRegistry'
  | 'ApprovalWorkflow'
  | 'ComplianceLedger'
  | 'InspectionLedger'
  | 'ComplaintLedger'
  | 'IncidentLedger'
  | 'UserRoleRegistry';

const CONTRACT_ABIS: Partial<Record<ContractKey, string[]>> = {
  AuditTrail: singleInputAbi,
  AttendanceLedger: attendanceAbi,
  MineRegistry: mineRegistryAbi,
  DocumentRegistry: documentAbi,
  ApprovalWorkflow: approvalAbi,
  ComplianceLedger: complianceAbi,
};

function resolveContractAddress(key: ContractKey): string {
  return blockchainConfig.contractAddresses[key] ?? '';
}

/**
 * Get a typed Contract instance connected to the RPC provider.
 * Returns null when the contract is not deployed in this environment.
 */
export function getContract(key: ContractKey, provider?: JsonRpcProvider): Contract | null {
  const address = resolveContractAddress(key);
  if (!address) return null;
  const abi = CONTRACT_ABIS[key];
  if (!abi) return null;
  return new Contract(address, abi, provider ?? getProvider());
}
