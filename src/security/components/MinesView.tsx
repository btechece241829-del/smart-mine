// ────────────────────────────────────────────────────────────────
// Mines management — Super Admin views/configures mines
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { fbInsertInto, fbUpdateOf, fbDeleteFrom } from '../lib/firebaseDb';
import { listMines, ensureMinesSeeded } from '../lib/mines';
import { Mine } from '../lib/types';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { TextInput, Select, Modal } from './ui/inputs';

export const MinesView: React.FC = () => {
  const [mines, setMines] = useState<Mine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [state, setState] = useState('Chhattisgarh');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mineType, setMineType] = useState('OPENCAST');
  const [status, setStatus] = useState('Active');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    await ensureMinesSeeded().catch(() => {});
    setMines(await listMines(true));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setName('');
    setCode(`M${String(mines.length + 1).padStart(3, '0')}`);
    setLocation('');
    setState('Chhattisgarh');
    setLatitude('');
    setLongitude('');
    setMineType('OPENCAST');
    setStatus('Active');
    setShowModal(true);
  };

  const openEdit = (m: Mine) => {
    setEditId(m.id);
    setName(m.mine_name);
    setCode(m.mine_code || '');
    setLocation(m.location || '');
    setState(m.state || 'Chhattisgarh');
    setLatitude(m.latitude ? String(m.latitude) : '');
    setLongitude(m.longitude ? String(m.longitude) : '');
    setMineType(m.mine_type || 'OPENCAST');
    setStatus(m.status || 'Active');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editId) {
      await fbUpdateOf('mines', {
        mine_name: name.trim(),
        mine_code: code.trim(),
        location: location.trim() || null,
        state,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        mine_type: mineType,
        status,
      }).eq('id', editId).run();
    } else {
      await fbInsertInto('mines', {
        mine_name: name.trim(),
        mine_code: code.trim() || `M${Date.now().toString().slice(-4)}`,
        location: location.trim() || null,
        state,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        mine_type: mineType,
        status,
        created_at: new Date().toISOString(),
      }).run();
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string, mineName: string) => {
    if (!window.confirm(`Delete mine "${mineName}"? Changes propagate to all roles.`)) return;
    await fbDeleteFrom('mines').eq('id', id).run();
    load();
  };

  if (loading) return <Spinner size="lg" label="Loading mines..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-copper-light" />
          <div>
            <h1 className="text-lg font-extrabold text-warm-pale">Mines Management</h1>
            <p className="text-xs text-warm-slate">{mines.length} registered coal mines across operations</p>
          </div>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> Add Mine
        </Button>
      </div>

      {mines.length === 0 ? (
        <EmptyState title="No mines registered" subtitle="Click Add Mine or use Data Hub & Upload" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mines.map((m) => (
            <Card key={m.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-warm-pale">{m.mine_name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[11px] text-copper-light font-semibold">{m.mine_code}</span>
                      <span className="text-[10px] text-warm-slate/60">·</span>
                      <span className="text-[10px] text-warm-slate">{m.mine_type || 'UNDERGROUND'}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${m.status === 'Active' || m.status === 'OPERATING' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/15 text-rose-400 border-rose-500/40'}`}>
                    {m.status}
                  </span>
                </div>
                <div className="text-[11px] text-warm-slate space-y-1 bg-carbon-850/50 p-2.5 rounded-lg border border-carbon-700/30">
                  {m.location && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-copper/60 shrink-0" />{m.location}</p>}
                  {m.state && <p><span className="text-warm-slate/60">State:</span> {m.state}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-carbon-700/40">
                  <Button variant="ghost" onClick={() => openEdit(m)} className="text-xs">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" onClick={() => handleDelete(m.id, m.mine_name)} className="text-xs text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Mine' : 'Register New Mine'}>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-warm-slate mb-1">Mine Name *</label><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Korba East Open Cast" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-warm-slate mb-1">Code</label><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="M001" /></div>
            <div><label className="block text-xs font-medium text-warm-slate mb-1">Type</label><Select value={mineType} onChange={(e) => setMineType(e.target.value)} options={[{ value: 'OPENCAST', label: 'Opencast' }, { value: 'UNDERGROUND', label: 'Underground' }, { value: 'MIXED', label: 'Mixed' }]} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-warm-slate mb-1">State</label><TextInput value={state} onChange={(e) => setState(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-warm-slate mb-1">Status</label><Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'Active', label: 'Active' }, { value: 'Maintenance', label: 'Maintenance' }, { value: 'Inactive', label: 'Inactive' }]} /></div>
          </div>
          <div><label className="block text-xs font-medium text-warm-slate mb-1">Location Details</label><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="District, Block, Coordinates" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-warm-slate mb-1">GPS Latitude</label><TextInput value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="e.g. 22.352" /></div>
            <div><label className="block text-xs font-medium text-warm-slate mb-1">GPS Longitude</label><TextInput value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="e.g. 82.690" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save Mine'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
