// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MineRegistry
 * @notice On-chain registry for coal mines. Stores mine identity hashes
 *         and metadata for trust anchoring.
 */
contract MineRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct MineRecord {
        string mineId;
        bytes32 dataHash;
        string organization;
        uint256 registeredAt;
        uint256 updatedAt;
        bool active;
        address registeredBy;
    }

    event MineRegistered(string indexed mineId, bytes32 dataHash, uint256 timestamp);
    event MineUpdated(string indexed mineId, bytes32 newHash, uint256 timestamp);
    event MineDeactivated(string indexed mineId, uint256 timestamp);

    mapping(string => MineRecord) private _mines;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerMine(
        string calldata mineId,
        bytes32 dataHash,
        string calldata organization
    ) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(bytes(_mines[mineId].mineId).length == 0, "Mine already registered");
        _mines[mineId] = MineRecord({
            mineId: mineId,
            dataHash: dataHash,
            organization: organization,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true,
            registeredBy: msg.sender
        });
        emit MineRegistered(mineId, dataHash, block.timestamp);
    }

    function updateMineHash(string calldata mineId, bytes32 newHash) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(bytes(_mines[mineId].mineId).length != 0, "Mine not found");
        _mines[mineId].dataHash = newHash;
        _mines[mineId].updatedAt = block.timestamp;
        emit MineUpdated(mineId, newHash, block.timestamp);
    }

    function deactivateMine(string calldata mineId) external nonReentrant onlyRole(ADMIN_ROLE) {
        require(bytes(_mines[mineId].mineId).length != 0, "Mine not found");
        _mines[mineId].active = false;
        _mines[mineId].updatedAt = block.timestamp;
        emit MineDeactivated(mineId, block.timestamp);
    }

    function getMine(string calldata mineId) external view returns (MineRecord memory) {
        require(bytes(_mines[mineId].mineId).length != 0, "Mine not found");
        return _mines[mineId];
    }

    function getMineHash(string calldata mineId) external view returns (bytes32) {
        require(bytes(_mines[mineId].mineId).length != 0, "Mine not found");
        return _mines[mineId].dataHash;
    }
}
