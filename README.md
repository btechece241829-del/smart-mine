# Smart Mine — Compliance & Safety Platform with Blockchain Trust Layer

A coal‑mine compliance and safety management application built on **Firebase** (fast, interactive data layer) with a **hybrid blockchain trust layer**: every critical record stored off‑chain in Firebase gets a cryptographic hash (SHA‑256 → `bytes32`) committed on‑chain in Solidity smart contracts, giving tamper‑evident, independently verifiable audit trails.

---

## 1. Architecture Overview

```
┌──────────────────────────────┐     ┌──────────────────────────────────┐
│        React Frontend        │     │      Off‑chain datastore          │
│  (Vite + TS + Tailwind)      │───▶ │   Firebase (Firestore)            │
└──────────┬───────────────────┘     │   records: complaints,            │
           │ hash + commit            │   attendance, inspections, docs, │
           │                          │   compliance events, audit logs   │
           ▼                          └──────────────────────────────────┘
┌──────────────────────────────┐
│   Hybrid Trust Layer          │
│   src/blockchain/*            │
│  ┌────────────────────────┐   │
│  │ Hash      — SHA‑256 →   │   │
│  │           0x…bytes32   │   │
│  │ Signer    — meta‑sig / │   │
│  │           0x wallet    │   │
│  │ Verifier  — compare on │   │
│  │           chain hash   │   │
│  └────────────────────────┘   │
└──────────────┬─────────────────┘
               │ RPC (ethers.js)
               ▼
┌──────────────────────────────┐
│  Blockchain (Hardhat/node)   │
│  contracts/*.sol             │
│  Registration / verification │
│  events, immutable records   │
└──────────────────────────────┘
```

### Key design decision — hybrid (not full on-chain)
- **Firebase stays the source-of-truth** for interactive data: search, dashboards, ML, notifications.
- **Hashes go on-chain** for integrity: `recordId → bytes32 hash + timestamp + blockNumber`.
- Anyone can verify a record by recomputing its hash from Firebase data and calling the ledger's `verify*` function. If the on-chain hash differs, the record was tampered with.

> **Detailed architecture & flow traces** → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> (incl. the complaint → blockchain → verify journey with exact file/line references).
> **Visual Mermaid diagram** → [`docs/SMART-MINE-ARCHITECTURE.mmd`](docs/SMART-MINE-ARCHITECTURE.mmd).

---

## 2. Smart Contracts (`contracts/`)

All contracts follow the same pattern: `AccessControl` (role gates) + `ReentrancyGuard`, one internal record per ID, and `verify*` view functions that return the stored hash for comparison.

| Contract | Purpose |
|---|---|
| `MineRegistry.sol` | Registers mine identity + data hash; update/deactivate lifecycle. |
| `UserRoleRegistry.sol` | Anchors role assignments on-chain (immutable role record). |
| `AuditTrail.sol` | Generic record-hash log + revoke event; the backbone of the audit explorer. |
| `AttendanceLedger.sol` | Attendance record hashes; tamper detection for attendance. |
| `InspectionLedger.sol` | Inspection record hashes. |
| `ComplaintLedger.sol` | Safety complaint hashes. |
| `IncidentLedger.sol` | Incident report hashes. |
| `DocumentRegistry.sol` | Document hash registry + revocation. |
| `ApprovalWorkflow.sol` | Immutable approval signatures (`signApproval` / `rejectApproval`). |
| `ComplianceLedger.sol` | Compliance evidence hashes with lifecycle status. |

---

## 3. Frontend Blockchain Module (`src/blockchain/`)

Pure TypeScript service layer, framework-agnostic, used by the security UI (`src/security/components/blockchain/`).

| File | Responsibility |
|---|---|
| `config.ts` | Reads `VITE_BLOCKCHAIN_*` env vars; detects **simulation mode**. |
| `provider.ts` | ethers `BrowserProvider` (MetaMask) + JSON-RPC fallback to the local node. |
| `hash.ts` | SHA-256 hashing of records -> 32-byte hex (Solidity `bytes32`). |
| `signer.ts` | Wallet signing support (ethers v6 `verifyMessage`). |
| `verifier.ts` | Unified record verification; maps ABI call results to `VERIFIED` / `TAMPERED` / `NOT_FOUND`. |
| `transaction.ts` | Safe tx submit helper (nonce, gas, error normalization). |
| `contracts.ts` | Typed contract factories keyed by `ContractKey`. |
| `types.ts` | Shared types: `BlockchainConfig`, `VerificationOutcome`, etc. |
| `services/*` | Domain services: attendance, inspection, complaint, document, compliance, audit. |

### Simulation mode

If no contract addresses are configured (fresh clone / no node running), the module falls back to **simulation mode**: the same UI, but ledger entries are mocked in-memory. All pages keep working; the UI shows a `SIMULATED LEDGER` badge.

---

## 4. UI Pages (`src/security/components/blockchain/`)

| Page | Route key | What it does |
|---|---|---|
| `BlockchainDashboardPage` | `blockchain_dashboard` | Network status, block height, recent on-chain events. |
| `BlockchainVerifyPage` | `blockchain_verify` | Pick a record type -> recompute hash -> verify against the ledger. |
| `BlockchainAuditExplorerPage` | `blockchain_audit_explorer` | Browse `RecordRegistered`/`RecordRevoked` events across ledgers. |
| `BlockchainQrPage` / `BlockchainQrView` | `blockchain_qr` | Print/scan QR codes that encode verification payloads. |
| `BlockchainBadges` | -- | "Blockchain Verified" badges shown on records. |
| `BlockchainMetaPanel` | -- | On-chain meta (hash, tx, block) panel for a record. |
| `useBlockchainState` | -- | React hook wrapping the domain services. |

---

## 5. Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
#    VITE_FIREBASE_*  -> your Firebase project
#    VITE_BLOCKCHAIN_* -> defaults to the local Hardhat chain

# 3. Run the full blockchain flow in one command
npm run dev                # starts Hardhat node + deploys contracts + starts the app (port 3000)

# Optional manual/one-off commands
npm run blockchain:start   # just the local Hardhat node (chainId 31337)
npm run blockchain:deploy  # deploy contracts + write addresses to .env
npm run blockchain:test    # run the 15 contract tests
npm run dev:vite           # Vite only (no blockchain) — simulation mode if no addresses
```

> `npm run dev` auto-starts the local Hardhat node, waits for it, deploys the 10
> contracts (writing fresh `VITE_BLOCKCHAIN_*` addresses into `.env` and
> `src/blockchain/deployments.json`), then launches Vite. Ctrl+C tears all three
> down. To skip the chain, use `npm run dev:vite` (simulation mode).

### Scripts (`package.json`)

| Script | Description |
|---|---|
| `dev` | One-command orchestrator: Hardhat node → deploy → Vite (see `scripts/blockchain-dev.mjs`). |
| `dev:vite` | `vite` only — for simulation mode without a chain. |
| `chain` / `blockchain:start` | `hardhat node` — local EVM with 20 funded accounts. |
| `blockchain:deploy` | `hardhat run scripts/deploy.ts --network localhost` |
| `blockchain:test` | Runs `test/blockchain.test.ts` (15 tests, chai). |
| `blockchain:compile` | `hardhat compile` (Solidity 0.8.24). |

### Deploy wiring

`scripts/deploy.ts` deploys all 10 contracts, then writes:
- **`.env`** — `VITE_BLOCKCHAIN_DEPLOYER_ADDRESS` + one `VITE_BLOCKCHAIN_<CONTRACT>` per contract
- **`src/blockchain/deployments.json`** — `{ network, chainId, deployer, contract addresses, deployedAt }`

The frontend reads these at runtime via Vite environment variables (`config.ts`).

---

## 6. Contract Tests

```bash
npm run blockchain:test
```

Covers per contract:
- Register -> verify (hash matches -> `VERIFIED`)
- Tamper (different hash -> `TAMPERED`)
- Duplicate ID rejection
- Event emission
- Access-control enforcement (e.g. only `ADMIN_ROLE` can revoke)

---

## 7. Demo / Verification Flow

1. Start the chain and deploy (Option B above).
2. Sign in to the security app (any role; `super_admin` / `mine_manager` / `safety_officer` see the full Blockchain menu).
3. Create any record (attendance, inspection, complaint, document, compliance). The UI shows a **Blockchain Verified** badge with the on-chain tx/block info after `useBlockchainState` commits the hash.
4. Open **Blockchain Dashboard** (`blockchain_dashboard`) — see network status + recent events.
5. Open **Verify Records** (`blockchain_verify`) — pick the record; the app recomputes its hash and compares it to the ledger.
6. Tamper with the record in Firestore -> re-verify -> the result flips to **TAMPERED** (the stored hash no longer matches).
7. Open **Audit Trail** (`blockchain_audit_explorer`) — see all `RecordRegistered` events with block numbers.
8. Open **QR Verification** (`blockchain_qr`) — print a record QR; a supervisor scans it on any device to verify integrity.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `HH19` / config not loading | The project is ESM (`"type": "module"`); the config is `hardhat.config.cjs` — do not rename it to `.ts`/`.js`. |
| Import `{ ethers } from "hardhat"` fails in scripts/tests | Use `import hre from "hardhat"; const { ethers } = hre;` (ESM-safe). |
| Pages show `SIMULATED LEDGER` | No contract address in `.env` — deploy, or it is intentionally in simulation mode. |
| `MetaMask` not signing | Grant/connect the account via the local node; default deployer is Hardhat account #0 (`0xf39F...2266`). |
| `0 passing` on `hardhat test` | Pass the explicit file: `npx hardhat test test/blockchain.test.ts`. |

---

## 9. Security Notes

- The blockchain layer provides **integrity**, not authorization — enforcement still lives in Firebase rules.
- Private keys: the local Hardhat node accounts are public/deterministic; never use them on a real network.
- For production, deploy the ledgers to a permissioned/consortium chain and restrict `ADMIN_ROLE` grants.