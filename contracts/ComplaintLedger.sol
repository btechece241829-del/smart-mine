// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ComplaintLedger
 * @notice Stores complaint record hashes for tamper-evident complaint tracking.
 */
contract ComplaintLedger is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct ComplaintEntry {
        string complaintId;
        string mineId;
        string reporterId;
        bytes32 recordHash;
        uint256 timestamp;
        address creator;
        string severity;
        bool verified;
    }

    event ComplaintRegistered(string indexed complaintId, bytes32 recordHash, address indexed creator, uint256 timestamp);
    event ComplaintVerified(string indexed complaintId, bool isMatch, uint256 timestamp);

    mapping(string => ComplaintEntry) private _entries;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerComplaint(
        string calldata complaintId,
        string calldata mineId,
        string calldata reporterId,
        bytes32 recordHash,
        string calldata severity
    ) external nonReentrant {
        require(bytes(_entries[complaintId].complaintId).length == 0, "Already registered");
        _entries[complaintId] = ComplaintEntry({
            complaintId: complaintId,
            mineId: mineId,
            reporterId: reporterId,
            recordHash: recordHash,
            timestamp: block.timestamp,
            creator: msg.sender,
            severity: severity,
            verified: false
        });
        emit ComplaintRegistered(complaintId, recordHash, msg.sender, block.timestamp);
    }

    function verifyComplaint(string calldata complaintId, bytes32 currentHash) 
        external view returns (bool isMatch, bytes32 originalHash, uint256 timestamp) 
    {
        require(bytes(_entries[complaintId].complaintId).length != 0, "Complaint not found");
        ComplaintEntry memory entry = _entries[complaintId];
        return (entry.recordHash == currentHash, entry.recordHash, entry.timestamp);
    }

    function getComplaint(string calldata complaintId) external view returns (ComplaintEntry memory) {
        require(bytes(_entries[complaintId].complaintId).length != 0, "Complaint not found");
        return _entries[complaintId];
    }
}
