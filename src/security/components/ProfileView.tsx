// ────────────────────────────────────────────────────────────────
// Profile View — view & update personal profile
// ────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { User, BadgeCheck, Building2, ShieldCheck, Save } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { fbUpdateOf } from '../lib/firebaseDb';
import { Card, Button, Spinner } from './ui/primitives';
import { TextInput } from './ui/inputs';

export const ProfileView: React.FC = () => {
  const { profile, role } = useAuth();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [designation, setDesignation] = useState(profile?.designation ?? '');

  if (!profile) return <Spinner size="lg" label="Loading profile..." />;

  const handleSave = async () => {
    if (!fullName.trim()) { setMsg('Full name is required.'); return; }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fbUpdateOf('profiles', {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        department: department.trim() || null,
        designation: designation.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id).run();
      if (res.error) throw new Error(res.error.message);
      setMsg('Profile updated.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg(e.message ?? 'Failed to update profile.');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-copper/20 flex items-center justify-center">
          <User className="w-5 h-5 text-copper-light" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">My Profile</h1>
          <p className="text-xs text-warm-slate">View and update your personal information.</p>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="bg-gradient-to-r from-carbon-900 to-carbon-850 p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-copper/30 flex items-center justify-center text-xl font-extrabold text-warm-pale">
            {profile.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-warm-pale flex items-center gap-2">
              {profile.full_name} <BadgeCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs text-warm-slate mt-0.5">{profile.email}</div>
            <div className="text-[10px] font-mono text-warm-slate/60 mt-1">{profile.employee_id} · {role}</div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-carbon-850 border border-carbon-700">
              <div className="text-[10px] text-warm-slate font-mono uppercase">Role</div>
              <div className="text-xs font-bold text-warm-pale mt-1">{role}</div>
            </div>
            <div className="p-3 rounded-lg bg-carbon-850 border border-carbon-700">
              <div className="text-[10px] text-warm-slate font-mono uppercase">Mine</div>
              <div className="text-xs font-bold text-warm-pale mt-1">{profile.mine_name ?? '— No assigned mine —'}</div>
            </div>
            <div className="p-3 rounded-lg bg-carbon-850 border border-carbon-700">
              <div className="text-[10px] text-warm-slate font-mono uppercase">Status</div>
              <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
              </div>
            </div>
            <div className="p-3 rounded-lg bg-carbon-850 border border-carbon-700">
              <div className="text-[10px] text-warm-slate font-mono uppercase">Employee ID</div>
              <div className="text-xs font-mono text-warm-pale mt-1">{profile.employee_id}</div>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <h3 className="text-xs font-bold text-warm-pale flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-copper-light" /> Editable
            </h3>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name *" />
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
            <TextInput value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department (optional)" />
            <TextInput value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Designation (optional)" />

            {msg && <p className="text-xs text-emerald-300 font-mono">{msg}</p>}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};