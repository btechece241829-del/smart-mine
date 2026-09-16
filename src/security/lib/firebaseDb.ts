// ────────────────────────────────────────────────────────────────
// Firebase Firestore — Data access layer
// Replaces Supabase entirely as the DATABASE provider.
// ────────────────────────────────────────────────────────────────
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit as fsLimit,
  onSnapshot, Unsubscribe, DocumentData, QuerySnapshot, documentId, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// ── Local persistence fallback (guarantees zero-hang offline & inter-role sync) ──
const LS_PREFIX = 'smartmine_col_';

export function getLocalCollection<T = any>(col: string): T[] {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${col}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCollection<T = any>(col: string, items: T[]): void {
  try {
    localStorage.setItem(`${LS_PREFIX}${col}`, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('smartmine_db_change', { detail: { col } }));
  } catch (e) {
    console.warn(`Failed to write local collection ${col}:`, e);
  }
}

export function upsertLocalDoc<T extends { id?: string }>(col: string, docData: T): T & { id: string } {
  const list = getLocalCollection(col);
  const id = docData.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const itemWithId = { ...docData, id };
  const idx = list.findIndex((item: any) => item.id === id);
  if (idx >= 0) {
    list[idx] = itemWithId;
  } else {
    list.unshift(itemWithId);
  }
  saveLocalCollection(col, list);
  return itemWithId;
}

export function updateLocalDoc(col: string, id: string, patch: any): boolean {
  const list = getLocalCollection(col);
  const idx = list.findIndex((item: any) => item.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() };
    saveLocalCollection(col, list);
    return true;
  }
  return false;
}

export function deleteLocalDoc(col: string, id: string): boolean {
  const list = getLocalCollection(col);
  const next = list.filter((item: any) => item.id !== id);
  if (next.length !== list.length) {
    saveLocalCollection(col, next);
    return true;
  }
  return false;
}

export function clearLocalCollection(col: string): void {
  saveLocalCollection(col, []);
}

// ── Timeout wrapper to avoid infinite hangs when Firestore is unprovisioned or offline ──
const DEFAULT_FS_TIMEOUT_MS = 5000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_FS_TIMEOUT_MS,
  errorMsg = 'Firestore operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
}

// ── Generic CRUD helpers ────────────────────────────────────────

/** Get a single document by ID */
export async function getDocById<T = DocumentData>(collectionPath: string, id: string): Promise<T | null> {
  try {
    const snap = await withTimeout(getDoc(doc(db, collectionPath, id)));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
  } catch {
    return null;
  }
}

/** Add a document (auto-generated ID) */
export async function addDocToCollection<T = DocumentData>(collectionPath: string, data: T): Promise<string> {
  const docRef = await withTimeout(addDoc(collection(db, collectionPath), data as any));
  return docRef.id;
}

/** Set (create or overwrite) a document by ID */
export async function setDocById(collectionPath: string, id: string, data: any): Promise<void> {
  await withTimeout(setDoc(doc(db, collectionPath, id), data, { merge: true }));
}

/** Update specific fields of a document */
export async function updateDocById(collectionPath: string, id: string, data: any): Promise<void> {
  await withTimeout(updateDoc(doc(db, collectionPath, id), data));
}

/** Delete a document by ID */
export async function deleteDocById(collectionPath: string, id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, collectionPath, id)));
}
// ── Subscription (realtime) ─────────────────────────────────────

/** Subscribe to a query; calls onChange whenever results change */
export function subscribeToQuery(
  collectionPath: string,
  onChange: (docs: any[]) => void,
  onError?: (error: Error) => void,
  ...queryConstraints: any[]
): Unsubscribe {
  const q = query(collection(db, collectionPath), ...queryConstraints);
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
}

// ── Storage helpers ─────────────────────────────────────────────

/** Upload a file to Firebase Storage and return its download URL */
export async function uploadFileToStorage(bucketPath: string, file: File): Promise<{ url?: string; error?: string }> {
  try {
    const storageRef = ref(storage, bucketPath);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url };
  } catch (e: any) {
    return { error: e.message ?? 'Upload failed' };
  }
}

// ── Query-builder (Supabase-compatible chainable API) ──────────

type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte';
interface Filter { field: string; op: FilterOp; value: any; }

export class fbQuery {
  private _col: string;
  private _filters: Filter[] = [];
  private _orderByField: string | null = null;
  private _orderByAsc = true;
  private _limitN: number | null = null;
  private _isSingle = false;
  private _countOnly = false;
  private _orTerms: Array<{ field: string; term: string }> = [];

  constructor(col: string) { this._col = col; }

  select(_fields?: string | { count?: string; head?: boolean }): this {
    if (typeof _fields === 'object' && _fields.head) this._countOnly = true;
    return this;
  }

  single(): this { this._isSingle = true; this._limitN = 1; return this; }

  eq(field: string, value: any): this { this._filters.push({ field, op: 'eq', value }); return this; }
  in(field: string, values: any[]): this { this._filters.push({ field, op: 'in', value: values }); return this; }
  gt(field: string, value: any): this { this._filters.push({ field, op: 'gt', value }); return this; }
  gte(field: string, value: any): this { this._filters.push({ field, op: 'gte', value }); return this; }
  lt(field: string, value: any): this { this._filters.push({ field, op: 'lt', value }); return this; }
  lte(field: string, value: any): this { this._filters.push({ field, op: 'lte', value }); return this; }

  or(expr: string): this {
    for (const part of expr.split(',')) {
      const m = part.trim().match(/^(\w+)\.ilike\.%(.+)%$/);
      if (m) this._orTerms.push({ field: m[1], term: m[2].toLowerCase() });
    }
    return this;
  }

  order(field: string, opts?: { ascending?: boolean } | boolean): this {
    this._orderByField = field;
    this._orderByAsc = typeof opts === 'boolean' ? opts : (opts?.ascending ?? true);
    return this;
  }

  limit(n: number): this { this._limitN = n; return this; }
  async run<T = any>(): Promise<{ data: T | T[] | null; error: { message: string } | null; count?: number }> {
    const neqFilters: Filter[] = [];
    const constraints: any[] = [];
    for (const f of this._filters) {
      switch (f.op) {
        case 'eq': constraints.push(where(f.field, '==', f.value)); break;
        case 'in': if (Array.isArray(f.value) && f.value.length > 0 && f.value.length <= 30) constraints.push(where(f.field, 'in', f.value)); break;
        case 'gt': constraints.push(where(f.field, '>', f.value)); break;
        case 'gte': constraints.push(where(f.field, '>=', f.value)); break;
        case 'lt': constraints.push(where(f.field, '<', f.value)); break;
        case 'lte': constraints.push(where(f.field, '<=', f.value)); break;
        case 'neq': neqFilters.push(f); break;
      }
    }
    if (this._orderByField) constraints.push(orderBy(this._orderByField, this._orderByAsc ? 'asc' : 'desc'));
    if (this._limitN !== null && neqFilters.length === 0 && this._orTerms.length === 0) constraints.push(fsLimit(this._limitN));

    let results: any[] = [];
    let firestoreSucceeded = false;
    let mergedPendingLocal = false;

    // 1. Attempt Firestore fetch with timeout
    let fsDocs: any[] = [];
    try {
      const snap: QuerySnapshot = await withTimeout(
        getDocs(query(collection(db, this._col), ...constraints)),
        DEFAULT_FS_TIMEOUT_MS,
        `Query on ${this._col} timed out`
      );
      fsDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      firestoreSucceeded = true;
    } catch {
      // Offline / permission / timeout — fallback to local collection below
    }

    // Always read the local collection. It is the source of truth for records
    // that Firestore rejected, could not reach, or has not yet received.
    const localDocs = getLocalCollection(this._col);

    // Merge locally-pending records into the Firestore results so newly reported
    // complaints (tagged `_pendingSync`) stay visible even when Firestore returns
    // an empty array or hasn't synced the write yet. Deleted/archived docs are NOT
    // tagged, so super-admin permanent deletes still propagate correctly.
    if (firestoreSucceeded) {
      const fsIds = new Set(fsDocs.map((d) => d.id));
      const pendingLocal = localDocs.filter((l) => l && l._pendingSync === true && !fsIds.has(l.id));
      if (pendingLocal.length > 0) {
        results = [...fsDocs, ...pendingLocal];
        mergedPendingLocal = true;
      } else {
        results = fsDocs;
      }
    } else {
      // 2. Firestore failed or timed out — fall back to the entire local collection.
      results = localDocs;
    }

    // Apply every query filter locally to the merged result set. This guarantees
    // that pending `_pendingSync` records are filtered correctly regardless of
    // whether the results came from Firestore alone, a Firestore+local merge, or a
    // full local fallback — and prevents records from other mines/scopes leaking in.
    for (const f of this._filters) {
      switch (f.op) {
        case 'eq': results = results.filter((r) => r[f.field] === f.value); break;
        case 'in': if (Array.isArray(f.value)) results = results.filter((r) => f.value.includes(r[f.field])); break;
        case 'gt': results = results.filter((r) => r[f.field] > f.value); break;
        case 'gte': results = results.filter((r) => r[f.field] >= f.value); break;
        case 'lt': results = results.filter((r) => r[f.field] < f.value); break;
        case 'lte': results = results.filter((r) => r[f.field] <= f.value); break;
        case 'neq': results = results.filter((r) => r[f.field] !== f.value); break;
      }
    }

    if (firestoreSucceeded) saveLocalCollection(this._col, results);

    for (const f of neqFilters) results = results.filter((r) => r[f.field] !== f.value);
    if (this._orTerms.length > 0) {
      results = results.filter((r) => this._orTerms.some((t) => String(r[t.field] ?? '').toLowerCase().includes(t.term)));
    }
    if (this._orderByField && (!firestoreSucceeded || neqFilters.length > 0 || mergedPendingLocal)) {
      const field = this._orderByField;
      const asc = this._orderByAsc;
      results.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        return asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }
    if (this._limitN !== null) results = results.slice(0, this._limitN);
    if (this._countOnly) return { data: null, error: null, count: results.length };
    if (this._isSingle) return { data: results[0] ?? null, error: null };
    return { data: results, error: null };
  }
}

export class fbInsert {
  constructor(private _col: string, private _data: any) {}
  async select(): Promise<{ data: any | null; error: { message: string } | null }> {
    const docId = this._data.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const itemWithId = { ...this._data, id: docId };
    upsertLocalDoc(this._col, itemWithId);
    try {
      const r = await withTimeout(
        addDoc(collection(db, this._col), this._data),
        DEFAULT_FS_TIMEOUT_MS,
        `Insert on ${this._col} timed out`
      );
      const synced = { ...itemWithId, id: r.id };
      upsertLocalDoc(this._col, synced);
      return { data: synced, error: null };
    } catch {
      // Firestore rejected or timed out — keep the record locally and mark it
      // as pending-sync so reads merge it back instead of silently dropping it.
      const pending = { ...itemWithId, _pendingSync: true };
      upsertLocalDoc(this._col, pending);
      return { data: pending, error: null };
    }
  }
  single() { return this.select(); }
  async run(): Promise<{ error: { message: string } | null }> {
    const res = await this.select();
    return { error: res.error };
  }
}

export class fbUpdate {
  private _filters: Filter[] = [];
  constructor(private _col: string, private _data: any) {}
  eq(field: string, value: any): this { this._filters.push({ field, op: 'eq', value }); return this; }
  async run(): Promise<{ error: { message: string } | null }> {
    // 1. Update local storage immediately
    if (this._filters.length === 1 && this._filters[0].field === 'id') {
      updateLocalDoc(this._col, this._filters[0].value, this._data);
    } else {
      const list = getLocalCollection(this._col);
      list.forEach((item: any) => {
        const matches = this._filters.every((f) => item[f.field] === f.value);
        if (matches) Object.assign(item, this._data);
      });
      saveLocalCollection(this._col, list);
    }

    // 2. Sync to Firestore in background
    try {
      if (this._filters.length === 1 && this._filters[0].field === 'id') {
        await withTimeout(updateDoc(doc(db, this._col, this._filters[0].value), this._data));
        return { error: null };
      }
      const c = this._filters.map((f) => where(f.field, '==', f.value));
      const snap = await withTimeout(getDocs(query(collection(db, this._col), ...c)));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, this._data));
      await withTimeout(batch.commit());
      return { error: null };
    } catch {
      return { error: null };
    }
  }
}

export class fbDeleteQ {
  private _filters: Filter[] = [];
  constructor(private _col: string) {}
  eq(field: string, value: any): this { this._filters.push({ field, op: 'eq', value }); return this; }
  async run(): Promise<{ error: { message: string } | null }> {
    // 1. Delete from local storage immediately
    if (this._filters.length === 1 && this._filters[0].field === 'id') {
      deleteLocalDoc(this._col, this._filters[0].value);
    } else {
      const list = getLocalCollection(this._col);
      const filtered = list.filter((item: any) => !this._filters.every((f) => item[f.field] === f.value));
      saveLocalCollection(this._col, filtered);
    }

    // 2. Sync to Firestore
    try {
      if (this._filters.length === 1 && this._filters[0].field === 'id') {
        await withTimeout(deleteDoc(doc(db, this._col, this._filters[0].value)));
        return { error: null };
      }
      const c = this._filters.map((f) => where(f.field, '==', f.value));
      const snap = await withTimeout(getDocs(query(collection(db, this._col), ...c)));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await withTimeout(batch.commit());
      return { error: null };
    } catch {
      return { error: null };
    }
  }
}

export class fbUpsert {
  constructor(private _col: string, private _data: any) {}
  async run(): Promise<{ error: { message: string } | null }> {
    upsertLocalDoc(this._col, this._data);
    try {
      if (this._data.id) {
        await withTimeout(setDoc(doc(db, this._col, this._data.id), this._data, { merge: true }));
      } else {
        await withTimeout(addDoc(collection(db, this._col), this._data));
      }
      return { error: null };
    } catch {
      return { error: null };
    }
  }
}

// ── Convenience exports ────────────────────────────────────────

export function fb(col: string): fbQuery { return new fbQuery(col); }
export function fbInsertInto(col: string, data: any): fbInsert { return new fbInsert(col, data); }
export function fbUpdateOf(col: string, data: any): fbUpdate { return new fbUpdate(col, data); }
export function fbDeleteFrom(col: string): fbDeleteQ { return new fbDeleteQ(col); }
export function fbUpsertInto(col: string, data: any): fbUpsert { return new fbUpsert(col, data); }

export async function fbCount(col: string, ...constraints: any[]): Promise<number> {
  try {
    const snap = await withTimeout(getDocs(query(collection(db, col), ...constraints)));
    return snap.size;
  } catch (e: unknown) {
    // Missing index / offline / permission error → 0 without crashing callers.
    console.warn('[fbCount] query failed:', (e as { message?: string }).message ?? e);
    return 0;
  }
}

/**
 * Batch write/merge documents using explicit ids (upsert semantics).
 * Used for dataset ingestion & seeding. Local caches are updated first so
 * the offline-first UX and cross-tab sync keep working while Firestore is
 * unreachable.
 */
export async function fbBatchSetByIds(col: string, items: any[]): Promise<void> {
  if (!items.length) return;
  const withIds = items.filter((it) => !!it.id);
  withIds.forEach((it) => upsertLocalDoc(col, it));
  if (!withIds.length) return;
  try {
    const batch = writeBatch(db);
    withIds.forEach((it) => batch.set(doc(db, col, it.id), it, { merge: true }));
    await withTimeout(batch.commit(), DEFAULT_FS_TIMEOUT_MS);
  } catch (e: unknown) {
    console.warn('[fbBatchSetByIds] Firestore not reachable — kept locally:', (e as { message?: string }).message ?? e);
  }
}

export async function fbBatchInsert(col: string, dataArr: any[]): Promise<{ error?: { message: string } }> {
  // Persist locally regardless of Firestore outcome so records (e.g. broadcast
  // notifications) are NEVER silently lost while Firestore is slow/offline.
  // When Firestore accepts them they are marked synced; otherwise they carry
  // `_pendingSync` so reads can merge them back (see fbQuery.run / notif list).
  let serverOk = false;
  let ids: string[] = [];
  try {
    const batch = writeBatch(db);
    ids = dataArr.map((item) => {
      const ref = doc(collection(db, col));
      batch.set(ref, item);
      return ref.id;
    });
    await batch.commit();
    serverOk = true;
  } catch (e: any) {
    serverOk = false;
  }
  dataArr.forEach((item, i) => {
    const localDoc = { id: ids[i], ...item };
    if (serverOk) {
      upsertLocalDoc(col, localDoc);
    } else {
      upsertLocalDoc(col, { ...localDoc, _pendingSync: true });
    }
  });
  return serverOk ? {} : { error: { message: 'Firestore write failed; records saved locally and tagged for sync' } };
}

export function fbSubscribe(col: string, onChange: (docs: any[]) => void, onError?: (err: Error) => void, ...constraints: any[]): Unsubscribe {
  const q = query(collection(db, col), ...constraints);
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function fbSubscribeDoc(col: string, id: string, onChange: (data: any | null) => void, onError?: (err: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, col, id), (snap) => {
    onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

export async function fbUploadFile(bucketPath: string, file: File): Promise<{ error?: { message: string } }> {
  try { await uploadBytes(ref(storage, bucketPath), file); return {}; }
  catch (e: any) { return { error: { message: e.message } }; }
}

export async function fbGetDownloadURL(bucketPath: string): Promise<string> {
  return getDownloadURL(ref(storage, bucketPath));
}