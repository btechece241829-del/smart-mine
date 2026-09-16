// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DocumentRegistry
 * @notice Stores document hashes for authenticity verification.
 *         Any modification to a document will be detectable by hash comparison.
 */
contract DocumentRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum DocStatus { Pending, Registered, Verified, Revoked }

    struct DocumentEntry {
        string documentId;
        bytes32 documentHash;
        string documentType;
        string issuer;
        string recordType;
        uint256 timestamp;
        address registeredBy;
        DocStatus status;
        string txHash;
    }

    event DocumentRegistered(string indexed documentId, bytes32 documentHash, string documentType, uint256 timestamp);
    event DocumentVerified(string indexed documentId, bool authentic, uint256 timestamp);
    event DocumentRevoked(string indexed documentId, string reason, uint256 timestamp);

    mapping(string => DocumentEntry) private _documents;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerDocument(
        string calldata documentId,
        bytes32 documentHash,
        string calldata documentType,
        string calldata issuer,
        string calldata recordType
    ) external nonReentrant {
        require(bytes(_documents[documentId].documentId).length == 0, "Document already registered");
        _documents[documentId] = DocumentEntry({
            documentId: documentId,
            documentHash: documentHash,
            documentType: documentType,
            issuer: issuer,
            recordType: recordType,
            timestamp: block.timestamp,
            registeredBy: msg.sender,
            status: DocStatus.Registered,
            txHash: ""
        });
        emit DocumentRegistered(documentId, documentHash, documentType, block.timestamp);
    }

    function verifyDocument(string calldata documentId, bytes32 currentHash) 
        external view returns (DocStatus status, bool isMatch, bytes32 originalHash, uint256 timestamp) 
    {
        require(bytes(_documents[documentId].documentId).length != 0, "Document not found");
        DocumentEntry memory entry = _documents[documentId];
        return (entry.status, entry.documentHash == currentHash, entry.documentHash, entry.timestamp);
    }

    function getDocument(string calldata documentId) external view returns (DocumentEntry memory) {
        require(bytes(_documents[documentId].documentId).length != 0, "Document not found");
        return _documents[documentId];
    }

    function revokeDocument(string calldata documentId, string calldata reason) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(bytes(_documents[documentId].documentId).length != 0, "Document not found");
        _documents[documentId].status = DocStatus.Revoked;
        emit DocumentRevoked(documentId, reason, block.timestamp);
    }
}
