// ────────────────────────────────────────────────────────────────
// Departments View — organizational structure derived from real
// user profiles (grouped by department, with member lists).
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Building2, Users } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { fb } from '../lib/firebaseDb';
import { Profile, ROLE_LABELS } from '../lib/types';
import { Card, Spinner, EmptyState } from './ui/primitives';

interface DepartmentGroup {
  name: string;
  members: Profile[];
}

export const DepartmentsView: React.FC = () => {
  const { role } = useAuth();
  const [groups, setGroups] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await fb('profiles').select('*').run<Profile[]>();
      const profiles = (data ?? []) as Profile[];
      const byName = new Map<string, Profile[]>();
      profiles.forEach((p) => {
        const name = p.department?.trim() || 'Unassigned';
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name)!.push(p);
      });
      const grouped: DepartmentGroup[] = Array.from(byName.entries())
        .map(([name, members]) => ({ name, members }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setGroups(grouped);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Spinner size="lg" label="Loading departments..." />;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-copper/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-copper-light" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">Departments</h1>
          <p className="text-xs text-warm-slate">Organizational structure by department — {groups.length} groups</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No departments found" subtitle="Departments are derived from user profiles." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.name} title={g.name} subtitle={`${g.members.length} member${g.members.length === 1 ? '' : 's'}`}>
              <div className="space-y-2">
                {g.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-carbon-850/60 border border-carbon-700/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-copper/20 flex items-center justify-center text-[10px] font-bold text-warm-pale shrink-0">
                        {m.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-warm-pale truncate">{m.full_name}</div>
                        <div className="text-[10px] font-mono text-warm-slate/60 truncate">{m.employee_id}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-carbon-800 text-warm-slate shrink-0">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {role === 'super_admin' && (
        <p className="text-[11px] text-warm-slate/60 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Assign departments to users from User Management.
        </p>
      )}
    </div>
  );
};