// ──────────────────────────────────────────────────────────────────────
// Complaint Categories Admin — manage the category catalogue with
// subcategories, ordering and activation (Firestore `complaint_categories`).
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, Tag, RefreshCw, Ban } from 'lucide-react';
import { complaintCategoriesService } from '../../lib/complaintModule';
import { ComplaintCategory } from '../../lib/types';
import { Card, Button, Spinner, EmptyState } from '../ui/primitives';
import { TextInput, TextArea, Select, Modal } from '../ui/inputs';

interface EditorState {
  id?: string;
  name: string;
  subcategories: string;
  active: boolean;
  sort_order: number;
}

const EMPTY_EDITOR: EditorState = { name: '', subcategories: '', active: true, sort_order: 99 };

export const CategoriesAdminPage: React.FC = () => {
  const [items, setItems] = useState<ComplaintCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await complaintCategoriesService.list(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function openNew() {
    setEditor({ ...EMPTY_EDITOR, sort_order: (items.length ? Math.max(...items.map((i) => i.sort_order ?? 0)) : 0) + 1 });
    setEditorOpen(true);
  }

  function openEdit(c: ComplaintCategory) {
    setEditor({ id: c.id, name: c.name, subcategories: c.subcategories.join('\n'), active: c.active !== false, sort_order: c.sort_order ?? 99 });
    setEditorOpen(true);
  }

  async function saveEditor() {
    if (!editor.name.trim()) {
      setNotice('Category name is required.');
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await complaintCategoriesService.save({
        id: editor.id,
        name: editor.name.trim(),
        subcategories: editor.subcategories.split('\n').map((s) => s.trim()).filter(Boolean),
        active: editor.active,
        sort_order: editor.sort_order,
      });
      setEditorOpen(false);
      setNotice(`Saved "${editor.name}".`);
      await load();
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: ComplaintCategory) {
    setBusyId(c.id);
    try {
      await complaintCategoriesService.setActive(c.id, c.active === false);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory(c: ComplaintCategory) {
    if (!window.confirm(`Delete category "${c.name}"? Complaints already using it are not deleted.`)) return;
    setBusyId(c.id);
    try {
      await complaintCategoriesService.remove(c.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function seedDefaults() {
    setLoading(true);
    try {
      await complaintCategoriesService.ensureSeeded();
      await load();
      setNotice('Default catalogue applied (existing categories kept).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-2">
      {notice && <div className="text-xs text-copper-light">{notice}</div>}
      <Card
        title="Complaint Categories"
        icon={<Tag className="w-4 h-4" />}
        subtitle={`${items.length} categories · ${items.filter((c) => c.active !== false).length} active`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" loading={loading} onClick={seedDefaults}><RefreshCw className="w-3.5 h-3.5" />Defaults</Button>
            <Button onClick={openNew}><Plus className="w-3.5 h-3.5" />Add category</Button>
          </div>
        }
      >
        {loading ? (
          <div className="py-12 flex justify-center"><Spinner label="Loading categories…" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Tag className="w-5 h-5" />} title="No categories" subtitle="Add a category or apply the default catalogue." />
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className={`rounded-lg border px-3 py-2 ${c.active === false ? 'border-carbon-800 bg-carbon-900/40 opacity-60' : 'border-carbon-700 bg-carbon-850/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-warm-slate w-8">{c.sort_order ?? 99}</span>
                    <span className="text-sm font-semibold text-white truncate">{c.name}</span>
                    {c.active === false && <Ban className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" loading={busyId === c.id} onClick={() => toggleActive(c)}>{c.active === false ? 'Activate' : 'Deactivate'}</Button>
                    <Button variant="ghost" onClick={() => openEdit(c)}><Edit3 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" onClick={() => removeCategory(c)}><Trash2 className="w-3.5 h-3.5 text-rose-400" /></Button>
                  </div>
                </div>
                {c.subcategories.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-10">
                    {c.subcategories.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-carbon-800 border border-carbon-700 text-warm-sand">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? 'Edit category' : 'New category'}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Name</label>
            <TextInput value={editor.name} onChange={(e) => setEditor((ed) => ({ ...ed, name: e.target.value }))} placeholder="e.g. Fire" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Sub-categories (one per line)</label>
            <TextArea rows={6} value={editor.subcategories} onChange={(e) => setEditor((ed) => ({ ...ed, subcategories: e.target.value }))} placeholder={'Fire Hazard\nFire Extinguisher\nElectrical Fire'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Display order</label>
              <TextInput type="number" value={String(editor.sort_order)} onChange={(e) => setEditor((ed) => ({ ...ed, sort_order: Number(e.target.value) || 99 }))} />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Status</label>
              <Select value={editor.active ? 'active' : 'inactive'} onChange={(e) => setEditor((ed) => ({ ...ed, active: e.target.value === 'active' }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={saveEditor}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};