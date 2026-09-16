// ────────────────────────────────────────────────────────────────
// Escalation Rules — Super Admin views/edits escalation config
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { fb, fbInsertInto, fbUpdateOf, fbDeleteFrom } from '../lib/firebaseDb';
import { EscalationRule, ROLE_LABELS, SEVERITIES, UserRole } from '../lib/types';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { Select, TextInput } from './ui/inputs';

export const EscalationRulesView: React.FC = () => {
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState({ category: '', severity: '', from_role: 'worker' as UserRole, to_role: 'mining_mate' as UserRole, hours_until_escalation: 24, reminder_hours: 12, is_critical: false });
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await fb('escalation_rules').select('*').order('created_at').run<EscalationRule[]>();
    setRules((data ?? []) as EscalationRule[]);
    setLoading(false);
  };

  const addRule = async () => {
    setAdding(true);
    await fbInsertInto('escalation_rules', {
      category: newRule.category || null,
      severity: newRule.severity || null,
      from_role: newRule.from_role,
      to_role: newRule.to_role,
      hours_until_escalation: newRule.hours_until_escalation,
      reminder_hours: newRule.reminder_hours,
      is_critical: newRule.is_critical,
    }).run();
    setAdding(false);
    load();
  };

  const toggleRule = async (id: string, active: boolean) => {
    await fbUpdateOf('escalation_rules', { active }).eq('id', id).run();
    load();
  };

  const deleteRule = async (id: string) => {
    await fbDeleteFrom('escalation_rules').eq('id', id).run();
    load();
  };

  if (loading) return <Spinner size="lg" label="Loading rules..." />;

  const roles = (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <ArrowUpRight className="w-5 h-5 text-copper-light" />
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">Escalation Rules</h1>
          <p className="text-xs text-warm-slate">Configure automatic complaint escalation timelines</p>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState title="No escalation rules configured" subtitle="Add a rule to automate escalation" />
      ) : (
        <Card padded={false}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-carbon-700/60 text-warm-slate">
                <th className="text-left px-4 py-3">From</th>
                <th className="text-left px-4 py-3">To</th>
                <th className="text-left px-4 py-3">Hours</th>
                <th className="text-left px-4 py-3">Reminder</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-center px-4 py-3">Critical</th>
                <th className="text-center px-4 py-3">Active</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-carbon-700/40">
                  <td className="px-4 py-3 font-mono text-copper-light">{ROLE_LABELS[r.from_role]}</td>
                  <td className="px-4 py-3 font-mono text-copper-light">{ROLE_LABELS[r.to_role]}</td>
                  <td className="px-4 py-3">{r.hours_until_escalation}h</td>
                  <td className="px-4 py-3">{r.reminder_hours}h</td>
                  <td className="px-4 py-3">{r.category ?? 'Any'}</td>
                  <td className="px-4 py-3">{r.severity ?? 'Any'}</td>
                  <td className="px-4 py-3 text-center">{r.is_critical ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleRule(r.id, !r.active)} className={r.active ? 'text-emerald-400' : 'text-warm-slate/40'}>
                      {r.active ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteRule(r.id)} className="text-rose-400 hover:underline text-[11px]">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add new rule */}
      <Card title="Add New Rule">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] text-warm-slate mb-1">From Role</label>
            <Select value={newRule.from_role} onChange={(e) => setNewRule({ ...newRule, from_role: e.target.value as UserRole })} options={roles} />
          </div>
          <div>
            <label className="block text-[10px] text-warm-slate mb-1">To Role</label>
            <Select value={newRule.to_role} onChange={(e) => setNewRule({ ...newRule, to_role: e.target.value as UserRole })} options={roles} />
          </div>
          <div>
            <label className="block text-[10px] text-warm-slate mb-1">Hours</label>
            <TextInput type="number" value={String(newRule.hours_until_escalation)} onChange={(e) => setNewRule({ ...newRule, hours_until_escalation: +e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] text-warm-slate mb-1">Reminder (h)</label>
            <TextInput type="number" value={String(newRule.reminder_hours)} onChange={(e) => setNewRule({ ...newRule, reminder_hours: +e.target.value })} />
          </div>
        </div>
        <div className="flex items-end gap-3 mt-3">
          <div className="flex-1">
            <label className="block text-[10px] text-warm-slate mb-1">Category (blank = any)</label>
            <TextInput value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} placeholder="e.g. Safety, Fire" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-warm-slate mb-1">Severity (blank = any)</label>
            <Select value={newRule.severity} onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })} options={[{ value: '', label: 'All' }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]} />
          </div>
          <label className="flex items-center gap-2 text-xs text-warm-sand">
            <input type="checkbox" checked={newRule.is_critical} onChange={(e) => setNewRule({ ...newRule, is_critical: e.target.checked })} className="accent-copper" />
            Critical
          </label>
          <Button loading={adding} onClick={addRule}>Add Rule</Button>
        </div>
      </Card>
    </div>
  );
};

