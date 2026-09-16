import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { ethers } = hre;

// ESM has no `__dirname` — derive it from the module URL
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Deploy all smart contracts to the local Hardhat network and
 * write the resulting addresses into .env so the Vite frontend can use them.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // 1. Deploy all contracts
  const MineRegistry = await ethers.getContractFactory("MineRegistry");
  const mineRegistry = await MineRegistry.deploy();
  await mineRegistry.waitForDeployment();

  const UserRoleRegistry = await ethers.getContractFactory("UserRoleRegistry");
  const userRoleRegistry = await UserRoleRegistry.deploy();
  await userRoleRegistry.waitForDeployment();

  const AuditTrail = await ethers.getContractFactory("AuditTrail");
  const auditTrail = await AuditTrail.deploy();
  await auditTrail.waitForDeployment();

  const AttendanceLedger = await ethers.getContractFactory("AttendanceLedger");
  const attendanceLedger = await AttendanceLedger.deploy();
  await attendanceLedger.waitForDeployment();

  const InspectionLedger = await ethers.getContractFactory("InspectionLedger");
  const inspectionLedger = await InspectionLedger.deploy();
  await inspectionLedger.waitForDeployment();

  const ComplaintLedger = await ethers.getContractFactory("ComplaintLedger");
  const complaintLedger = await ComplaintLedger.deploy();
  await complaintLedger.waitForDeployment();

  const IncidentLedger = await ethers.getContractFactory("IncidentLedger");
  const incidentLedger = await IncidentLedger.deploy();
  await incidentLedger.waitForDeployment();

  const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await DocumentRegistry.deploy();
  await documentRegistry.waitForDeployment();

  const ApprovalWorkflow = await ethers.getContractFactory("ApprovalWorkflow");
  const approvalWorkflow = await ApprovalWorkflow.deploy();
  await approvalWorkflow.waitForDeployment();

  const ComplianceLedger = await ethers.getContractFactory("ComplianceLedger");
  const complianceLedger = await ComplianceLedger.deploy();
  await complianceLedger.waitForDeployment();

  const addresses = {
    MineRegistry: await mineRegistry.getAddress(),
    UserRoleRegistry: await userRoleRegistry.getAddress(),
    AuditTrail: await auditTrail.getAddress(),
    AttendanceLedger: await attendanceLedger.getAddress(),
    InspectionLedger: await inspectionLedger.getAddress(),
    ComplaintLedger: await complaintLedger.getAddress(),
    IncidentLedger: await incidentLedger.getAddress(),
    DocumentRegistry: await documentRegistry.getAddress(),
    ApprovalWorkflow: await approvalWorkflow.getAddress(),
    ComplianceLedger: await complianceLedger.getAddress(),
  };

  console.log("\n=========== DEPLOYED CONTRACT ADDRESSES ===========");
  Object.entries(addresses).forEach(([name, addr]) => {
    console.log(`${name}: ${addr}`);
  });
  console.log("===================================================\n");

  // 2. Write addresses into .env so the frontend picks them up
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const envVars: Record<string, string> = {
    "VITE_BLOCKCHAIN_DEPLOYER_ADDRESS": deployer.address,
    "VITE_BLOCKCHAIN_MINE_REGISTRY": addresses.MineRegistry,
    "VITE_BLOCKCHAIN_ROLE_REGISTRY": addresses.UserRoleRegistry,
    "VITE_BLOCKCHAIN_ATTENDANCE_LEDGER": addresses.AttendanceLedger,
    "VITE_BLOCKCHAIN_INSPECTION_LEDGER": addresses.InspectionLedger,
    "VITE_BLOCKCHAIN_COMPLAINT_LEDGER": addresses.ComplaintLedger,
    "VITE_BLOCKCHAIN_INCIDENT_LEDGER": addresses.IncidentLedger,
    "VITE_BLOCKCHAIN_DOCUMENT_REGISTRY": addresses.DocumentRegistry,
    "VITE_BLOCKCHAIN_APPROVAL_WORKFLOW": addresses.ApprovalWorkflow,
    "VITE_BLOCKCHAIN_COMPLIANCE_LEDGER": addresses.ComplianceLedger,
    "VITE_BLOCKCHAIN_AUDIT_TRAIL": addresses.AuditTrail,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    const line = `${key}=${value}`;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `\n${line}`;
    }
  });

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Contract addresses written to .env");

  // 3. Write a blockchain.deployments.json for the frontend too
  const deployInfoPath = path.resolve(__dirname, "../src/blockchain/deployments.json");
  const deployInfo = {
    network: process.env.HARDHAT_NETWORK || "localhost",
    chainId: 31337,
    deployer: deployer.address,
    contracts: addresses,
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(deployInfoPath), { recursive: true });
  fs.writeFileSync(deployInfoPath, JSON.stringify(deployInfo, null, 2));
  console.log("✅ Deployment info written to src/blockchain/deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });