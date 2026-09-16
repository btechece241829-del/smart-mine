// ────────────────────────────────────────────────────────────────
// RoleSelectionScreen — shown to first-time Google sign-in users
// to pick their role and view associated permissions before entering
// the app.
// ────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  Loader2, ArrowLeft, CheckCircle, HardHat, ShieldCheck, Crown, Star,
  Pickaxe, Shield, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import {
  UserRole,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
} from '../lib/types';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  pickaxe: Pickaxe,
  hardhat: HardHat,
  shield: Shield,
  'shield-check': ShieldCheck,
  crown: Crown,
  star: Star,
};

const HIERARCHY_LEVELS: { role: UserRole; level: string }[] = [
  { role: 'worker', level: 'Entry Level' },
  { role: 'mining_mate', level: 'Field Supervisory' },
  { role: 'overman', level: 'Senior Supervisory' },
  { role: 'safety_officer', level: 'Specialist' },
  { role: 'mine_manager', level: 'Management' },
  { role: 'super_admin', level: 'Administration' },
];

export const RoleSelectionScreen: React.FC = () => {
  const { user, completeRoleSelection, signOut } = useAuth();
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = user?.displayName ?? user?.email ?? '';
  const displayEmail = user?.email ?? '';

  const handleSelect = (role: UserRole) => {
    setSelected(role);
    setStep('confirm');
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await completeRoleSelection(selected);
    setSaving(false);
    if (res.error) setError(res.error);
  };

  const handleBack = () => {
    setStep('pick');
    setSelected(null);
    setError(null);
  };

  const UserInfo: React.FC = () => (
    <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-carbon-800/60 border border-carbon-700/50">
      <div className="w-10 h-10 rounded-full bg-copper/20 flex items-center justify-center">
        <span className="text-sm font-bold text-copper-light">
          {(displayName || 'U').charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-warm-pale truncate">{displayName}</p>
        <p className="text-[11px] text-warm-slate truncate">{displayEmail}</p>
      </div>
    </div>
  );

  // ── Step 2: Confirm & review permissions ──────────────────────
  if (step === 'confirm' && selected) {
    const meta = ROLE_DESCRIPTIONS[selected];
    const permissions = ROLE_PERMISSIONS[selected] ?? [];
    const Icon = ICON_MAP[meta.icon] ?? ShieldCheck;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0C0605] relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="w-full max-w-lg relative">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-copper flex items-center justify-center shadow-copper-glow">
              <HardHat className="w-8 h-8 text-warm-pale" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Confirm Your Role</h1>
              <p className="text-xs text-warm-slate font-mono tracking-widest uppercase">Review permissions before proceeding</p>
            </div>
          </div>
          <div className="bg-carbon-900/80 backdrop-blur border border-carbon-700 rounded-2xl shadow-2xl p-8">
            <UserInfo />
            <div className="mb-6 p-4 rounded-xl border-2 border-copper/50 bg-copper/5">
              <div className="flex items-center gap-3 mb-2">
                <Icon className="w-6 h-6 text-copper-light" />
                <div>
                  <h3 className="text-sm font-bold text-warm-pale">{meta.title}</h3>
                  <span className="text-[10px] font-mono text-copper-light uppercase tracking-wider">
                    {HIERARCHY_LEVELS.find(h => h.role === selected)?.level}
                  </span>
                </div>
              </div>
              <p className="text-xs text-warm-slate leading-relaxed">{meta.description}</p>
            </div>
            <div className="mb-6">
              <h4 className="text-xs font-bold text-warm-pale uppercase tracking-wider mb-3">Your Permissions</h4>
              <ul className="space-y-2">
                {permissions.map((perm, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-warm-sand">{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={handleBack} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-carbon-850 hover:bg-carbon-700 text-warm-sand text-xs font-semibold border border-carbon-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" />Change Role
              </button>
              <button type="button" onClick={handleConfirm} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-xs font-bold shadow-copper-glow transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Setting up...' : 'Confirm & Enter'}
              </button>
            </div>
          </div>
          <p className="text-center mt-6 text-[10px] text-warm-slate/70 font-mono">
            Your role can be changed later by an administrator.
          </p>
        </div>
      </div>
    );
  }


  // ── Step 1: Pick a role ──────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0C0605] relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="w-full max-w-lg relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-copper flex items-center justify-center shadow-copper-glow">
            <HardHat className="w-8 h-8 text-warm-pale" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Select Your Role</h1>
            <p className="text-xs text-warm-slate font-mono tracking-widest uppercase">Choose the role that matches your job</p>
          </div>
        </div>
        <div className="bg-carbon-900/80 backdrop-blur border border-carbon-700 rounded-2xl shadow-2xl p-8">
          <UserInfo />
          <p className="text-xs text-warm-slate mb-5">
            Welcome! Please select your role to set up your workspace. This determines what features and data you can access.
          </p>
          <div className="space-y-2.5 mb-6 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {HIERARCHY_LEVELS.map(({ role, level }) => {
              const meta = ROLE_DESCRIPTIONS[role];
              const Icon = ICON_MAP[meta.icon] ?? ShieldCheck;
              const permCount = ROLE_PERMISSIONS[role]?.length ?? 0;
              return (
                <button key={role} type="button" onClick={() => handleSelect(role)}
                  className="w-full text-left p-4 rounded-xl bg-carbon-800/60 hover:bg-carbon-800 border border-carbon-700/50 hover:border-copper/40 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-carbon-700/60 group-hover:bg-copper/15 flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5 text-warm-slate group-hover:text-copper-light transition-colors" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-warm-pale group-hover:text-white transition-colors">{meta.title}</span>
                          <span className="text-[9px] font-mono text-warm-slate/80 uppercase tracking-wider px-1.5 py-0.5 rounded bg-carbon-700/60">{level}</span>
                        </div>
                        <p className="text-[11px] text-warm-slate mt-0.5 line-clamp-1">{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-warm-slate/70 font-mono">{permCount} perms</span>
                      <ChevronRight className="w-4 h-4 text-warm-slate group-hover:text-copper-light transition-colors" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={signOut}
            className="w-full py-2 rounded-lg bg-carbon-850 hover:bg-carbon-700 text-warm-slate text-xs transition-colors">
            Sign in with a different account
          </button>
        </div>
        <p className="text-center mt-6 text-[10px] text-warm-slate/70 font-mono">
          Your role can be changed later by an administrator.
        </p>
      </div>
    </div>
  );
};
