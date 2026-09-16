// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IncidentLedger
 * @notice Stores incident record hashes and timeline events for tamper-evident tracking.
 */
contract IncidentLedger is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct IncidentEntry {
        string incidentId;
        string mineId;
        bytes32 recordHash;
        uint256 timestamp;
        address creator;
    }

    struct TimelineEvent {
        string incidentId;
        string eventType;
        bytes32 eventHash;
        uint256 timestamp;
        address actor;
    }

    event IncidentRegistered(string indexed incidentId, bytes32 recordHash, uint256 timestamp);
    event IncidentTimelineEvent(string indexed incidentId, string eventType, bytes32 eventHash, uint256 timestamp);

    mapping(string => IncidentEntry) private _incidents;
    mapping(string => TimelineEvent[]) private _timelines;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerIncident(
        string calldata incidentId,
        string calldata mineId,
        bytes32 recordHash
    ) external nonReentrant {
        require(bytes(_incidents[incidentId].incidentId).length == 0, "Already registered");
        _incidents[incidentId] = IncidentEntry({
            incidentId: incidentId,
            mineId: mineId,
            recordHash: recordHash,
            timestamp: block.timestamp,
            creator: msg.sender
        });
        emit IncidentRegistered(incidentId, recordHash, block.timestamp);
    }

    function addTimelineEvent(
        string calldata incidentId,
        string calldata eventType,
        bytes32 eventHash
    ) external nonReentrant {
        require(bytes(_incidents[incidentId].incidentId).length != 0, "Incident not found");
        _timelines[incidentId].push(TimelineEvent({
            incidentId: incidentId,
            eventType: eventType,
            eventHash: eventHash,
            timestamp: block.timestamp,
            actor: msg.sender
        }));
        emit IncidentTimelineEvent(incidentId, eventType, eventHash, block.timestamp);
    }

    function verifyIncident(string calldata incidentId, bytes32 currentHash) 
        external view returns (bool isMatch, bytes32 originalHash, uint256 timestamp) 
    {
        require(bytes(_incidents[incidentId].incidentId).length != 0, "Incident not found");
        return (_incidents[incidentId].recordHash == currentHash, _incidents[incidentId].recordHash, _incidents[incidentId].timestamp);
    }

    function getIncident(string calldata incidentId) external view returns (IncidentEntry memory) {
        require(bytes(_incidents[incidentId].incidentId).length != 0, "Incident not found");
        return _incidents[incidentId];
    }

    function getTimelineLength(string calldata incidentId) external view returns (uint256) {
        return _timelines[incidentId].length;
    }

    function getTimelineEvent(string calldata incidentId, uint256 index) external view returns (TimelineEvent memory) {
        require(index < _timelines[incidentId].length, "Index out of bounds");
        return _timelines[incidentId][index];
    }
}
