// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UserRoleRegistry
 * @notice Maps Firebase user IDs to blockchain roles and wallets.
 *         Enforces that only authorized roles can sign transactions.
 */
contract UserRoleRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    bytes32 public constant OVERMAN_ROLE = keccak256("OVERMAN_ROLE");

    struct UserRecord {
        string userId;
        string role;
        address wallet;
        string mineId;
        bool active;
        uint256 registeredAt;
    }

    event UserRegistered(string indexed userId, string role, address wallet, uint256 timestamp);
    event UserRoleUpdated(string indexed userId, string oldRole, string newRole, uint256 timestamp);
    event UserDeactivated(string indexed userId, uint256 timestamp);

    mapping(string => UserRecord) private _users;
    mapping(address => string) private _walletToUser;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(INSPECTOR_ROLE, msg.sender);
        _grantRole(OVERMAN_ROLE, msg.sender);
    }

    function registerUser(
        string calldata userId,
        string calldata role,
        address wallet,
        string calldata mineId
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(bytes(_users[userId].userId).length == 0, "User already registered");
        _users[userId] = UserRecord({
            userId: userId,
            role: role,
            wallet: wallet,
            mineId: mineId,
            active: true,
            registeredAt: block.timestamp
        });
        if (wallet != address(0)) {
            _walletToUser[wallet] = userId;
        }
        emit UserRegistered(userId, role, wallet, block.timestamp);
    }

    function updateUserRole(string calldata userId, string calldata newRole) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(bytes(_users[userId].userId).length != 0, "User not found");
        string memory oldRole = _users[userId].role;
        _users[userId].role = newRole;
        emit UserRoleUpdated(userId, oldRole, newRole, block.timestamp);
    }

    function deactivateUser(string calldata userId) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(bytes(_users[userId].userId).length != 0, "User not found");
        _users[userId].active = false;
        emit UserDeactivated(userId, block.timestamp);
    }

    function getUser(string calldata userId) external view returns (UserRecord memory) {
        require(bytes(_users[userId].userId).length != 0, "User not found");
        return _users[userId];
    }

    function getUserByWallet(address wallet) external view returns (UserRecord memory) {
        string memory userId = _walletToUser[wallet];
        require(bytes(userId).length != 0, "No user for wallet");
        return _users[userId];
    }
}
