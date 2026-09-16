// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Register Complaint â€” v2 module entry form
// Location picker + GPS capture, dynamic categories, evidence uploader,
// offline device drafts + cross-device Firestore drafts.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import {
  LocateFixed, MapPin, Upload, Trash2, Save, Send, FileClock, AlertTriangle,
  Image as ImageIcon, Video as VideoIcon, CloudOff, CheckCircle2, Paperclip,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { listMines, ensureMinesSeeded } from '../../lib/mines';
import {
  complaintCategoriesService,
  registerComplaint,
  saveFirestoreDraft,
  saveLocalDraft,
  getLocalDrafts,
  deleteLocalDraft,
  listMyDrafts,
  uploadEvidenceFile,
  attachEvidence,
} from '../../lib/complaintModule';
import {
  Complaint,
  ComplaintCategory,
  Severity,
  Priority,
  PRIORITIES,
  WORK_SHIFTS,
  WORK_AREAS,
  DEPARTMENT_OPTIONS,
  UserRole,
} from '../../lib/types';
import { Card, Button, Spinner, EmptyState } from '../ui/primitives';
import { TextInput, TextArea, Select } from '../ui/inputs';

const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

interface LocalDraftRow {
  id: string;
  saved_at: string;
  title?: string;
  category?: string;
  severity?: string;
  complaint_id?: string;
}

interface PendingEvidence {
  kind: 'photo' | 'video';
  file: File;
  url?: string;
  storage_path?: string;
  upload_error?: string;
  uploading?: boolean;
}

interface Props {
  onDone?: (complaintId?: string | null) => void;
  prefillDraftId?: string | null;
}

function MapClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: any) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const SafeComplaintRegisterPage: React.FC<Props> = ({ onDone, prefillDraftId }) => {
  const { profile, role } = useAuth();
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [mines, setMines] = useState<Array<{ id: string; name: string }>>([]);
  const [localDrafts, setLocalDrafts] = useState<LocalDraftRow[]>([]);
  const [firestoreDrafts, setFirestoreDrafts] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<PendingEvidence[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    category: '',
    subcategory: '',
    severity: 'Medium' as Severity,
    priority: 'Medium' as Priority,
    immediate_danger: false,
    mine_id: profile?.mine_id ?? '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    location_name: '',
    location_address: '',
    department: '',
    work_area: '',
    shift: 'Day',
    expected_date: '',
    witnesses: '',
    immediate_action_taken: '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function applyComplaintPrefill(c: Complaint) {
    setForm((f) => ({
      ...f,
      title: c.title ?? '',
      description: c.description ?? '',
      category: c.category ?? '',
      category_id: c.category_id ?? '',
      subcategory: c.subcategory ?? '',
      severity: (c.severity as Severity) ?? 'Medium',
      immediate_danger: !!c.immediate_danger,
      mine_id: c.mine_id ?? f.mine_id,
      location: c.location ?? '',
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      location_name: c.location_name ?? '',
      location_address: c.location_address ?? '',
      department: c.department ?? '',
      work_area: c.work_area ?? '',
      shift: (c.shift as 'Day' | 'Night' | 'General') ?? 'Day',
    }));
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await complaintCategoriesService.ensureSeeded();
      setCategories(cats);
      await ensureMinesSeeded();
      setMines((await listMines()).map((m) => ({ id: m.id, name: m.mine_name ?? m.mine_code ?? m.id })));
      setLocalDrafts(getLocalDrafts<any>().filter((d) => !!d.title));
      if (profile?.id) {
        const mineDrafts = await listMyDrafts(profile.id);
        setFirestoreDrafts(mineDrafts);
      }
      if (prefillDraftId) {
        const mineD = (await listMyDrafts(profile?.id ?? '')).find((d) => d.id === prefillDraftId);
        if (mineD) applyComplaintPrefill(mineD);
      }
    } catch (e: any) {
      setNotice({ kind: 'err', text: `Failed to load: ${e.message}` });
    } finally {
      setLoading(false);
    }
  }, [prefillDraftId, profile?.id]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  const subcats = categories.find((c) => c.id === form.category_id)?.subcategories ?? [];

  function handleCategoryChange(catId: string) {
    const cat = categories.find((c) => c.id === catId);
    set('category_id', catId);
    set('category', cat?.name ?? '');
    set('subcategory', '');
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported in this browser.');
      return;
    }
    setGpsBusy(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude);
        set('longitude', pos.coords.longitude);
        setGpsBusy(false);
        setNotice({ kind: 'ok', text: `GPS captured (accuracy Â±${Math.round(pos.coords.accuracy)} m).` });
      },
      (err) => {
        setGpsBusy(false);
        setGpsError(err.message || 'Unable to obtain GPS position');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function onMapPick(lat: number, lng: number) {
    set('latitude', lat);
    set('longitude', lng);
    setGpsError(null);
  }

  function saveDraft() {
    saveLocalDraft({
      title: form.title,
      description: form.description,
      category_id: form.category_id,
      category: form.category,
      subcategory: form.subcategory,
      severity: form.severity,
      priority: form.priority,
      department: form.department,
      work_area: form.work_area,
      shift: form.shift,
      mine_id: form.mine_id,
      location: form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      expected_date: form.expected_date,
      witnesses: form.witnesses,
      immediate_action_taken: form.immediate_action_taken,
    });
    setLocalDrafts(getLocalDrafts<any>().filter((d) => !!d.title));
    setNotice({ kind: 'ok', text: 'Draft saved on this device.' });
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: PendingEvidence[] = [];
    for (const f of Array.from(files)) {
      const isVideo = f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name);
      next.push({ kind: isVideo ? 'video' : 'photo', file: f });
    }
    setEvidence((prev) => [...prev, ...next.slice(0, 20 - prev.length)]);
  }

  async function uploadAll(): Promise<Array<{ kind: 'photo' | 'video'; file_name: string; file_type: string; file_size: number; storage_path: string; download_url?: string | null }>> {
    const uploaded: Array<{ kind: 'photo' | 'video'; file_name: string; file_type: string; file_size: number; storage_path: string; download_url?: string | null }> = [];
    for (const ev of evidence) {
      setEvidence((prev) => prev.map((p) => (p.file === ev.file ? { ...p, uploading: true } : p)));
      const res = await uploadEvidenceFile(ev.file, ev.kind, { id: profile?.id ?? null, name: profile?.full_name ?? 'User' });
      setEvidence((prev) => prev.map((p) => (p.file === ev.file ? { ...p, uploading: false, ...res } : p)));
      if (res.storagePath) {
        uploaded.push({
          kind: ev.kind,
          file_name: ev.file.name,
          file_type: ev.file.type || (ev.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
          file_size: ev.file.size,
          storage_path: res.storagePath,
          download_url: res.url ?? null,
        });
      }
    }
    return uploaded;
  }

  async function saveRemoteDraft() {
    setSaving(true);
    try {
      const res = await saveFirestoreDraft(
        { ...form, mine_id: form.mine_id || null, gps_latitude: form.latitude, gps_longitude: form.longitude, gps_accuracy: null },
        { id: profile?.id ?? null, name: profile?.full_name ?? 'Worker', role: (role as UserRole) ?? 'worker' }
      );
      if (res.error) {
        setNotice({ kind: 'err', text: res.error });
      } else {
        setNotice({ kind: 'ok', text: 'Draft synced â€” continue on any device.' });
        if (profile?.id) setFirestoreDrafts(await listMyDrafts(profile.id));
      }
    } finally {
      setSaving(false);
    }
  }

  async function submit(draftId?: string | null) {
    if (!form.title.trim() || !form.description.trim()) {
      setNotice({ kind: 'err', text: 'Title and description are required.' });
      return;
    }
    if (!form.category_id) {
      setNotice({ kind: 'err', text: 'Please select a category.' });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const files = await uploadAll().catch(() => []);
      const res = await registerComplaint(
        { ...form, mine_id: form.mine_id || null, gps_latitude: form.latitude, gps_longitude: form.longitude, gps_accuracy: null },
        { id: profile?.id ?? null, name: profile?.full_name ?? 'Worker', role: (role as UserRole) ?? 'worker', designation: profile?.designation ?? null },
        { asDraftId: draftId }
      );
      if (res.error || !res.complaint) {
        setNotice({ kind: 'err', text: res.error ?? 'Failed to register' });
        return;
      }
      if (files.length > 0) {
        await attachEvidence(res.complaint.id, files, { id: profile?.id ?? null, name: profile?.full_name ?? 'User', role: (role as UserRole) ?? 'worker' });
      }
      if (draftId) deleteLocalDraft(draftId);
      setEvidence([]);
      setNotice({ kind: 'ok', text: `Complaint ${res.complaint.complaint_number} registered.` });
      onDone?.(res.complaint.id);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-2">
      {(localDrafts.length > 0 || firestoreDrafts.length > 0) && (
        <Card title="Resume a draft" icon={<FileClock className="w-4 h-4" />} subtitle="Offline drafts are stored on this device; synced drafts are available on any device.">
          <div className="grid md:grid-cols-2 gap-2">
            {localDrafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2 justify-between bg-carbon-800/50 border border-carbon-700 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{d.title}</div>
                  <div className="text-[10px] text-warm-slate">{d.category ?? 'No category'} â€¢ {d.severity ?? 'â€”'} â€¢ {new Date(d.saved_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" onClick={() => {
                    const found = getLocalDrafts<any>().find((x) => x.id === d.id);
                    if (found) setForm((f) => ({ ...f, ...found }));
                  }}>Load</Button>
                  <Button variant="ghost" onClick={async () => {
                    const found = getLocalDrafts<any>().find((x) => x.id === d.id);
                    if (found) setForm((f) => ({ ...f, ...found }));
                    await submit(d.id);
                  }}><Send className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" onClick={() => { deleteLocalDraft(d.id); setLocalDrafts(getLocalDrafts<any>().filter((x) => !!x.title)); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
            {firestoreDrafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2 justify-between bg-carbon-800/50 border border-carbon-700 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{d.title}</div>
                  <div className="text-[10px] text-warm-slate">Synced draft â€¢ {new Date(d.updated_at ?? '').toLocaleString()}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" onClick={() => applyComplaintPrefill(d)}>Load</Button>
                  <Button variant="ghost" onClick={async () => submit(d.id)}><Send className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" label="Loading categories..." /></div>
      ) : (
        <>
          <Card title="Register Complaint" icon={<MapPin className="w-4 h-4" />} subtitle="Step 1 of 2 â€” describe and locate the issue">
            {gpsError && <div className="mb-3 text-[11px] text-rose-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{gpsError}</div>}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Title *</label>
                  <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Roof fall near 3-Level gallery" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Category *</label>
                  <Select value={form.category_id} onChange={(e) => handleCategoryChange(e.target.value)} options={[{ value: '', label: 'Select categoryâ€¦' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                </div>
                {subcats.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Sub-category</label>
                    <Select value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} options={[{ value: '', label: 'None' }, ...subcats.map((s) => ({ value: s, label: s }))]} />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Severity *</label>
                  <div className="flex gap-2">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('severity', s)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                          form.severity === s
                            ? s === 'Critical' ? 'border-rose-400 bg-rose-500/20 text-rose-300'
                            : s === 'High' ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : s === 'Medium' ? 'border-amber-300 bg-amber-400/20 text-amber-200'
                            : 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                            : 'border-carbon-700 bg-carbon-850 text-warm-slate hover:border-carbon-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Priority (SLA)</label>
                  <Select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)} options={PRIORITIES.map((p) => ({ value: p, label: `${p}${p === 'Critical' ? ' â€” 48h' : p === 'High' ? ' â€” 72h' : p === 'Medium' ? ' â€” 5d' : ' â€” 7d'}` }))} />
                </div>
                <label className="flex items-center gap-2 text-xs text-warm-sand cursor-pointer">
                  <input type="checkbox" checked={form.immediate_danger} onChange={(e) => set('immediate_danger', e.target.checked)} className="accent-copper" />
                  Immediate danger to persons / production
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Description *</label>
                  <TextArea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What happened, when, who is affectedâ€¦" />
                </div>
                {mines.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Mine</label>
                    <Select value={form.mine_id} onChange={(e) => set('mine_id', e.target.value)} options={mines.map((m) => ({ value: m.id, label: m.name }))} />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Department</label>
                    <Select value={form.department} onChange={(e) => set('department', e.target.value)} options={[{ value: '', label: 'â€”' }, ...DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))]} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Work area</label>
                    <Select value={form.work_area} onChange={(e) => set('work_area', e.target.value)} options={[{ value: '', label: 'â€”' }, ...WORK_AREAS.map((w) => ({ value: w, label: w }))]} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Shift</label>
                    <Select value={form.shift} onChange={(e) => set('shift', e.target.value)} options={WORK_SHIFTS.map((s) => ({ value: s, label: s }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Expected resolution date</label>
                  <TextInput type="date" value={form.expected_date} onChange={(e) => set('expected_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Witnesses</label>
                  <TextArea rows={2} value={form.witnesses} onChange={(e) => set('witnesses', e.target.value)} placeholder="Names / employee IDs of witnesses" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Immediate action taken</label>
                  <TextArea rows={2} value={form.immediate_action_taken} onChange={(e) => set('immediate_action_taken', e.target.value)} placeholder="e.g. Barricaded the area, stopped the equipment, informed overman" />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Location & Evidence" icon={<Paperclip className="w-4 h-4" />} subtitle="Step 2 of 2 â€” pinpoint on the map, capture GPS, attach photos/videos">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" loading={gpsBusy} onClick={captureGps}><LocateFixed className="w-3.5 h-3.5" />{gpsBusy ? 'Locatingâ€¦' : 'Use GPS'}</Button>
                  <span className="text-[10px] text-warm-slate">
                    {form.latitude != null ? `Lat ${form.latitude.toFixed(5)}, Lng ${form.longitude?.toFixed(5)}` : 'No position yet â€” click the map or use GPS'}
                  </span>
                </div>
                <div className="h-56 rounded-lg overflow-hidden border border-carbon-700 relative z-0">
                  <MapContainer
                    center={[form.latitude ?? 23.8739, form.longitude ?? 86.4374]}
                    zoom={form.latitude != null ? 17 : 12}
                    style={{ height: '100%', width: '100%', background: '#1b1714' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    <MapClickCapture onPick={onMapPick} />
                    {form.latitude != null && form.longitude != null && (
                      <CircleMarker center={[form.latitude, form.longitude]} radius={10} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.4 }} />
                    )}
                  </MapContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="Location name (e.g. 3-Level gallery)" />
                  <TextInput value={form.location_address} onChange={(e) => set('location_address', e.target.value)} placeholder="Nearest landmark / address" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Evidence ({evidence.length})</div>
                    <div className="text-[10px] text-warm-slate">Photos & videos (max 20 files)</div>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload className="w-3.5 h-3.5" />Add files</Button>
                </div>
                {evidence.length === 0 ? (
                  <EmptyState icon={<ImageIcon className="w-5 h-5" />} title="No evidence attached" subtitle="Add photos or videos â€” they are uploaded to secure storage when you submit." />
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {evidence.map((ev, i) => (
                      <div key={i} className="flex items-center gap-3 bg-carbon-800/60 border border-carbon-700 rounded-lg px-3 py-2">
                        {ev.kind === 'photo' ? <ImageIcon className="w-4 h-4 text-copper-light shrink-0" /> : <VideoIcon className="w-4 h-4 text-copper-light shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-white truncate">{ev.file.name}</div>
                          <div className="text-[10px] text-warm-slate">{ev.kind} â€¢ {(ev.file.size / 1048576).toFixed(2)} MB{ev.uploading ? ' â€¢ uploadingâ€¦' : ev.upload_error ? ` â€¢ ${ev.upload_error}` : ''}</div>
                        </div>
                        <Button variant="ghost" onClick={() => setEvidence((prev) => prev.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-warm-slate leading-relaxed pt-1">
                  Nothing is submitted until you press <span className="text-copper-light font-semibold">Submit Complaint</span>.
                  Save a draft at any time â€” drafts stay private to you until you submit them.
                </p>
              </div>
            </div>

            {notice && (
              <div className={`mt-4 flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
                {notice.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {notice.text}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-carbon-800 pt-4">
              <Button variant="ghost" loading={saving} onClick={saveDraft}><CloudOff className="w-3.5 h-3.5" />Save draft (device)</Button>
              {profile?.id && (
                <Button variant="ghost" loading={saving} onClick={saveRemoteDraft}><Save className="w-3.5 h-3.5" />Save draft (synced)</Button>
              )}
              <Button loading={submitting} onClick={() => submit(null)}><Send className="w-3.5 h-3.5" />Submit Complaint</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};