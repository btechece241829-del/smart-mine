// ────────────────────────────────────────────────────────────────
// Audit Logs — Super Admin only, filterable by action/user/entity
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { fb } from '../lib/firebaseDb';
import { AuditLog } from '../lib/types';
import { formatDate } from '../lib/analytics';
import { Card, Spinner, EmptyState } from './ui/primitives';
import { TextInput } from './ui/inputs';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await fb('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500).run<AuditLog[]>();
      setLogs((data ?? []) as AuditLog[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      (l.user_name?.toLowerCase().includes(q)) ||
      (l.entity_type?.toLowerCase().includes(q)) ||
      (l.description?.toLowerCase().includes(q))
    );
  });

  if (loading) return <Spinner size="lg" label="Loading audit logs..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-copper-light" />
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">Audit Logs</h1>
          <p className="text-xs text-warm-slate">{logs.length} recorded actions</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 max-w-sm">
        <Search className="w-4 h-4 text-warm-slate" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, user, entity..." className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No audit logs found" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-left px-4 py-3">Timestamp</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-carbon-700/40 hover:bg-carbon-850/60">
                    <td className="px-4 py-3 font-mono text-warm-slate whitespace-nowrap">{formatDate(l.timestamp)}</td>
                    <td className="px-4 py-3 text-warm-pale">{l.user_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-copper-light text-[11px]">{l.role ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-carbon-850 border border-carbon-700 text-warm-sand font-mono">{l.action}</span>
                    </td>
                    <td className="px-4 py-3 text-warm-slate font-mono">{l.entity_type} {l.entity_id ? `#${l.entity_id.slice(0, 8)}` : ''}</td>
                    <td className="px-4 py-3 text-warm-slate max-w-[240px] truncate">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
