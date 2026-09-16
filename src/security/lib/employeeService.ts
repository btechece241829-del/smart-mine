// ────────────────────────────────────────────────────────────────
// Employee Master service — the `profiles` collection doubles as the
// employee master database (Firestore). Admins/HR add, edit, deactivate
// and view employees; every employee can be assigned to an Overman and a
// Manager for the attendance workflow, plus a default work area / shift.
// ────────────────────────────────────────────────────────────────
import { fb, fbUpsertInto, fbUpdateOf } from './firebaseDb';
import { logAudit } from './audit';
import { Profile, UserRole, AttendanceShift } from './types';
import { AttendanceActor } from './attendance';

export interface EmployeeInput {
  employee_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  mine_id?: string | null;
  department?: string | null;
  designation?: string | null;
  profile_photo?: string | null;
  work_area?: string | null;
  shift?: AttendanceShift | null;
  joining_date?: string | null;
  assigned_overman_id?: string | null;
  assigned_overman_name?: string | null;
  assigned_manager_id?: string | null;
  assigned_manager_name?: string | null;
  is_active?: boolean;
}

/** List all employees (profiles) sorted by name. */
export async function fetchEmployees(): Promise<Profile[]> {
  const { data } = await fb('profiles').select().run<Profile[]>();
  return ((data ?? []) as Profile[])
    .slice()
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

/** List employees filtered by an optional role/mine/active flag. */
export async function fetchEmployeesBy(params: { role?: UserRole | UserRole[]; mineId?: string; activeOnly?: boolean } = {}): Promise<Profile[]> {
  let rows = await fetchEmployees();
  if (params.role) {
    const roles = Array.isArray(params.role) ? params.role : [params.role];
    rows = rows.filter((p) => roles.includes(p.role));
  }
  if (params.mineId) rows = rows.filter((p) => p.mine_id === params.mineId);
  if (params.activeOnly) rows = rows.filter((p) => p.is_active !== false);
  return rows;
}

/** Overmen available for assignment. */
export function fetchOvermen(): Promise<Profile[]> {
  return fetchEmployeesBy({ role: 'overman', activeOnly: true });
}

/** Managers available for assignment. */
export function fetchManagers(): Promise<Profile[]> {
  return fetchEmployeesBy({ role: 'mine_manager', activeOnly: true });
}

/** Distinct department names present in the employee master. */
export async function fetchDepartments(): Promise<string[]> {
  const rows = await fetchEmployees();
  return Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => !!d))).sort();
}
/**
 * Create or update an employee (profile). Deterministic document id:
 * `emp_${employee_id}`. Every change is written to the audit log.
 */
export async function saveEmployee(input: EmployeeInput, actor: AttendanceActor, existing?: Profile | null): Promise<{ error: { message: string } | null; id?: string }> {
  const now = new Date().toISOString();
  const docId = existing?.id ?? (input.employee_id ? `emp_${input.employee_id}` : undefined);
  if (!docId) return { error: { message: 'Missing employee identifier.' } };

  const record: Profile = {
    id: docId,
    auth_user_id: existing?.auth_user_id ?? null,
    employee_id: input.employee_id,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone ?? existing?.phone ?? null,
    role: input.role,
    mine_id: input.mine_id ?? existing?.mine_id ?? null,
    department: input.department ?? existing?.department ?? null,
    designation: input.designation ?? existing?.designation ?? null,
    profile_photo: input.profile_photo ?? existing?.profile_photo ?? null,
    is_active: input.is_active ?? existing?.is_active ?? true,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    work_area: input.work_area ?? existing?.work_area ?? null,
    shift: input.shift ?? existing?.shift ?? null,
    joining_date: input.joining_date ?? existing?.joining_date ?? null,
    assigned_overman_id: input.assigned_overman_id ?? existing?.assigned_overman_id ?? null,
    assigned_overman_name: input.assigned_overman_name ?? existing?.assigned_overman_name ?? null,
    assigned_manager_id: input.assigned_manager_id ?? existing?.assigned_manager_id ?? null,
    assigned_manager_name: input.assigned_manager_name ?? existing?.assigned_manager_name ?? null,
  };

  const res = await fbUpsertInto('profiles', record).run();
  if (!res.error) {
    await logAudit({
      user_id: actor.id, user_name: actor.name, role: actor.role,
      action: existing ? 'EMPLOYEE_UPDATE' : 'EMPLOYEE_CREATE',
      entity_type: 'profiles', entity_id: docId,
      new_status: input.role,
      description: `${existing ? 'Updated' : 'Created'} employee ${input.full_name} (${input.employee_id})`,
    });
  }
  return res.error ? { error: res.error } : { error: null, id: docId };
}

/** Deactivate / reactivate an employee. */
export async function setEmployeeActive(id: string, active: boolean, actor: AttendanceActor): Promise<void> {
  await fbUpdateOf('profiles', { is_active: active, updated_at: new Date().toISOString() }).eq('id', id).run();
  await logAudit({
    user_id: actor.id, user_name: actor.name, role: actor.role,
    action: active ? 'EMPLOYEE_ACTIVATE' : 'EMPLOYEE_DEACTIVATE',
    entity_type: 'profiles', entity_id: id,
    new_status: active ? 'active' : 'inactive',
    description: `${active ? 'Activated' : 'Deactivated'} employee ${id}`,
  });
}

/** Assign an employee to an Overman (and/or Manager). */
export async function assignEmployeeToSupervisor(
  id: string,
  patch: {
    assigned_overman_id?: string | null;
    assigned_overman_name?: string | null;
    assigned_manager_id?: string | null;
    assigned_manager_name?: string | null;
  },
  actor: AttendanceActor,
): Promise<void> {
  await fbUpdateOf('profiles', { ...patch, updated_at: new Date().toISOString() }).eq('id', id).run();
  await logAudit({
    user_id: actor.id, user_name: actor.name, role: actor.role,
    action: 'EMPLOYEE_ASSIGN', entity_type: 'profiles', entity_id: id,
    description: `Updated supervisor assignment for ${id}`,
  });
}