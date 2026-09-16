// ────────────────────────────────────────────────────────────────
// Blockchain layer — provider & web3 abstraction
//
// Lazily connects to the configured RPC endpoint. On failure the layer
// gracefully degrades to simulation so the application never crashes
// when the blockchain is unavailable.
// ────────────────────────────────────────────────────────────────
import { JsonRpcProvider, BrowserProvider } from 'ethers';
import { blockchainConfig, isSimulationMode } from './config';
import { BlockchainNetworkStatus } from './types';

let cachedProvider: JsonRpcProvider | null = null;
let lastStatus: BlockchainNetworkStatus | null = null;
let statusListeners: Array<(s: BlockchainNetworkStatus) => void> = [];

export interface ProviderLike {
  getBlockNumber: () => Promise<number>;
  getNetwork: () => Promise<{ chainId: bigint; name: string }>;
  detectNetwork: () => Promise<{ chainId: bigint; name: string } | null>;
  _internal?: unknown;
}

export function getProvider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(blockchainConfig.rpcUrl, {
      chainId: blockchainConfig.chainId,
      name: blockchainConfig.networkName,
    }, { staticNetwork: true });
  }
  return cachedProvider;
}

export function resetProvider(): void {
  cachedProvider = null;
}

export function getRpcUrl(): string {
  return blockchainConfig.rpcUrl;
}

export function getChainId(): number {
  return blockchainConfig.chainId;
}

function broadcast(status: BlockchainNetworkStatus): void {
  lastStatus = status;
  statusListeners.forEach((cb) => cb(status));
}

/** Subscribe to network status changes. Returns unsubscribe fn. */
export function onNetworkStatus(cb: (s: BlockchainNetworkStatus) => void): () => void {
  statusListeners.push(cb);
  if (lastStatus) cb(lastStatus);
  return () => {
    statusListeners = statusListeners.filter((f) => f !== cb);
  };
}

/** Ping the network and report live status. Never throws. */
export async function checkNetworkStatus(): Promise<BlockchainNetworkStatus> {
  if (isSimulationMode()) {
    const status: BlockchainNetworkStatus = {
      connected: false,
      network: 'unknown',
      chainId: null,
      blockNumber: null,
      syncing: false,
      lastCheckedAt: new Date().toISOString(),
      error: null,
    };
    broadcast(status);
    return status;
  }
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const status: BlockchainNetworkStatus = {
      connected: true,
      network: network.name as BlockchainNetworkStatus['network'],
      chainId: Number(network.chainId),
      blockNumber,
      syncing: false,
      lastCheckedAt: new Date().toISOString(),
      error: null,
    };
    broadcast(status);
    return status;
  } catch (e: unknown) {
    const status: BlockchainNetworkStatus = {
      connected: false,
      network: 'unknown',
      chainId: null,
      blockNumber: null,
      syncing: false,
      lastCheckedAt: new Date().toISOString(),
      error: (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as { message?: string }).message ?? 'Network unreachable',
    };
    broadcast(status);
    return status;
  }
}

/** Browser wallet (MetaMask) provider, when available. */
export async function getBrowserProvider(): Promise<BrowserProvider | null> {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean } };
  if (!anyWindow.ethereum) return null;
  try {
    await anyWindow.ethereum.request({ method: 'eth_requestAccounts' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new BrowserProvider(anyWindow.ethereum as any);
  } catch {
    return null;
  }
}

/** Get the connected MetaMask account address (or null). */
export async function getWalletAccount(): Promise<string | null> {
  const browserProvider = await getBrowserProvider();
  if (!browserProvider) return null;
  try {
    const signer = await browserProvider.getSigner();
    const address = await signer.getAddress();
    return address;
  } catch {
    return null;
  }
}