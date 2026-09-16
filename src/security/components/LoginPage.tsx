// ────────────────────────────────────────────────────────────────
// Login page — professional, with show/hide password, remember me,
// forgot password, loading & error states.
// ────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, Loader2, HardHat, User, BadgeCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Spinner } from './ui/primitives';
import { TextInput } from './ui/inputs';

/** Inline SVG — Google "G" logo */
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ────────────────────────────────────────────────────────────────
// Signup form — local component to keep LoginPage manageable.
// ────────────────────────────────────────────────────────────────
interface SignUpFormProps {
  error: string | null;
  setError: (v: string | null) => void;
  handleSignUp: (e: React.FormEvent) => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  submitting: boolean;
  googleLoading: boolean;
  signupName: string;
  setSignupName: (v: string) => void;
  signupEmail: string;
  setSignupEmail: (v: string) => void;
  signupEmpId: string;
  setSignupEmpId: (v: string) => void;
  signupPassword: string;
  setSignupPassword: (v: string) => void;
  signupConfirm: string;
  setSignupConfirm: (v: string) => void;
  signupShowPassword: boolean;
  setSignupShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  goToLogin: () => void;
}

const SignUpForm: React.FC<SignUpFormProps> = ({
  error, setError, handleSignUp, handleGoogleSignIn, submitting, googleLoading,
  signupName, setSignupName, signupEmail, setSignupEmail,
  signupEmpId, setSignupEmpId, signupPassword, setSignupPassword,
  signupConfirm, setSignupConfirm, signupShowPassword, setSignupShowPassword,
  goToLogin,
}) => (
  <>
    <h2 className="text-lg font-bold text-warm-pale mb-1">Create Account</h2>
    <p className="text-xs text-warm-slate mb-6">Register to get started — you'll pick your role next</p>
    {error && (
      <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs">
        {error}
      </div>
    )}
    <form onSubmit={handleSignUp} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Full Name</label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
          <TextInput type="text" value={signupName} onChange={(e) => { setSignupName(e.target.value); setError(null); }} placeholder="e.g. Ramesh Kumar" className="pl-9" autoComplete="name" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
          <TextInput type="email" value={signupEmail} onChange={(e) => { setSignupEmail(e.target.value); setError(null); }} placeholder="you@mine.gov.in" className="pl-9" autoComplete="email" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Employee ID <span className="text-warm-slate/60">(optional)</span></label>
        <div className="relative">
          <BadgeCheck className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
          <TextInput type="text" value={signupEmpId} onChange={(e) => { setSignupEmpId(e.target.value); setError(null); }} placeholder="EMP-12345" className="pl-9" autoComplete="off" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Password</label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
          <TextInput type={signupShowPassword ? 'text' : 'password'} value={signupPassword} onChange={(e) => { setSignupPassword(e.target.value); setError(null); }} placeholder="Min. 6 characters" className="pl-9 pr-10" autoComplete="new-password" />
          <button type="button" onClick={() => setSignupShowPassword((v) => !v)} className="absolute right-3 top-2 text-warm-slate hover:text-copper-light" tabIndex={-1}>
            {signupShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-warm-slate mb-1.5">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
          <TextInput type={signupShowPassword ? 'text' : 'password'} value={signupConfirm} onChange={(e) => { setSignupConfirm(e.target.value); setError(null); }} placeholder="Re-enter password" className="pl-9 pr-10" autoComplete="new-password" />
          <button type="button" onClick={() => setSignupShowPassword((v) => !v)} className="absolute right-3 top-2 text-warm-slate hover:text-copper-light" tabIndex={-1}>
            {signupShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-carbon-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-carbon-900 text-warm-slate">or</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={submitting || googleLoading}
        className="w-full py-2.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 border border-carbon-700 text-warm-pale text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon className="w-4 h-4" />}
        {googleLoading ? 'Redirecting...' : 'Sign up with Google'}
      </button>
      <button
        type="submit"
        disabled={submitting || googleLoading}
        className="w-full py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-sm font-bold shadow-copper-glow transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
    <p className="mt-4 text-center text-xs text-warm-slate">
      Already have an account?{' '}
      <button type="button" onClick={goToLogin} className="text-copper-light hover:underline">
        Sign in
      </button>
    </p>
  </>
);


export const LoginPage: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, resetPassword, loading, configError, error: authError } = useAuth();
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const activeError = error || authError;
  // Signup state
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupEmpId, setSignupEmpId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupShowPassword, setSignupShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailOrId.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    const email = emailOrId.includes('@')
      ? emailOrId.trim()
      : `${emailOrId.trim()}@mine.gov.in`;
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) setError(res.error);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotEmail.trim()) {
      setForgotMsg('Enter your registered email address.');
      return;
    }
    const { error: err } = await resetPassword(forgotEmail.trim());
    if (err) {
      setForgotMsg(typeof err === 'string' ? err : (err as any)?.message ?? 'Failed to send reset email');
    } else {
      setForgotSent(true);
      setForgotMsg('Reset link sent! Check your inbox.');
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);
    if (res.error) setError(res.error);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) {
      setError('Please fill in your name, email and password.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const res = await signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      fullName: signupName.trim(),
      employeeId: signupEmpId.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else if (res.needsEmailConfirmation) {
      // Switch to the login view and surface the confirmation prompt
      setMode('login');
      setEmailOrId(signupEmail.trim());
      setPassword('');
      setError('Account created! Check your email to confirm your address, then sign in.');
    }
    // If no error and no confirmation needed, the auth state change will
    // route the user into role selection automatically.
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C0605]">
        <Spinner size="lg" label="Checking session..." />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0C0605]">
        <div className="max-w-md w-full bg-carbon-800/80 border border-carbon-700 rounded-2xl p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-warm-pale mb-2">Firebase Not Configured</h1>
          <p className="text-xs text-warm-slate mb-4 leading-relaxed">
            Create a <code className="text-copper-light">.env</code> file with your Firebase credentials:{' '}
            <code className="text-copper-light">VITE_FIREBASE_API_KEY</code>,{' '}
            <code className="text-copper-light">VITE_FIREBASE_AUTH_DOMAIN</code>, and{' '}
            <code className="text-copper-light">VITE_FIREBASE_PROJECT_ID</code>. See <code className="text-copper-light">SETUP.md</code>.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0C0605] relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-copper flex items-center justify-center shadow-copper-glow">
            <HardHat className="w-8 h-8 text-warm-pale" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Coal Mine Compliance</h1>
            <p className="text-xs text-warm-slate font-mono tracking-widest uppercase">Safety Issue Management</p>
          </div>
        </div>

        <div className="bg-carbon-900/80 backdrop-blur border border-carbon-700 rounded-2xl shadow-2xl p-8">
          {forgot ? (
            <>
              <h2 className="text-lg font-bold text-warm-pale mb-1">Reset Password</h2>
              <p className="text-xs text-warm-slate mb-6">Enter your email and we'll send you a reset link.</p>
              {forgotMsg && (
                <div className={`mb-4 p-3 rounded-lg text-xs border ${forgotSent ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/10 border-rose-500/40 text-rose-400'}`}>
                  {forgotMsg}
                </div>
              )}
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-warm-slate mb-1.5">Email</label>
                  <TextInput
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@mine.gov.in"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-sm font-bold shadow-copper-glow transition-all"
                >
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => { setForgot(false); setForgotMsg(null); }}
                  className="w-full py-2 rounded-lg bg-carbon-850 hover:bg-carbon-700 text-warm-sand text-xs"
                >
                  ← Back to login
                </button>
              </form>
            </>
          ) : mode === 'signup' ? (
            <SignUpForm
              error={activeError}
              setError={setError}
              handleSignUp={handleSignUp}
              handleGoogleSignIn={handleGoogleSignIn}
              submitting={submitting}
              googleLoading={googleLoading}
              signupName={signupName}
              setSignupName={setSignupName}
              signupEmail={signupEmail}
              setSignupEmail={setSignupEmail}
              signupEmpId={signupEmpId}
              setSignupEmpId={setSignupEmpId}
              signupPassword={signupPassword}
              setSignupPassword={setSignupPassword}
              signupConfirm={signupConfirm}
              setSignupConfirm={setSignupConfirm}
              signupShowPassword={signupShowPassword}
              setSignupShowPassword={setSignupShowPassword}
              goToLogin={() => { setMode('login'); setError(null); }}
            />
          ) : (
            <>
              <h2 className="text-lg font-bold text-warm-pale mb-1">Sign In</h2>
              <p className="text-xs text-warm-slate mb-6">Use your employee credentials to access the dashboard</p>

              {activeError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs">
                  {activeError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-warm-slate mb-1.5">Email / Employee ID</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
                    <TextInput
                      type="text"
                      value={emailOrId}
                      onChange={(e) => { setEmailOrId(e.target.value); setError(null); }}
                      placeholder="you@mine.gov.in or EMP-12345"
                      className="pl-9"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-warm-slate mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-warm-slate" />
                    <TextInput
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      className="pl-9 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2 text-warm-slate hover:text-copper-light"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-warm-sand cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-copper"
                    />
                    Remember me
                  </label>
                  <button type="button" onClick={() => setForgot(true)} className="text-copper-light hover:underline">
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-carbon-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-carbon-900 text-warm-slate">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={submitting || googleLoading}
                  className="w-full py-2.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 border border-carbon-700 text-warm-pale text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon className="w-4 h-4" />}
                  {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-sm font-bold shadow-copper-glow transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Signing in...' : 'Login'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-warm-slate">
                New here?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setForgot(false); }}
                  className="text-copper-light hover:underline"
                >
                  Create an account
                </button>
              </p>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-[10px] text-warm-slate/70 font-mono">
          Secured by Firebase Auth · Role-Based Access Control
        </p>
      </div>
    </div>
  );
};

