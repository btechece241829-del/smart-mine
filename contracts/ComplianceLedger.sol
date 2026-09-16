// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ComplianceLedger
 * @notice Blockchain-backed compliance tracking with full lifecycle records.
 */
contract ComplianceLedger is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum ComplianceStatus { Pending, InProgress, Verified, Compliant, NonCompliant, Expired }

    struct ComplianceEntry {
        string complianceId;
        string regulationRef;
        string mineId;
        bytes32 evidenceHash;
        ComplianceStatus status;
        address responsibleAuthority;
        uint256 timestamp;
        address registeredBy;
    }

    event ComplianceRegistered(string indexed complianceId, string mineId, uint256 timestamp);
    event ComplianceStatusUpdated(string indexed complianceId, uint8 newStatus, uint256 timestamp);
    event ComplianceVerified(string indexed complianceId, bool isMatch, uint256 timestamp);

    mapping(string => ComplianceEntry) private _entries;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerCompliance(
        string calldata complianceId,
        string calldata regulationRef,
        string calldata mineId,
        bytes32 evidenceHash,
        ComplianceStatus initialStatus
    ) external nonReentrant {
        require(bytes(_entries[complianceId].complianceId).length == 0, "Already registered");
        _entries[complianceId] = ComplianceEntry({
            complianceId: complianceId,
            regulationRef: regulationRef,
            mineId: mineId,
            evidenceHash: evidenceHash,
            status: initialStatus,
            responsibleAuthority: msg.sender,
            timestamp: block.timestamp,
            registeredBy: msg.sender
        });
        emit ComplianceRegistered(complianceId, mineId, block.timestamp);
    }

    function updateStatus(string calldata complianceId, ComplianceStatus newStatus) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(bytes(_entries[complianceId].complianceId).length != 0, "Not found");
        _entries[complianceId].status = newStatus;
        emit ComplianceStatusUpdated(complianceId, uint8(newStatus), block.timestamp);
    }

    function verifyCompliance(string calldata complianceId, bytes32 currentHash) 
        external view returns (bool isMatch, bytes32 originalHash, ComplianceStatus status, uint256 timestamp) 
    {
        require(bytes(_entries[complianceId].complianceId).length != 0, "Not found");
        ComplianceEntry memory entry = _entries[complianceId];
        return (entry.evidenceHash == currentHash, entry.evidenceHash, entry.status, entry.timestamp);
    }

    function getCompliance(string calldata complianceId) external view returns (ComplianceEntry memory) {
        require(bytes(_entries[complianceId].complianceId).length != 0, "Not found");
        return _entries[complianceId];
    }
}
