// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ApprovalWorkflow
 * @notice On-chain approval tracking with digital signatures.
 *         Records approval/rejection events for compliance actions.
 */
contract ApprovalWorkflow is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum ApprovalStatus { Pending, Approved, Rejected, Revoked }

    struct ApprovalRecord {
        string approvalId;
        string recordId;
        string recordType;
        ApprovalStatus status;
        address approver;
        bytes32 recordHash;
        uint256 timestamp;
        string notes;
    }

    event ApprovalSigned(string indexed approvalId, string indexed recordId, address indexed approver, uint256 timestamp);
    event ApprovalRejected(string indexed approvalId, string recordId, address approver, uint256 timestamp);
    event ApprovalRevoked(string indexed approvalId, string reason, uint256 timestamp);

    mapping(string => ApprovalRecord) private _approvals;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function signApproval(
        string calldata approvalId,
        string calldata recordId,
        string calldata recordType,
        bytes32 recordHash,
        string calldata notes
    ) external nonReentrant {
        require(bytes(_approvals[approvalId].approvalId).length == 0, "Approval already exists");
        _approvals[approvalId] = ApprovalRecord({
            approvalId: approvalId,
            recordId: recordId,
            recordType: recordType,
            status: ApprovalStatus.Approved,
            approver: msg.sender,
            recordHash: recordHash,
            timestamp: block.timestamp,
            notes: notes
        });
        emit ApprovalSigned(approvalId, recordId, msg.sender, block.timestamp);
    }

    function rejectApproval(
        string calldata approvalId,
        string calldata recordId,
        string calldata notes
    ) external nonReentrant {
        require(bytes(_approvals[approvalId].approvalId).length == 0, "Approval already exists");
        _approvals[approvalId] = ApprovalRecord({
            approvalId: approvalId,
            recordId: recordId,
            recordType: "",
            status: ApprovalStatus.Rejected,
            approver: msg.sender,
            recordHash: bytes32(0),
            timestamp: block.timestamp,
            notes: notes
        });
        emit ApprovalRejected(approvalId, recordId, msg.sender, block.timestamp);
    }

    function getApproval(string calldata approvalId) external view returns (ApprovalRecord memory) {
        require(bytes(_approvals[approvalId].approvalId).length != 0, "Approval not found");
        return _approvals[approvalId];
    }

    function getApprovalStatus(string calldata approvalId) external view returns (ApprovalStatus) {
        require(bytes(_approvals[approvalId].approvalId).length != 0, "Approval not found");
        return _approvals[approvalId].status;
    }
}
