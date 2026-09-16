// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AttendanceLedger
 * @notice Stores attendance record hashes for tamper-evident attendance tracking.
 */
contract AttendanceLedger is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OVERMAN_ROLE = keccak256("OVERMAN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct AttendanceEntry {
        string recordId;
        string mineId;
        string workerId;
        string attendanceDate;
        bytes32 recordHash;
        uint256 timestamp;
        address creator;
        bool verified;
        uint256 blockNumber;
    }

    event AttendanceRecorded(string indexed recordId, bytes32 recordHash, address indexed creator, uint256 timestamp);
    event AttendanceVerified(string indexed recordId, address indexed verifier, uint256 timestamp);
    event AttendanceTamperDetected(string indexed recordId, bytes32 expectedHash, bytes32 actualHash, uint256 timestamp);

    mapping(string => AttendanceEntry) private _records;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OVERMAN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function recordAttendance(
        string calldata recordId,
        string calldata mineId,
        string calldata workerId,
        string calldata attendanceDate,
        bytes32 recordHash
    ) external nonReentrant returns (uint256) {
        require(bytes(_records[recordId].recordId).length == 0, "Attendance already recorded");
        _records[recordId] = AttendanceEntry({
            recordId: recordId,
            mineId: mineId,
            workerId: workerId,
            attendanceDate: attendanceDate,
            recordHash: recordHash,
            timestamp: block.timestamp,
            creator: msg.sender,
            verified: false,
            blockNumber: block.number
        });
        emit AttendanceRecorded(recordId, recordHash, msg.sender, block.timestamp);
        return block.number;
    }

    function verifyAttendanceIntegrity(string calldata recordId, bytes32 currentHash) 
        external view returns (bool isMatch, bytes32 originalHash, uint256 originalTimestamp) 
    {
        require(bytes(_records[recordId].recordId).length != 0, "Record not found");
        AttendanceEntry memory entry = _records[recordId];
        return (entry.recordHash == currentHash, entry.recordHash, entry.timestamp);
    }

    function getAttendance(string calldata recordId) external view returns (AttendanceEntry memory) {
        require(bytes(_records[recordId].recordId).length != 0, "Record not found");
        return _records[recordId];
    }
}
