// ────────────────────────────────────────────────────────────────
// System Settings — Super Admin manages system-wide settings
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { fb, fbUpsertInto } from '../lib/firebaseDb';
import { SystemSetting } from '../lib/types';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { TextInput } from './ui/inputs';

export const SystemSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await fb('system_settings').select('*').order('key').run<SystemSetting[]>();
    setSettings((data ?? []) as SystemSetting[]);
    setLoading(false);
  };

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(edits)) {
      await fbUpsertInto('system_settings', { key, value, updated_at: new Date().toISOString() }).run();
    }
    setEdits({});
    await load();
    setSaving(false);
  };

  if (loading) return <Spinner size="lg" label="Loading settings..." />;

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-copper-light" />
          <div>
            <h1 className="text-lg font-extrabold text-warm-pale">System Settings</h1>
            <p className="text-xs text-warm-slate">Configure system-wide parameters</p>
          </div>
        </div>
        {hasEdits && (
          <Button loading={saving} onClick={saveAll}>
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        )}
      </div>

      {settings.length === 0 ? (
        <EmptyState title="No settings configured" subtitle="Run the schema.sql seed to initialize defaults" />
      ) : (
        <Card>
          <div className="space-y-3">
            {settings.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <label className="w-48 text-xs text-warm-slate font-mono truncate" title={s.key}>{s.key}</label>
                <TextInput
                  value={edits[s.key] ?? s.value}
                  onChange={(e) => handleChange(s.key, e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
