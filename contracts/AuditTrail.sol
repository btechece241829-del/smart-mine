// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AuditTrail
 * @notice Core contract that stores the hash and timestamp of every
 *         important record across all modules. Supports tamper detection
 *         by comparing current hashes with stored originals.
 */
contract AuditTrail is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum RecordType { Attendance, Inspection, Complaint, Incident, Document, Compliance, Approval, General }

    struct AuditEntry {
        string recordId;
        RecordType recordType;
        bytes32 recordHash;
        uint256 timestamp;
        address creator;
        string network;
        uint256 blockNumber;
        bool exists;
    }

    // event RecordRegistered(string indexed recordId, RecordType indexed recordType, bytes32 recordHash, address indexed creator, uint256 timestamp);
    event RecordRegistered(string recordId, uint8 indexed recordType, bytes32 recordHash, address creator, uint256 timestamp);
    event RecordVerified(string indexed recordId, bool isMatch, uint256 timestamp);
    event RecordRevoked(string indexed recordId, string reason, uint256 timestamp);

    mapping(string => AuditEntry) private _records;
    uint256 public totalRecords;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerRecord(
        string calldata recordId,
        RecordType recordType,
        bytes32 recordHash,
        string calldata network
    ) external nonReentrant returns (uint256) {
        require(!_records[recordId].exists, "Record already registered");
        uint256 idx = totalRecords;
        _records[recordId] = AuditEntry({
            recordId: recordId,
            recordType: recordType,
            recordHash: recordHash,
            timestamp: block.timestamp,
            creator: msg.sender,
            network: network,
            blockNumber: block.number,
            exists: true
        });
        totalRecords++;
        emit RecordRegistered(recordId, uint8(recordType), recordHash, msg.sender, block.timestamp);
        return idx;
    }

    function verifyRecord(string calldata recordId, bytes32 currentHash) external view returns (bool isMatch, bytes32 originalHash, uint256 timestamp) {
        require(_records[recordId].exists, "Record not found");
        return (_records[recordId].recordHash == currentHash, _records[recordId].recordHash, _records[recordId].timestamp);
    }

    function getRecord(string calldata recordId) external view returns (AuditEntry memory) {
        require(_records[recordId].exists, "Record not found");
        return _records[recordId];
    }

    function revokeRecord(string calldata recordId, string calldata reason) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_records[recordId].exists, "Record not found");
        emit RecordRevoked(recordId, reason, block.timestamp);
        // Record is not deleted — only marked via event for audit purposes
    }
}
