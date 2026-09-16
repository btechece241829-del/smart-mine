// ────────────────────────────────────────────────────────────────
// Firebase client — reads credentials from .env (VITE_FIREBASE_*)
//
// Provides: Auth, Firestore, and Storage instances.
// Replaces Supabase entirely.
// ────────────────────────────────────────────────────────────────
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
};

export const isFirebaseConfigured: boolean =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.authDomain &&
  !!firebaseConfig.projectId;

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

/** Firestore database instance */
export const db: Firestore = getFirestore(firebaseApp);

// ── Native offline persistence (queue writes offline, sync on reconnect) ──
// Complements the localStorage fallback layer in firebaseDb.ts with the
// real Firestore SDK offline cache — subscriptions/queries survive flaky
// mine-site connectivity and writes are queued until the network returns.
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((e: unknown) => {
    // Already-enabled / multi-tab contention is expected when several tabs
    // are open; everything still works — just logged, never fatal.
    console.warn('[firebase] IndexedDB persistence not enabled:', (e as { code?: string }).code ?? e);
  });
}

/** Firebase Storage instance */
export const storage: FirebaseStorage = getStorage(firebaseApp);

/** Shared Google credential provider (used by signInWithPopup / signInWithRedirect). */
export const googleProvider = new GoogleAuthProvider();

export default firebaseApp;
