// ────────────────────────────────────────────────────────────────
// User Management — Super Admin CRUD users, assign roles & mines
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Edit2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { fb, fbUpdateOf } from '../lib/firebaseDb';
import { Profile, UserRole, ROLE_LABELS, Mine } from '../lib/types';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { TextInput, Select, Modal } from './ui/inputs';
import { ensureMinesSeeded } from '../lib/mines';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [mines, setMines] = useState<Mine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('worker');
  const [editMineId, setEditMineId] = useState<string>('');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    await ensureMinesSeeded().catch(() => {});
    const [userData, mineData] = await Promise.all([
      fb('profiles').select('*').order('full_name').run<Profile[]>(),
      fb('mines').select('*').order('mine_name').run<Mine[]>(),
    ]);
    setUsers((userData.data ?? []) as Profile[]);
    setMines((mineData.data ?? []) as Mine[]);
    setLoading(false);
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.employee_id.toLowerCase().includes(q);
  });

  const openEdit = (u: Profile) => {
    setEditUser(u);
    setEditRole(u.role);
    setEditMineId(u.mine_id ?? '');
    setEditActive(u.is_active);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    await fbUpdateOf('profiles', { role: editRole, mine_id: editMineId || null, is_active: editActive }).eq('id', editUser.id).run();
    setSaving(false);
    setEditUser(null);
    load();
  };

  if (loading) return <Spinner size="lg" label="Loading users..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">User Management</h1>
          <p className="text-xs text-warm-slate">{users.length} registered users</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 max-w-sm">
        <Search className="w-4 h-4 text-warm-slate" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, ID..." className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Employee ID</th>
                  <th className="text-center px-4 py-3">Role</th>
                  <th className="text-center px-4 py-3">Active</th>
                  <th className="text-center px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-carbon-700/40 hover:bg-carbon-850/60">
                    <td className="px-4 py-3 font-semibold text-warm-pale">{u.full_name}</td>
                    <td className="px-4 py-3 text-warm-slate">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-copper-light">{u.employee_id}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-copper/15 text-copper-light font-mono text-[11px]">{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400 inline" /> : <ToggleLeft className="w-5 h-5 text-warm-slate/40 inline" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(u)} className="text-warm-slate hover:text-copper-light"><Edit2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <div className="space-y-4">
            <div className="text-xs text-warm-pale">
              <span className="text-warm-slate">Editing:</span> {editUser.full_name} ({editUser.employee_id})
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Role</label>
              <Select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                options={(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Assigned Mine</label>
              <Select
                value={editMineId}
                onChange={(e) => setEditMineId(e.target.value)}
                options={[{ value: '', label: 'None' }, ...mines.map((m) => ({ value: m.id, label: m.mine_name }))]}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-warm-sand cursor-pointer">
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="accent-copper" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button loading={saving} onClick={saveEdit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

