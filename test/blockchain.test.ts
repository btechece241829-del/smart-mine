import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("AuditTrail", function () {
  async function deployContracts() {
    const [owner, other] = await ethers.getSigners();
    const AuditTrail = await ethers.getContractFactory("AuditTrail");
    const audit = await AuditTrail.deploy();
    await audit.waitForDeployment();
    return { audit, owner, other };
  }

  it("should register a record with a hash and verify it matches", async function () {
    const { audit } = await deployContracts();
    const recordHash = ethers.keccak256(ethers.toUtf8Bytes("test-record"));
    await audit.registerRecord("rec-001", 0, recordHash, "hardhat");
    const [match, originalHash] = await audit.verifyRecord("rec-001", recordHash);
    expect(match).to.equal(true);
    expect(originalHash).to.equal(recordHash);
  });

  it("should detect tampering when the current hash differs", async function () {
    const { audit } = await deployContracts();
    const originalHash = ethers.keccak256(ethers.toUtf8Bytes("original"));
    const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes("tampered"));
    await audit.registerRecord("rec-002", 1, originalHash, "hardhat");
    const [match] = await audit.verifyRecord("rec-002", tamperedHash);
    expect(match).to.equal(false);
  });

  it("should not allow duplicate record registration", async function () {
    const { audit } = await deployContracts();
    const recordHash = ethers.keccak256(ethers.toUtf8Bytes("dup"));
    await audit.registerRecord("rec-003", 2, recordHash, "hardhat");
    await expect(
      audit.registerRecord("rec-003", 2, recordHash, "hardhat")
    ).to.be.revertedWith("Record already registered");
  });

  it("should emit RecordRegistered event", async function () {
    const { audit } = await deployContracts();
    const recordHash = ethers.keccak256(ethers.toUtf8Bytes("event-test"));
    await expect(audit.registerRecord("rec-004", 3, recordHash, "hardhat"))
      .to.emit(audit, "RecordRegistered");
  });

  it("should revert when verifying a non-existent record", async function () {
    const { audit } = await deployContracts();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("nonexist"));
    await expect(audit.verifyRecord("no-such", hash)).to.be.revertedWith("Record not found");
  });

  it("should only allow ADMIN to revoke records", async function () {
    const { audit, owner, other } = await deployContracts();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("revoke"));
    await audit.registerRecord("rec-005", 4, hash, "hardhat");
    await expect(audit.connect(other).revokeRecord("rec-005", "test"))
      .to.be.revertedWithCustomError(audit, "AccessControlUnauthorizedAccount");
    await audit.connect(owner).revokeRecord("rec-005", "test reason");
    await expect(audit.revokeRecord("rec-005", "again"))
      .to.emit(audit, "RecordRevoked");
  });
});

describe("AttendanceLedger", function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();
    const AttendanceLedger = await ethers.getContractFactory("AttendanceLedger");
    const ledger = await AttendanceLedger.deploy();
    await ledger.waitForDeployment();
    return { ledger, owner };
  }

  it("should record attendance and verify integrity", async function () {
    const { ledger } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("attendance-data"));
    await ledger.recordAttendance("att-001", "mine-1", "worker-1", "2026-09-05", hash);
    const [match, origHash] = await ledger.verifyAttendanceIntegrity("att-001", hash);
    expect(match).to.equal(true);
    expect(origHash).to.equal(hash);
  });

  it("should detect tampering on attendance record", async function () {
    const { ledger } = await deploy();
    const original = ethers.keccak256(ethers.toUtf8Bytes("original-att"));
    const modified = ethers.keccak256(ethers.toUtf8Bytes("modified-att"));
    await ledger.recordAttendance("att-002", "mine-1", "worker-2", "2026-09-05", original);
    const [match] = await ledger.verifyAttendanceIntegrity("att-002", modified);
    expect(match).to.equal(false);
  });

  it("should not allow duplicate attendance record", async function () {
    const { ledger } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-att"));
    await ledger.recordAttendance("att-003", "mine-1", "worker-1", "2026-09-05", hash);
    await expect(
      ledger.recordAttendance("att-003", "mine-1", "worker-1", "2026-09-05", hash)
    ).to.be.revertedWith("Attendance already recorded");
  });
});

describe("DocumentRegistry", function () {
  async function deploy() {
    const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
    const doc = await DocumentRegistry.deploy();
    await doc.waitForDeployment();
    return { doc };
  }

  it("should register a document hash and verify it", async function () {
    const { doc } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("pdf-document-content"));
    await doc.registerDocument("doc-001", hash, "SAFETY_CERT", "Mine Manager", "INSPECTION");
    const status = await doc.verifyDocument("doc-001", hash);
    expect(status[1]).to.equal(true);
  });

  it("should detect modified document", async function () {
    const { doc } = await deploy();
    const original = ethers.keccak256(ethers.toUtf8Bytes("original-doc"));
    const modified = ethers.keccak256(ethers.toUtf8Bytes("modified-doc"));
    await doc.registerDocument("doc-002", original, "LICENSE", "Inspector", "DOCUMENT");
    const status = await doc.verifyDocument("doc-002", modified);
    expect(status[1]).to.equal(false);
  });
});

describe("ComplianceLedger", function () {
  async function deploy() {
    const ComplianceLedger = await ethers.getContractFactory("ComplianceLedger");
    const comp = await ComplianceLedger.deploy();
    await comp.waitForDeployment();
    return { comp };
  }

  it("should register compliance and verify", async function () {
    const { comp } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("compliance-evidence"));
    await comp.registerCompliance("comp-001", "REG-101", "mine-1", hash, 1);
    const [match] = await comp.verifyCompliance("comp-001", hash);
    expect(match).to.equal(true);
  });

  it("should detect tampered compliance evidence", async function () {
    const { comp } = await deploy();
    const original = ethers.keccak256(ethers.toUtf8Bytes("original-evidence"));
    const modified = ethers.keccak256(ethers.toUtf8Bytes("modified-evidence"));
    await comp.registerCompliance("comp-002", "REG-101", "mine-1", original, 1);
    const [match] = await comp.verifyCompliance("comp-002", modified);
    expect(match).to.equal(false);
  });
});

describe("MineRegistry", function () {
  async function deploy() {
    const MineRegistry = await ethers.getContractFactory("MineRegistry");
    const mine = await MineRegistry.deploy();
    await mine.waitForDeployment();
    return { mine };
  }

  it("should register a mine and retrieve its hash", async function () {
    const { mine } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("mine-data"));
    await mine.registerMine("mine-1", hash, "CIL Ltd");
    const storedHash = await mine.getMineHash("mine-1");
    expect(storedHash).to.equal(hash);
  });
});

describe("ApprovalWorkflow", function () {
  async function deploy() {
    const ApprovalWorkflow = await ethers.getContractFactory("ApprovalWorkflow");
    const approval = await ApprovalWorkflow.deploy();
    await approval.waitForDeployment();
    return { approval };
  }

  it("should sign an approval with a record hash", async function () {
    const { approval } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("approval-data"));
    await approval.signApproval("appr-001", "insp-001", "INSPECTION", hash, "approved");
    const appr = await approval.getApproval("appr-001");
    expect(appr.recordId).to.equal("insp-001");
    expect(appr.recordHash).to.equal(hash);
  });
});