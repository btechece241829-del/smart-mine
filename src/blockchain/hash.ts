// ────────────────────────────────────────────────────────────────
// Blockchain layer — cryptographic hashing
//
// Uses SHA-256 (Web Crypto) for canonical JSON representations so the
// exact same hash is reproducible from any client (Firebase-safe —
// keys sorted, no functions, deterministic JSON.stringify).
// ────────────────────────────────────────────────────────────────

/** Deterministic JSON stringify with sorted keys — stable across clients. */
export function canonicalStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return `[${(obj as unknown[]).map((x) => canonicalStringify(x)).join(',')}]`;
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined && record[k] !== null).sort();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowList = new Set(['id', 'created_at', 'updated_at', 'mine_id', 'worker_id', 'attendance_date', 'shift', 'status', 'verification_status', 'marked_by_id', 'marked_by_name', 'remarks', 'check_in', 'check_out', 'lat', 'lng']);
  const parts = keys
    .filter((k) => !k.startsWith('blockchain') && !k.startsWith('_'))
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Compute a SHA-256 hash for arbitrary data using the Web Crypto API.
 * Falls back to a pure-JS FNV-1a implementation when crypto.subtle is
 * unavailable (e.g. http contexts).
 */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const inputArr = input instanceof Uint8Array ? input.buffer : input;
      const digest = await crypto.subtle.digest('SHA-256', inputArr as ArrayBuffer);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to JS implementation
  }
  // FNV-1a 64-bit fallback — deterministic across environments
  let h1 = 0xcbf29ce484222325;
  let h2 = 0x84222325;
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  for (const byte of bytes) {
    h1 ^= byte;
    h1 = Math.imul(h1, 0x00000100000001b3);
    h2 = (h2 + h1) | 0;
  }
  const parts = [h1, h2].map((n) => (n < 0 ? n + 2 ** 32 : n).toString(16).padStart(8, '0'));
  return (parts.join('') + parts[0]).slice(0, 64).toLowerCase();
}

/** Alias for compatibility with keccak-style naming used elsewhere. */
export const hashRecord = sha256Hex;

/** Compute the canonical record hash of any Firestore document. */
export async function computeRecordHash(record: Record<string, unknown>): Promise<string> {
  return sha256Hex(canonicalStringify(record));
}

/** Hash an arbitrary file binary (for document verification). */
export async function hashFileBytes(data: Uint8Array): Promise<string> {
  return sha256Hex(data);
}

/** Short human-truncatable display of a hash. */
export function shortHash(hash: string | null | undefined, len = 10): string {
  if (!hash) return '—';
  if (hash.length <= len * 2 + 3) return hash;
  return `${hash.slice(0, len)}…${hash.slice(-len)}`;
}

/** Convert a hex hash to 0x-prefixed bytes32 Ethereum format. */
export function toBytes32(hash: string): string {
  const clean = hash.replace(/^0x/, '');
  return `0x${clean.slice(0, 64).padStart(64, '0')}`;
}