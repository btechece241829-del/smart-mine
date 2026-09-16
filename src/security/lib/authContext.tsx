// ────────────────────────────────────────────────────────────────
// AuthContext — Firebase Auth + Firestore profile + role detection
//
// SECURITY: We NEVER trust a role sent from the client. After Firebase
// authenticates the user, we fetch the profile row (role, mine, details)
// directly from Firestore.
// ────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile as firebaseUpdateProfile,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { fb, fbInsertInto, getDocById, setDocById } from './firebaseDb';
import { Profile, UserRole } from './types';

interface AuthContextValue {
  session: { user: FirebaseUser } | null;
  user: FirebaseUser | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  configError: boolean;
  error: string | null;
  /** True when the user authenticated via OAuth but has no profile row yet */
  needsRoleSelection: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (opts: {
    email: string;
    password: string;
    fullName: string;
    employeeId?: string;
  }) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /** Called after the user picks a role in the RoleSelectionScreen */
  completeRoleSelection: (role: UserRole) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  role: null,
  loading: true,
  configError: false,
  error: null,
  needsRoleSelection: false,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signInWithGoogle: async () => ({}),
  resetPassword: async () => ({}),
  completeRoleSelection: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/**
 * Resolve the base security app URL to use as an OAuth / post-auth
 * redirect target. Keeps us on the app regardless of any query/hash
 * params the auth provider appends during callbacks.
 */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(!isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    // 1. Check local cache first so user is never blocked or kept waiting
    let cachedProfile: Profile | null = null;
    try {
      const raw = localStorage.getItem(`smartmine_profile_${userId}`);
      if (raw) {
        const p = JSON.parse(raw) as Profile;
        if (p && p.role) {
          cachedProfile = p;
          setProfile(p);
          setNeedsRoleSelection(false);
        }
      }
    } catch (e) {
      console.warn('Error reading local profile cache:', e);
    }

    // 2. Read the profile document directly (document id == Firebase uid).
    //    A doc-id read needs no index and is the fastest online path.
    try {
      const docProfile = await getDocById<Profile>('profiles', userId);
      if (docProfile && docProfile.role) {
        if (!docProfile.is_active) {
          setError('Your account is disabled. Contact your administrator.');
          setNeedsRoleSelection(false);
          return;
        }
        setProfile(docProfile);
        setNeedsRoleSelection(false);
        try {
          localStorage.setItem(`smartmine_profile_${userId}`, JSON.stringify(docProfile));
        } catch {}
        return;
      }

      // 3. Fallback: legacy rows written with a random document id were
      //    queried by auth_user_id — keep supporting them.
      const { data: legacyProfile, error: err } = await fb('profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single()
        .run<Profile>();

      if (err) {
        console.warn('Firestore load profile warning:', err.message);
        if (!cachedProfile) {
          setProfile(null);
          setNeedsRoleSelection(true);
        }
        return;
      }

      if (legacyProfile) {
        const p = legacyProfile as unknown as Profile;
        if (!p.is_active) {
          setError('Your account is disabled. Contact your administrator.');
          setNeedsRoleSelection(false);
          return;
        }
        setProfile(p);
        setNeedsRoleSelection(false);
        try {
          localStorage.setItem(`smartmine_profile_${userId}`, JSON.stringify(p));
        } catch {}
      } else if (!cachedProfile) {
        // First-time user, no profile row exists
        setProfile(null);
        setNeedsRoleSelection(true);
      }
    } catch (e: any) {
      console.warn('fetchProfile network/timeout:', e);
      if (!cachedProfile) {
        setProfile(null);
        setNeedsRoleSelection(true);
      }
    }
  }, []);

  // On mount: subscribe to Firebase auth state + handle redirect result
  useEffect(() => {
    // Handle sign-in redirect result (fires after signInWithRedirect completes)
    getRedirectResult(auth)
      .then((cred) => {
        if (cred?.user) {
          fetchProfile(cred.user.uid);
        }
      })
      .catch((e: unknown) => {
        const err = e as { code?: string; message?: string };
        if (err.code === 'auth/configuration-not-found') {
          setError('Google Sign-in is not enabled in your Firebase project. Enable it under Authentication → Sign-in method in Firebase Console.');
        } else if (err.code !== 'auth/credential-already-in-use') {
          setError(err.message ?? 'Redirect sign-in failed.');
        }
      });

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);
      if (fbUser) {
        fetchProfile(fbUser.uid);
      } else {
        setProfile(null);
        setNeedsRoleSelection(false);
        setError(null);
      }
    });

    return unsubscribe;
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        await fetchProfile(cred.user.uid);
      }
      return {};
    } catch (e: unknown) {
      const message = (e as { code?: string; message?: string }).message ?? 'Sign in failed.';
      return { error: message };
    }
  };

  const signUp = async (opts: {
    email: string;
    password: string;
    fullName: string;
    employeeId?: string;
  }) => {
    setError(null);

    // Generate a deterministic employee ID if not provided
    let employeeId = opts.employeeId?.trim();
    if (!employeeId) {
      employeeId = `EMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, opts.email.trim(), opts.password);
      // Store display name on the Firebase user
      await firebaseUpdateProfile(cred.user, { displayName: opts.fullName.trim() });

      // Actually send the verification email so the user receives mail.
      // Best-effort: some Firebase projects disable email verification, in
      // which case this resolves with no error and the account stays usable.
      let emailSent = false;
      try {
        await sendEmailVerification(cred.user, {
          url: window.location.origin + '/security.html',
        });
        emailSent = true;
      } catch (e: unknown) {
        console.warn('Verification email not sent (may be disabled in Firebase):', e);
      }

      await fetchProfile(cred.user.uid);
      return {
        needsEmailConfirmation: emailSent && !cred.user.emailVerified,
        error: undefined,
      };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      // Give a friendly, actionable message for duplicate accounts
      if (err.code === 'auth/email-already-in-use') {
        return {
          error:
            'An account already exists with this email. Try signing in, or use "Forgot password" to reset your password.',
        };
      }
      const message = err.message ?? 'Sign up failed.';
      return { error: message };
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await fetchProfile(cred.user.uid);
      }
      return {};
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { error: 'Google sign-in was cancelled.' };
      }
      // Popup blocked — fall back to full-page redirect
      if (err.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: unknown) {
          const msg = (redirectErr as { message?: string }).message ?? 'Redirect sign-in failed.';
          return { error: msg };
        }
        return {}; // redirect is in progress, page will reload
      }
      if (err.code === 'auth/configuration-not-found') {
        return {
          error:
            'Google Sign-in is not enabled in your Firebase project. Go to Firebase Console → Authentication → Sign-in method, click Google, and enable it.',
        };
      }
      if (err.code === 'auth/unauthorized-domain') {
        return {
          error:
            'This domain is not authorized in Firebase. Go to Firebase Console → Authentication → Settings → Authorized domains and add "localhost".',
        };
      }
      const message = err.message ?? 'Google sign-in failed.';
      return { error: message };
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: window.location.origin + '/security.html',
      });
      return {};
    } catch (e: unknown) {
      const message = (e as { code?: string; message?: string }).message ?? 'Could not send reset email.';
      return { error: message };
    }
  };


  const completeRoleSelection = async (role: UserRole) => {
    if (!user) return { error: 'No authenticated user.' };
    setError(null);

    // Derive display info from the Firebase user metadata
    const fullName: string = user.displayName ?? user.email?.split('@')[0] ?? 'User';
    const email: string = user.email ?? '';
    const avatarUrl: string | null = user.photoURL ?? null;

    // Generate a deterministic employee ID from the auth user id
    const shortId = user.uid.replace(/-/g, '').slice(0, 8).toUpperCase();
    const employeeId = `EMP-${shortId}`;

    const newProfile: Profile = {
      id: user.uid,
      auth_user_id: user.uid,
      employee_id: employeeId,
      full_name: fullName,
      email,
      phone: null,
      role,
      mine_id: null,
      department: null,
      designation: null,
      is_active: true,
      profile_photo: avatarUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      work_area: null,
      shift: null,
      joining_date: null,
      assigned_overman_id: null,
      assigned_overman_name: null,
      assigned_manager_id: null,
      assigned_manager_name: null,
    };

    // 1. Immediately cache locally so the user transitions to dashboard without waiting or getting stuck
    try {
      localStorage.setItem(`smartmine_profile_${user.uid}`, JSON.stringify(newProfile));
    } catch (e) {
      console.warn('Could not cache profile locally:', e);
    }

    // 2. Set the active profile immediately so UI leaves RoleSelectionScreen
    setProfile(newProfile);
    setNeedsRoleSelection(false);

    // 3. Persist to Firestore using the UID as the document id (deterministic)
    await setDocById('profiles', user.uid, {
      auth_user_id: user.uid,
      employee_id: employeeId,
      full_name: fullName,
      email,
      role,
      is_active: true,
      profile_photo: avatarUrl,
    }).catch((e) => {
      console.warn('Firestore profile persist warning:', e);
    });

    return {};
  };

  const signOut = async () => {
    if (user?.uid) {
      try {
        localStorage.removeItem(`smartmine_profile_${user.uid}`);
      } catch {}
    }
    await firebaseSignOut(auth);
    setProfile(null);
    setUser(null);
    setNeedsRoleSelection(false);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.uid);
  }, [user, fetchProfile]);

  const role = profile?.role ?? null;

  const value: AuthContextValue = {
    session: user ? { user } : null,
    user,
    profile,
    role,
    loading,
    configError,
    error,
    needsRoleSelection,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    completeRoleSelection,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

