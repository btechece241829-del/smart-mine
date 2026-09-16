// ─────────────────────────────────────────────────────────────
// Smart Mine — Final Architecture PDF generator
// Produces finalarchi.pdf (root) + public/finalarchi.pdf
// Run:  node scripts/generate_finalarchi.cjs
// ─────────────────────────────────────────────────────────────
const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'finalarchi.pdf');
const PUB = path.join(__dirname, '..', 'public', 'finalarchi.pdf');

const W = 595.28, H = 841.89, M = 46;
const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
let y = M, pageNo = 1;

// Palette (matches the app's "copper / carbon" theme)
const C = {
  ink: [36, 32, 28],
  copper: [176, 104, 58],
  copperDk: [128, 68, 32],
  white: [255, 255, 255],
  slate: [140, 132, 124],
  line: [60, 55, 50],
  bg: [248, 246, 242],
};

function ensureTop(h = 18) {
  if (y + h > H - 56) { doc.addPage(); pageNo++; y = M; paintFooter(); paintHeader(); }
}

function paintHeader() {
  if (pageNo > 1) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.setTextColor(...C.slate);
    doc.text('SMART MINE — FINAL ARCHITECTURE', W - M, 26, { align: 'right' });
    doc.setDrawColor(...C.copper); doc.setLineWidth(1);
    doc.line(M, 32, W - M, 32);
  }
}

function paintFooter() {
  doc.setDrawColor(...C.line); doc.setLineWidth(0.5);
  doc.line(M, H - 44, W - M, H - 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor(...C.slate);
  doc.text('Smart Mine — Coal Compliance & Safety with Blockchain Trust Layer', M, H - 30);
  doc.text('Page ' + pageNo, W - M, H - 30, { align: 'right' });
}

function sectionTitle(num, text) {
  ensureTop(30);
  doc.setFillColor(...C.copperDk);
  doc.rect(M, y, W - 2 * M, 21, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.setTextColor(...C.white);
  doc.text(num + '.  ' + text, M + 10, y + 14);
  y += 27;
}

function h2(text) {
  ensureTop(22);
  doc.setFillColor(...C.copper);
  doc.rect(M + 4, y, 6, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor(...C.ink);
  doc.text(text, M + 16, y + 9);
  y += 15;
}

function para(text, size = 9.5) {
  ensureTop(12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
  doc.setTextColor(...C.ink);
  const lines = doc.splitTextToSize(text, W - 2 * M);
  for (const ln of lines) { ensureTop(10); doc.text(ln, M, y); y += 11.2; }
  y += 3;
}

function bullets(items, size = 9.5) {
  ensureTop(10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
  doc.setTextColor(...C.ink);
  const indent = 13;
  for (const it of items) {
    const lines = doc.splitTextToSize(it, W - 2 * M - indent);
    ensureTop(11);
    doc.setFillColor(...C.copper); doc.circle(M + 4, y - 2.5, 1.8, 'F');
    doc.text(lines[0], M + indent, y); y += 11.5;
    for (let i = 1; i < lines.length; i++) { ensureTop(10); doc.text(lines[i], M + indent, y); y += 11.5; }
  }
  y += 3;
}

function numbered(items, size = 9.5) {
  ensureTop(10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
  doc.setTextColor(...C.ink);
  const indent = 30;
  items.forEach((it, i) => {
    const lines = doc.splitTextToSize(it, W - 2 * M - indent);
    ensureTop(11);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size - 0.5);
    doc.setTextColor(...C.copperDk);
    doc.text('' + (i + 1) + '.', M + 4, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
    doc.setTextColor(...C.ink);
    doc.text(lines[0], M + indent, y); y += 11.0;
    for (let j = 1; j < lines.length; j++) { ensureTop(10); doc.text(lines[j], M + indent, y); y += 11.0; }
  });
  y += 2;
}

function table(headers, rows, widths) {
  const pad = 6, rh = 16;
  const colX = [];
  let x = M;
  for (const w of widths) { colX.push(x); x += w; }
  const cellH = (cells) => {
    const htexts = cells.map((c, i) => doc.splitTextToSize(String(c), widths[i] - pad * 2));
    return Math.max(rh, ...htexts.map((t) => t.length * 9.2 + pad * 2));
  };
  const renderRow = (cells, opts) => {
    const rowH = cellH(cells);
    ensureTop(rowH);
    if (opts.fill) { doc.setFillColor(...opts.fill); doc.rect(M, y, W - 2 * M, rowH, 'F'); }
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...(opts.bold ? C.white : C.ink));
    cells.forEach((c, i) => {
      const t = doc.splitTextToSize(String(c), widths[i] - pad * 2);
      t.forEach((ln, j) => doc.text(ln, colX[i] + pad, y + 11 + j * 9.2));
    });
    doc.setDrawColor(...C.line); doc.setLineWidth(0.4);
    doc.line(M, y, M + (W - 2 * M), y);
    y += rowH;
  };
  renderRow(headers, { fill: C.copperDk, bold: true });
  rows.forEach((r, i) => renderRow(r, { fill: i % 2 ? C.bg : C.white, bold: false }));
  doc.setDrawColor(...C.line); doc.setLineWidth(0.4);
  doc.line(M, y, M + (W - 2 * M), y);
  y += 6;
}

function box(x, w, h, title, lines) {
  doc.setFillColor(...C.ink);
  doc.rect(x, y, w, 20, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.3);
  doc.setTextColor(...C.white);
  doc.text(title, x + 5, y + 13);
  doc.setFillColor(...C.bg);
  doc.rect(x, y + 20, w, h - 20, 'F');
  doc.setDrawColor(...C.line); doc.setLineWidth(0.7);
  doc.rect(x, y, w, h, 'S');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
  doc.setTextColor(...C.ink);
  let ly = y + 34;
  for (const ln of lines) {
    for (const t of doc.splitTextToSize(ln, w - 12)) { doc.text(t, x + 6, ly); ly += 9.5; }
  }
  y += h;
}

function arrow(x1, y1, x2, y2) {
  doc.setDrawColor(...C.copper); doc.setLineWidth(1);
  doc.line(x1, y1, x2, y2);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const L = 6;
  doc.setFillColor(...C.copper);
  doc.triangle(x2, y2,
    x2 - L * Math.cos(ang - 0.4), y2 - L * Math.sin(ang - 0.4),
    x2 - L * Math.cos(ang + 0.4), y2 - L * Math.sin(ang + 0.4), 'F');
}

// ▸ Title block (page 1)
function renderTitle() {
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, W, 130, 'F');
  doc.setFillColor(...C.copper);
  doc.rect(0, 130, W, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
  doc.setTextColor(...C.white);
  doc.text('SMART MINE', M, 66);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(12.5);
  doc.setTextColor(...C.slate);
  doc.text('Coal-Mine Compliance & Safety Platform with Blockchain Trust Layer', M, 88);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor(214, 172, 118);
  doc.text('Final Architecture — Document', M, 116);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.setTextColor(...C.slate);
  doc.text('Generated ' + new Date().toDateString(), M, H - 60);
  y = 150;
}

// ▸ Section 1 — Overview
function renderOverview() {
  sectionTitle(1, 'Project Overview');
  para('Smart Mine is a coal-mine compliance and safety management platform. The application UI is a React ' +
    'single-page app (Vite, port 3000) that bundles two frontends: the production Security & Compliance module ' +
    '(src/security) and the older MineGov analytical demo (src/App.tsx with component views and services). ' +
    'Operational data is stored off-chain in Firebase (Firestore is the source of truth, Firebase Auth supplies ' +
    'roles, Firebase Storage holds photos/videos). A hybrid blockchain trust layer (src/blockchain, ethers v6) ' +
    'anchors the SHA-256 hash of every critical record onto Solidity ledgers deployed with Hardhat (chainId 31337), ' +
    'yielding tamper-evident, independently verifiable audit trails without moving interactive data on-chain.');
  para('Two optional Python microservices complement the stack: an ML server (ml_server.py, :5001) blending ' +
    'historical CSV datasets with live records for risk/anomaly scoring, and a DB server (db_server.py, :5004) ' +
    'that persists legacy demo state to PostgreSQL 15 (Docker). Every layer degrades gracefully, so the app is ' +
    'always functional: with a running chain, without a chain (simulation mode), and fully offline.');
  h2('Repository Layout');
  table(
    ['Path', 'Responsibility'],
    [
      ['src/security/', 'Production compliance & safety module (services, views, safety + blockchain UI pages)'],
      ['src/blockchain/', 'Hybrid trust layer — pure-TypeScript services (hash, provider, signer, verifier, per-domain)'],
      ['contracts/', 'Ten Solidity 0.8.24 ledger contracts (OpenZeppelin AccessControl + ReentrancyGuard)'],
      ['scripts/deploy.ts', 'Compile + deploy all ledgers and write contract addresses to .env and deployments.json'],
      ['test/blockchain.test.ts', 'Fifteen Hardhat/Chai contract tests (verify, tamper, duplicate-ID, events, ACL)'],
      ['supabase/', 'Legacy schema (tables, RLS policies, triggers, storage buckets) — superseded by Firebase'],
      ['docs/', 'ARCHITECTURE.md with file/line flow traces + Mermaid diagrams (.mmd)'],
      ['public/data/', 'Thirteen CSV demo datasets driving the ML analytical demo'],
      ['ml_server.py / db_server.py', 'Python Flask microservices (ML risk; PostgreSQL persistence)'],
    ],
    [130, 373]
  );
}

// ▸ Section 2 — Architecture
function renderArchitecture() {
  ensureTop(430); // title + whole diagram must fit on ONE page
  sectionTitle(2, 'System Architecture');
  h2('Reference Diagram');
  const usable = W - 2 * M;
  const mid = M + usable / 2;
  const GAP = 16;
  // Row 1 — frontend
  box(M, usable, 78, 'REACT FRONTEND — Vite SPA · port 3000', [
    '• Security & Compliance app: src/security/securityMain.tsx -> auth gate -> role-based routing',
    '• Legacy MineGov demo: src/App.tsx + src/components/views + src/services',
  ]);
  const y1 = y - 78;
  y += GAP;
  // Row 2 — off-chain + trust layer (side by side)
  const w2 = (usable - 26) / 2;
  arrow(mid, y1 + 78, mid - w2 / 2.5, y);
  arrow(mid, y1 + 78, mid + w2 / 2.5, y);
  box(M, w2, 104, 'OFF-CHAIN DATA — source of truth', [
    '• Firebase: Firestore (records), Auth (roles), Storage (media)',
    '• firebaseDb.ts facade: Firestore + localStorage fallback + 5s timeouts',
    '• IndexedDB multi-tab offline persistence',
  ]);
  box(M + w2 + 26, w2, 104, 'HYBRID TRUST LAYER — src/blockchain/', [
    '• canonicalStringify -> SHA-256 -> bytes32 (deterministic)',
    '• ethers v6: BrowserProvider (MetaMask) + JSON-RPC fallback',
    '• verifier.ts -> VERIFIED / TAMPERED / NOT_FOUND',
    '• Simulation mode when no contract addresses are configured',
  ]);
  y += GAP;
  // Row 3 — Python microservices
  const w3 = (usable - 26) / 2;
  box(M, w3, 62, 'ML SERVER — Flask :5001', [
    'pandas + numpy + scikit-learn (IsolationForest); risk band + anomaly scoring',
  ]);
  box(M + w3 + 26, w3, 62, 'DB SERVER — Flask :5004', [
    'SQLAlchemy + psycopg -> PostgreSQL 15 (docker); 503 degrade -> in-memory',
  ]);
  y += GAP;
  // Row 4 — blockchain (vertical arrow feeds through the centre gap)
  arrow(mid, y1 + 78, mid, y);
  box(M, usable, 58, 'BLOCKCHAIN — Hardhat local node · chainId 31337 · RPC 8545', [
    'Ten Solidity ledgers (access-control gated): MineRegistry, RoleRegistry, Attendance, Inspection, Complaint, Incident, Document, Compliance, ApprovalWorkflow, AuditTrail',
  ]);
  y += 6;
}

// ▸ Section 3 — Key decisions
function renderDecisions() {
  sectionTitle(3, 'Key Architectural Decisions');
  numbered([
    'Hybrid, not full on-chain — Firestore stays the interactive source of truth; only cryptographic hashes go on-chain. The ledger provides integrity, while authorization stays in Firebase rules.',
    'Two sub-apps in one repo — the production src/security module and the legacy MineGov demo share the Vite build and Firebase SDK but are fully independent.',
    'Simulation mode — with no contract addresses in .env, the blockchain layer deterministically mocks every ledger call, so the entire UI works with zero setup (UI shows a SIMULATED LEDGER badge).',
    'Graceful degradation everywhere — Flask servers return 503 instead of crashing; the ML client falls back to live-only estimates; the DB client falls back to in-memory; blockchain calls never throw.',
    'Offline-first — IndexedDB multi-tab persistence plus a localStorage collection fallback plus 5-second Firestore timeouts, built for unreliable mine-site connectivity.',
    'RBAC everywhere — a role-permission matrix (permissions.ts) with server-side role detection in the auth context, mirrored by firestore.rules and the legacy Supabase RLS policies.',
    'Event-sourced audit — complaint_events capture every state transition; audit_logs capture admin actions; ledger events (RecordRegistered/RecordRevoked) are on-chain.',
    'Deterministic hashing — canonicalStringify sorts keys and excludes volatile/derived fields so any client recomputes an identical hash for verification.',
    'Domain-driven ledgers — one Solidity contract plus one TypeScript service per domain (attendance, inspection, complaint, incident, document, compliance, approval, audit, mine, role).',
    'Blended ML — predictions always combine historical datasets (CSV) with live runtime records in an explicit 0.5/0.5 blend returned by the API for transparency.',
  ]);
}

// ▸ Section 4 — Workflows
function renderWorkflows() {
  sectionTitle(4, 'Workflows');
  h2('4.1  Runtime Workflow — Complaints (state machine, full chain of custody)');
  para('Report Issue -> Submitted -> auto-assigned with SLA due date -> Assigned -> linked Inspection -> CAPA ' +
    'created -> Escalated when overdue/critical (48h SLA) -> Verified -> Resolved -> Archived. Every transition ' +
    'appends to complaint_events; every admin action to audit_logs; critical/immediate-danger reports are flagged ' +
    'is_critical and auto-escalated. Roles gate each step: worker -> mining_mate -> overman -> safety_officer -> ' +
    'mine_manager -> super_admin, each seeing only their scoped views, with realtime notifications via Firestore ' +
    'onSnapshot.');
  h2('4.2  Blockchain Anchoring Flow');
  para('Create record in Firestore -> per-domain service (e.g. complaintBlockchain.ts) -> canonicalStringify -> ' +
    'SHA-256 -> bytes32. If contract addresses are configured, the local Hardhat ledger records the hash via ethers ' +
    '(MetaMask signing / JSON-RPC); otherwise simulation mode returns a deterministic mock. Blockchain metadata ' +
    '(hash, tx, block, status) is written back to Firestore. The Verify Records page recomputes the hash and ' +
    'compares it with the ledger (VERIFIED / TAMPERED); the QR page encodes a verification payload for field ' +
    'verification on any device. Failures are never thrown — they render as FAILED / PENDING badges.');
  h2('4.3  ML Risk Prediction');
  para('Historical CSV datasets (13 files: mines, compliances, inspections, violations, corrective actions, ' +
    'incidents, environment, sensors, equipment, contractors, workers, production, documents) are blended with ' +
    'live runtime records at 0.5/0.5, producing a predicted risk score and band (Low / Moderate / High / Critical), ' +
    'sorted per mine with explicit contributors; the client falls back to live-only estimates if the server is down.');
  h2('4.4  Development Workflow');
  table(
    ['Step', 'Command'],
    [
      ['Install dependencies', 'npm install'],
      ['Frontend dev server (port 3000)', 'npm run dev'],
      ['Start local blockchain node', 'npm run blockchain:start'],
      ['Deploy 10 contracts + write addresses', 'npm run blockchain:deploy'],
      ['Run 15 contract tests', 'npm run blockchain:test'],
      ['Start ML server (:5001)', 'python ml_server.py'],
      ['Start DB server (:5004)', 'python db_server.py'],
      ['Start PostgreSQL 15', 'docker compose up -d'],
      ['Run both ML + Vite together', 'npm start'],
      ['Production build', 'npm run build'],
      ['Deploy to Firebase Hosting', 'firebase deploy'],
    ],
    [170, 333]
  );
}

// ▸ Section 5 — Tech Stack
function renderTechStack() {
  sectionTitle(5, 'Technology Stack');
  h2('5.1  Frontend');
  table(
    ['Layer', 'Technology'],
    [
      ['UI framework', 'React 18 + TypeScript 5.3 (ESM project)'],
      ['Build tooling', 'Vite 5 + @vitejs/plugin-react; multi-page (index / security / legacy .html)'],
      ['Styling', 'Tailwind CSS 3.4 + PostCSS / Autoprefixer (dark copper theme)'],
      ['Charts', 'Recharts'],
      ['Maps / GIS', 'Leaflet + react-leaflet'],
      ['3D visualization', 'three + @react-three/fiber + @react-three/drei'],
      ['Utilities', 'framer-motion, lucide-react, papaparse (CSV), jspdf (PDF), pdfjs-dist, qrcode.react, tesseract.js (OCR)'],
      ['Backend SDKs', 'firebase 10 (Auth / Firestore / Storage)'],
      ['Blockchain SDK', 'ethers v6'],
    ],
    [120, 383]
  );
  h2('5.2  Backend & Services');
  table(
    ['Piece', 'Technology'],
    [
      ['Off-chain data', 'Firebase Firestore (+ rules) and Firebase Storage (+ rules)'],
      ['Legacy relational', 'Supabase schema + RLS (supabase/schema.sql) — replaced by Firebase'],
      ['ML microservice', 'Python Flask + pandas + numpy + scikit-learn (IsolationForest) — ml_server.py :5001'],
      ['Persistence microservice', 'Python Flask + SQLAlchemy 2 + psycopg — db_server.py :5004'],
      ['Relational database', 'PostgreSQL 15 (docker-compose)'],
      ['Smart contracts', 'Solidity 0.8.24 + OpenZeppelin (AccessControl, ReentrancyGuard) — 10 ledgers'],
      ['Blockchain tooling', 'Hardhat 2.29 (local node, chainId 31337), ethers v6, hardhat.config.cjs (CJS for ESM project)'],
    ],
    [170, 333]
  );
  h2('5.3  Testing & Tooling');
  table(
    ['Area', 'Stack'],
    [
      ['Contract tests', 'Hardhat + Chai — 15 tests (verify / tamper / duplicate-ID / events / ACL)'],
      ['Type checking', 'tsc (npm run lint)'],
      ['E2E / browser automation', 'Playwright 1.63 (devDependency)'],
      ['Process management', 'concurrently (npm start)'],
      ['Python dependencies', 'flask, pandas, numpy, scikit-learn, sqlalchemy, psycopg'],
    ],
    [170, 333]
  );
}

// ▸ Section 6 — Methodology
function renderMethodology() {
  sectionTitle(6, 'Engineering Methodology');
  para('Smart Mine follows ten engineering principles, consistently visible across the codebase:');
  numbered([
    'Hybrid trust / hash-anchoring — integrity on-chain, performance off-chain. The blockchain layer provides integrity, never authorization.',
    'Simulation-first development — every blockchain feature works with zero setup so the UI can be demoed with no chain and no keys.',
    'Graceful degradation — any single dependency (chain, ML server, DB server) can be down without breaking the app.',
    'Offline-first design — IndexedDB multi-tab persistence, localStorage fallback and 5s operation timeouts for flaky mine-site networks.',
    'RBAC everywhere — role-permission matrix, server-side role detection and mirrored rules in firestore.rules and legacy RLS policies.',
    'Event-sourced auditing — complaint_events and audit_logs keep an immutable chain of custody; deletions are audited first.',
    'Deterministic verification — canonicalStringify yields byte-identical hashes across any client for trustworthy verification.',
    'Domain-driven ledgers — one contract plus one service per domain keeps the trust layer symmetric and testable.',
    'Deterministic contract testing — one test pattern per concern across all ten ledgers (register / verify / tamper / duplicate / events / ACL).',
    'Data-driven blended ML — predictions always combine historical datasets with live records and expose the blend ratios in the API.',
  ]);
}

// ▸ Main
function main() {
  paintFooter();
  renderTitle();
  renderOverview();
  renderArchitecture();
  renderDecisions();
  renderWorkflows();
  renderTechStack();
  renderMethodology();
  const ab = doc.output('arraybuffer');
  fs.writeFileSync(OUT, Buffer.from(ab));
  fs.copyFileSync(OUT, PUB);
  console.log('OK — ' + OUT + ' (' + doc.getNumberOfPages() + ' pages)');
  console.log('OK — ' + PUB);
}

main();