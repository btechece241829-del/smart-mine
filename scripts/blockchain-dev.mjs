/**
 * blockchain-dev.mjs
 * ------------------------------------------------------------------
 * One-command development orchestrator for `npm run dev`.
 *
 * Starts the local Hardhat blockchain node, waits for it to become
 * reachable, deploys the smart contracts (writing addresses into
 * .env + src/blockchain/deployments.json), and then launches the Vite
 * dev server — all from a single `npm run dev`.
 *
 * No extra npm dependencies are required (uses only Node's built-ins).
 * Each child process' stdout/stderr is piped through so you still see
 * the usual Hardhat and Vite logs in this terminal.
 *
 * On exit (Ctrl+C / SIGINT / SIGTERM / uncaught error), every spawned
 * child process is terminated so no orphaned node/vite processes are
 * left running.
 */

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RPC_URL = process.env.VITE_BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

// Node is used to run the CLI entrypoints directly (no `.cmd`/`.bat` shims —
// those cannot be spawned on Windows with `shell: false`). This mirrors exactly
// what the `node_modules/.bin/<name>.cmd` shims invoke under the hood and is
// fully cross-platform.
const VITE_ENTRY = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const HARDHAT_ENTRY = path.join(ROOT, "node_modules", "hardhat", "internal", "cli", "bootstrap.js");

const children = new Set();
let chainChild = null;
let viteChild = null;
let shuttingDown = false;

function log(prefix, ...args) {
  // eslint-disable-next-line no-console
  console.log(`\x1b[36m[blockchain-dev]\x1b[0m ${prefix}`, ...args);
}

// Runs the current Node executable (the same one running this script).
function nodeBin() {
  return process.execPath;
}

function spawnTracked(binPath, args, opts = {}) {
  const child = spawn(binPath, args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    ...opts,
  });
  children.add(child);
  child.stdout?.on("data", (d) => process.stdout.write(d));
  child.stderr?.on("data", (d) => process.stderr.write(d));
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (
      child !== viteChild &&
      child !== chainChild &&
      !shuttingDown &&
      process.listenerCount("exit") > 0
    ) {
      log(`Child exited unexpectedly (code=${code}, signal=${signal}). Shutting down.`);
      shutdown(1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Shutting down all processes...");
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => {
    for (const child of children) {
      if (typeof child.exitCode !== "number" && child.exitCode === null && child.pid) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }
    process.exit(code);
  }, 500);
}

async function waitForRpc(timeoutMs = 30_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  log(`Waiting for Hardhat RPC at ${RPC_URL}...`);
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${RPC_URL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "eth_chainId",
          params: [],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        if (body?.result) {
          log(`Hardhat RPC is ready (chainId: ${parseInt(body.result, 16)}).`);
          return true;
        }
      }
    } catch {
      /* not ready yet — retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  log(`Hardhat RPC did not become ready within ${timeoutMs / 1000}s.`);
  return false;
}

function runDeploy() {
  log("Deploying smart contracts to the local Hardhat network...");
  const result = spawnSync(
    nodeBin(),
    [HARDHAT_ENTRY, "run", "scripts/deploy.ts", "--network", "localhost"],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    }
  );
  if (result.status !== 0) {
    log("Contract deployment failed. Aborting.");
    shutdown(result.status || 1);
    return false;
  }
  log("Contracts deployed. Addresses written to .env and src/blockchain/deployments.json.");
  return true;
}


async function main() {
  log("Starting Smart-Mine dev environment (Hardhat node + deploy + Vite)...");

  // Ensure compiled artifacts exist before launching the node.
  if (!fs.existsSync(path.join(ROOT, "artifacts"))) {
    log("No compiled contracts found — compiling first...");
    compileContracts();
  }

  // 1. Start the Hardhat local node. Note: `hardhat node` always serves the
  //    built-in `hardhat` network (chainId 31337) and rejects `HARDHAT_NETWORK`
  //    overrides (HH605); the deploy below connects via `--network localhost`.
  chainChild = spawnTracked(nodeBin(), [HARDHAT_ENTRY, "node"], {
    env: { ...process.env },
  });

  // 2. Wait until the RPC is reachable.
  const ready = await waitForRpc();
  if (!ready) {
    log("Timed out waiting for the Hardhat node. Exiting.");
    shutdown(1);
    return;
  }

  // 3. Deploy contracts so the freshly started node has all contracts, and
  //    .env / deployments.json hold the matching addresses for the frontend.
  runDeploy();

  // 4. Launch the Vite dev server.
  log("Starting Vite dev server...");
  viteChild = spawnTracked(nodeBin(), [VITE_ENTRY], {
    env: { ...process.env },
  });

  // 5. Keep the process alive until vite exits (Ctrl+C routes through shutdown).
  const keepAlive = setInterval(() => {
    if (viteChild.exitCode !== null || shuttingDown) {
      clearInterval(keepAlive);
      shutdown(viteChild.exitCode ?? 0);
    }
  }, 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (err) => {
  log("Uncaught error:", err);
  shutdown(1);
});

main().catch((err) => {
  log("Fatal error starting dev environment:", err);
  shutdown(1);
});

function compileContracts() {
  const result = spawnSync(nodeBin(), [HARDHAT_ENTRY, "compile"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    log("Contract compilation failed. Aborting.");
    shutdown(result.status || 1);
  }
}
