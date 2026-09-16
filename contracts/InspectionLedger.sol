// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title InspectionLedger
 * @notice Stores inspection record hashes for tamper-evident inspection tracking.
 */
contract InspectionLedger is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct InspectionEntry {
        string inspectionId;
        string mineId;
        string inspectorId;
        bytes32 recordHash;
        uint256 timestamp;
        address creator;
        bool verified;
    }

    event InspectionRegistered(string indexed inspectionId, bytes32 recordHash, address indexed creator, uint256 timestamp);
    event InspectionVerified(string indexed inspectionId, bool isMatch, uint256 timestamp);

    mapping(string => InspectionEntry) private _entries;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerInspection(
        string calldata inspectionId,
        string calldata mineId,
        string calldata inspectorId,
        bytes32 recordHash
    ) external nonReentrant {
        require(bytes(_entries[inspectionId].inspectionId).length == 0, "Already registered");
        _entries[inspectionId] = InspectionEntry({
            inspectionId: inspectionId,
            mineId: mineId,
            inspectorId: inspectorId,
            recordHash: recordHash,
            timestamp: block.timestamp,
            creator: msg.sender,
            verified: false
        });
        emit InspectionRegistered(inspectionId, recordHash, msg.sender, block.timestamp);
    }

    function verifyInspection(string calldata inspectionId, bytes32 currentHash) 
        external view returns (bool isMatch, bytes32 originalHash, uint256 timestamp) 
    {
        require(bytes(_entries[inspectionId].inspectionId).length != 0, "Inspection not found");
        InspectionEntry memory entry = _entries[inspectionId];
        return (entry.recordHash == currentHash, entry.recordHash, entry.timestamp);
    }

    function getInspection(string calldata inspectionId) external view returns (InspectionEntry memory) {
        require(bytes(_entries[inspectionId].inspectionId).length != 0, "Inspection not found");
        return _entries[inspectionId];
    }
}
