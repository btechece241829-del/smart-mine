// ────────────────────────────────────────────────────────────────
// EmployeesView — Employee Master (Admin/HR).
// Add, edit, deactivate and assign employees; every employee carries
// mine, department, designation, work area, shift, photo, joining date
// and assigned Overman / Manager for the attendance workflow.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Plus, RefreshCw, Search, UserCheck, Edit2, UserX, CheckCircle2, X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Card, Button, Spinner, EmptyState } from './ui/primitives';
import { Modal, TextInput, Select, TextArea } from './ui/inputs';
import { Profile, UserRole, ROLE_LABELS, AttendanceShift } from '../lib/types';
import {
  fetchEmployees, fetchOvermen, fetchManagers, saveEmployee, setEmployeeActive,
} from '../lib/employeeService';
import { fetchMines, ATTENDANCE_SHIFTS, AttendanceActor } from '../lib/attendance';

export const EmployeesView: React.FC = () => {
  const { profile, role } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [overmen, setOvermen] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [mines, setMines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [editEmp, setEditEmp] = useState<Profile | null | 'new'>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const actor: AttendanceActor = {
    id: profile?.id ?? 'unknown',
    name: profile?.full_name ?? 'System',
    role: (role ?? 'super_admin') as UserRole,
  };

  const load = async () => {
    setLoading(true);
    const [emps, ovs, mgrs, m] = await Promise.all([
      fetchEmployees(), fetchOvermen(), fetchManagers(), fetchMines(),
    ]);
    setEmployees(emps);
    setOvermen(ovs);
    setManagers(mgrs);
    setMines(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const minesById = useMemo(() => new Map(mines.map((m) => [m.id, m])), [mines]);

  const filtered = useMemo(() => {
    let rows = employees;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q));
    }
    if (roleFilter) rows = rows.filter((e) => e.role === roleFilter);
    return rows;
  }, [employees, search, roleFilter]);

  const openNew = () => {
    setForm({
      employee_id: '', full_name: '', email: '', phone: '', role: 'worker',
      mine_id: profile?.mine_id ?? '', department: '', designation: '',
      work_area: '', shift: 'Day', joining_date: '', profile_photo: '',
      assigned_overman_id: '', assigned_manager_id: '',
    });
    setEditEmp('new');
  };

  const openEdit = (e: Profile) => {
    setForm({
      employee_id: e.employee_id, full_name: e.full_name, email: e.email,
      phone: e.phone ?? '', role: e.role, mine_id: e.mine_id ?? '',
      department: e.department ?? '', designation: e.designation ?? '',
      work_area: e.work_area ?? '', shift: e.shift ?? 'Day',
      joining_date: e.joining_date ?? '', profile_photo: e.profile_photo ?? '',
      assigned_overman_id: e.assigned_overman_id ?? '',
      assigned_manager_id: e.assigned_manager_id ?? '',
    });
    setEditEmp(e);
  };

  const save = async () => {
    if (!form.full_name.trim() || !form.employee_id.trim() || !form.email.trim()) {
      setFlash({ type: 'error', text: 'Employee ID, name and email are required.' }); return;
    }
    setSaving(true);
    setFlash(null);
    const overman = overmen.find((o) => o.id === form.assigned_overman_id);
    const manager = managers.find((m) => m.id === form.assigned_manager_id);
    const input = {
      employee_id: form.employee_id.trim(),
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone || null,
      role: (form.role || 'worker') as UserRole,
      mine_id: form.mine_id || null,
      department: form.department || null,
      designation: form.designation || null,
      profile_photo: form.profile_photo || null,
      work_area: form.work_area || null,
      shift: (form.shift || 'Day') as AttendanceShift,
      joining_date: form.joining_date || null,
      assigned_overman_id: form.assigned_overman_id || null,
      assigned_overman_name: overman?.full_name ?? null,
      assigned_manager_id: form.assigned_manager_id || null,
      assigned_manager_name: manager?.full_name ?? null,
      is_active: editEmp && editEmp !== 'new' ? editEmp.is_active : true,
    };
    const existing = editEmp && editEmp !== 'new' ? editEmp : null;
    const res = await saveEmployee(input, actor, existing);
    setSaving(false);
    if (res.error) { setFlash({ type: 'error', text: res.error.message }); return; }
    setEditEmp(null);
    setFlash({ type: 'success', text: `Employee ${existing ? 'updated' : 'created'}: ${input.full_name}` });
    load();
  };

  const toggleActive = async (e: Profile) => {
    await setEmployeeActive(e.id, !e.is_active, actor);
    load();
  };

  if (loading) return <Spinner size="lg" label="Loading employee master..." />;
return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-copper-light" /> Employee Master
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            {employees.length} employees · the profile store is the attendance employee master
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
          <Button onClick={openNew}><Plus className="w-4 h-4" /> Add Employee</Button>
        </div>
      </div>

      {flash && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${flash.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
          {flash.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />} {flash.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 min-w-[240px]">
          <Search className="w-4 h-4 text-warm-slate" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, email, department..." className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60" />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[{ value: '', label: 'All roles' }, ...(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))]}
          className="w-48"
        />
      </div>
{/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase className="w-8 h-8" />} title="No employees found"
          subtitle="Add an employee, or a Super Admin can ingest a workers dataset in Data Hub." />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Designation</th>
                  <th className="text-left px-4 py-3">Dept</th>
                  <th className="text-left px-4 py-3">Mine</th>
                  <th className="text-left px-4 py-3">Area / Shift</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  <th className="text-left px-4 py-3">Supervisors</th>
                  <th className="text-center px-4 py-3">Active</th>
                  <th className="text-center px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const mine = e.mine_id ? minesById.get(e.mine_id) : null;
                  return (
                    <tr key={e.id} className="border-b border-carbon-700/40 hover:bg-carbon-850/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {e.profile_photo
                            ? <img src={e.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover border border-carbon-600" />
                            : <div className="w-8 h-8 rounded-full bg-copper/20 border border-copper/40 flex items-center justify-center text-[10px] font-bold text-copper-light">{e.full_name.slice(0, 2).toUpperCase()}</div>}
                          <div>
                            <div className="font-semibold text-warm-pale">{e.full_name}</div>
                            <div className="font-mono text-[10px] text-copper-light">{e.employee_id} · {ROLE_LABELS[e.role]}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-warm-slate">{e.designation ?? '—'}</td>
                      <td className="px-4 py-3 text-warm-slate">{e.department ?? '—'}</td>
                      <td className="px-4 py-3 text-warm-slate">{mine?.mine_name ?? '—'}</td>
                      <td className="px-4 py-3 text-warm-slate">{e.work_area ?? '—'} <span className="text-[10px] text-warm-slate/60">/ {e.shift ?? '—'}</span></td>
                      <td className="px-4 py-3 text-warm-slate">{e.phone ?? e.email}</td>
                      <td className="px-4 py-3 text-warm-slate">{e.joining_date ?? '—'}</td>
                      <td className="px-4 py-3 text-[10px]">
                        <div className="text-copper-light">{e.assigned_overman_name ?? 'No Overman'}</div>
                        <div className="text-warm-slate/70">{e.assigned_manager_name ?? 'No Manager'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.is_active
                          ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                          : <span className="inline-flex items-center gap-1 text-warm-slate/50"><UserX className="w-3.5 h-3.5" /> Inactive</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="Edit" onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-carbon-700 text-warm-slate hover:text-copper-light"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button title={e.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(e)} className={`p-1.5 rounded hover:bg-carbon-700 ${e.is_active ? 'text-warm-slate hover:text-rose-400' : 'text-emerald-400'}`}>
                            {e.is_active ? <UserX className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
{/* Add/Edit modal */}
      <Modal open={!!editEmp} onClose={() => setEditEmp(null)} title={editEmp === 'new' ? 'Add Employee' : `Edit ${(editEmp as Profile)?.full_name ?? ''}`} wide>
        {editEmp && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Employee ID *</label>
              <TextInput value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="e.g. EMP-1001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Full Name *</label>
              <TextInput value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Email *</label>
              <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Phone</label>
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Role</label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                options={(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Designation</label>
              <TextInput value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Shot-firer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Department</label>
              <TextInput value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Underground Mining" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Assigned Mine</label>
              <Select value={form.mine_id} onChange={(e) => setForm({ ...form, mine_id: e.target.value })}
                options={[{ value: '', label: 'None' }, ...mines.map((m) => ({ value: m.id, label: m.mine_name }))]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Work Area</label>
              <TextInput value={form.work_area} onChange={(e) => setForm({ ...form, work_area: e.target.value })} placeholder="e.g. 3 North panel" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Default Shift</label>
              <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}
                options={[{ value: '', label: 'Not set' }, ...ATTENDANCE_SHIFTS.map((s) => ({ value: s, label: `${s} Shift` }))]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Joining Date</label>
              <TextInput type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Photo URL</label>
              <TextInput value={form.profile_photo} onChange={(e) => setForm({ ...form, profile_photo: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Assigned Overman</label>
              <Select value={form.assigned_overman_id} onChange={(e) => setForm({ ...form, assigned_overman_id: e.target.value })}
                options={[{ value: '', label: 'None' }, ...overmen.map((o) => ({ value: o.id, label: o.full_name }))]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Assigned Manager</label>
              <Select value={form.assigned_manager_id} onChange={(e) => setForm({ ...form, assigned_manager_id: e.target.value })}
                options={[{ value: '', label: 'None' }, ...managers.map((m) => ({ value: m.id, label: m.full_name }))]} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditEmp(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>
                <UserCheck className="w-4 h-4" /> {editEmp === 'new' ? 'Create Employee' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeesView;