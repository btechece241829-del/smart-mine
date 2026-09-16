// ────────────────────────────────────────────────────────────────
// DataHubView — Super Admin Data Ingestion, Dataset Upload & Management
// Only accessible to Super Admin. Propagates data to all roles.
// ────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet,
  Trash2, Edit2, Plus, Download, ShieldCheck, Search
} from 'lucide-react';
import { fb, fbInsertInto, fbUpdateOf, fbDeleteFrom, clearLocalCollection } from '../lib/firebaseDb';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { Card, Button, Spinner } from './ui/primitives';
import { TextInput, Select, Modal, TextArea } from './ui/inputs';
import { DataHubTable } from './DataHubTable';
import {
  CollectionTab, ingestSampleDatasets, detectTargetCollection, processUploadedFile
} from '../lib/datasetIngestion';

export const DataHubView: React.FC = () => {
  const { profile, role } = useAuth();
  const [activeTab, setActiveTab] = useState<CollectionTab>('complaints');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<CollectionTab, number>>({ complaints: 0, mines: 0, inspections: 0, profiles: 0 });
  const [editItem, setEditItem] = useState<any | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; file: File; detectedTarget: CollectionTab }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, mineRes, inspRes, profRes] = await Promise.all([
        fb('complaints').select('*').run<any[]>(),
        fb('mines').select('*').run<any[]>(),
        fb('inspections').select('*').run<any[]>(),
        fb('profiles').select('*').run<any[]>(),
      ]);
      const compData = (compRes.data ?? []) as any[];
      const mineData = (mineRes.data ?? []) as any[];
      const inspData = (inspRes.data ?? []) as any[];
      const profData = (profRes.data ?? []) as any[];
      setCounts({ complaints: compData.length, mines: mineData.length, inspections: inspData.length, profiles: profData.length });
      switch (activeTab) {
        case 'complaints': setItems(compData); break;
        case 'mines': setItems(mineData); break;
        case 'inspections': setItems(inspData); break;
        case 'profiles': setItems(profData); break;
      }
    } catch (err: any) { console.error(err); } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('smartmine_db_change', handler);
    return () => window.removeEventListener('smartmine_db_change', handler);
  }, [loadData]);

  const handleLoadSample = async () => {
    setProcessing(true); setStatusMessage(null);
    try {
      const res = await ingestSampleDatasets();
      setStatusMessage({ type: 'success', text: 'Successfully ingested ' + res.minesCount + ' Mines, ' + res.complaintsCount + ' Complaints, ' + res.inspectionsCount + ' Inspections, and ' + res.profilesCount + ' Workers. All data reflects live across all portal roles!' });
      await loadData();
    } catch (err: any) { setStatusMessage({ type: 'error', text: 'Sample dataset ingestion failed: ' + err.message }); }
    finally { setProcessing(false); }
  };

  const handleProcessUploadedFiles = async () => {
    if (uploadedFiles.length === 0) return;
    setProcessing(true); setStatusMessage(null);
    try {
      let total = 0;
      for (const uf of uploadedFiles) { total += await processUploadedFile(uf.file, uf.detectedTarget); }
      setStatusMessage({ type: 'success', text: 'Successfully processed and synchronized ' + total + ' records across all roles!' });
      setUploadedFiles([]); await loadData();
    } catch (err: any) { setStatusMessage({ type: 'error', text: 'Upload failed: ' + err.message }); }
    finally { setProcessing(false); }
  };

  const handleDeleteRecord = async (id: string) => {
    if (role !== 'super_admin') {
      setStatusMessage({ type: 'error', text: 'Only Super Admin can delete records.' });
      return;
    }
    if (activeTab === 'complaints') {
      if (!window.confirm('Permanently delete this complaint? The full record is removed for ALL roles. A DELETED audit event and the event history are kept.')) return;
      const res = await complaintsService.permanentlyDelete(id, { id: profile?.id, name: profile?.full_name ?? 'Super Admin', role: 'super_admin' });
      if (res.error) { setStatusMessage({ type: 'error', text: res.error }); return; }
      setStatusMessage({ type: 'success', text: 'Complaint permanently deleted by Super Admin. Audit event kept.' });
      loadData();
      return;
    }
    if (!window.confirm('Delete this record? This change will immediately affect all roles.')) return;
    await fbDeleteFrom(activeTab).eq('id', id).run(); loadData();
  };

  const handleSaveModal = async () => {
    if (!editItem) return;
    setLoading(true);
    if (isNewRecord) { await fbInsertInto(activeTab, editItem).run(); }
    else { await fbUpdateOf(activeTab, editItem).eq('id', editItem.id).run(); }
    setEditItem(null); setLoading(false); loadData();
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'minegov_' + activeTab + '_' + Date.now() + '.json'; a.click();
  };

  const handleClearCollection = () => {
    if (role !== 'super_admin') {
      setStatusMessage({ type: 'error', text: 'Only Super Admin can clear collections.' });
      return;
    }
    const msg = activeTab === 'complaints'
      ? 'Permanently delete ALL complaint records? They are removed for ALL roles (a DELETED audit event and event history are kept). This cannot be undone.'
      : 'Clear all ' + activeTab + ' records for ALL roles?';
    if (!window.confirm(msg)) return;
    clearLocalCollection(activeTab); loadData();
  };

  const filteredItems = items.filter((item: any) => !search.trim() || JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  const TABS: { key: CollectionTab; label: string }[] = [
    { key: 'complaints', label: 'Complaints & Issues' },
    { key: 'mines', label: 'Mines' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'profiles', label: 'Workforce / Users' },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-copper/20 via-carbon-800 to-carbon-900 border border-copper/40 p-5 rounded-2xl shadow-copper-glow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-copper text-white uppercase tracking-wider">Super Admin Exclusive</span>
            <span className="text-[11px] text-warm-slate font-mono flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Full Database Authority</span>
          </div>
          <h1 className="text-xl font-extrabold text-white">System Data Hub & Dataset Upload</h1>
          <p className="text-xs text-warm-slate mt-1 max-w-2xl">Upload custom CSVs or ingest verified datasets. Changes immediately reflect across all roles.</p>
        </div>
        <Button onClick={handleLoadSample} disabled={processing} className="text-xs bg-copper hover:bg-copper-light text-white font-bold px-4 py-2 shrink-0">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${processing ? 'animate-spin' : ''}`} />
          {processing ? 'Ingesting...' : '1-Click Ingest System Datasets'}
        </Button>
      </div>

      {/* Status */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />}
          <div className="flex-1 font-medium">{statusMessage.text}</div>
          <button onClick={() => setStatusMessage(null)} className="text-warm-slate hover:text-white text-sm">✕</button>
        </div>
      )}

      {/* Upload Card */}
      <Card title="Upload Custom CSV Datasets" subtitle="Drag and drop CSV files to update or replace live database collections">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragActive(false);
              if (e.dataTransfer.files?.length) {
                const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
                setUploadedFiles(files.map(f => ({ name: f.name, size: f.size, file: f, detectedTarget: detectTargetCollection(f.name) })));
              }
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragActive ? 'border-copper bg-copper/10' : 'border-carbon-700/80 bg-carbon-850/40 hover:border-carbon-600'}`}
          >
            <UploadCloud className="w-10 h-10 text-copper/70 mx-auto mb-2" />
            <p className="text-sm font-bold text-warm-pale">Drag and drop CSV files here</p>
            <p className="text-xs text-warm-slate mt-1">Supports Mines, Complaints, Inspections, and Workforce CSVs</p>
            <div className="mt-3 flex justify-center">
              <label className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-700 border border-carbon-600 text-xs text-warm-pale font-medium cursor-pointer">
                Browse CSV Files
                <input type="file" accept=".csv" multiple className="hidden" onChange={(e) => {
                  if (!e.target.files?.length) return;
                  const files = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
                  setUploadedFiles(files.map(f => ({ name: f.name, size: f.size, file: f, detectedTarget: detectTargetCollection(f.name) })));
                }} />
              </label>
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-2 bg-carbon-850/80 p-3 rounded-xl border border-carbon-700/60">
              <div className="text-xs font-bold text-warm-pale flex items-center justify-between">
                <span>Staged Files ({uploadedFiles.length})</span>
                <button onClick={() => setUploadedFiles([])} className="text-[11px] text-rose-400 hover:underline">Clear</button>
              </div>
              <div className="space-y-1.5">
                {uploadedFiles.map((uf, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-carbon-800 px-3 py-2 rounded-lg border border-carbon-700/40">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-warm-pale font-medium">{uf.name}</span>
                      <span className="text-[10px] text-warm-slate">({(uf.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-warm-slate">Target:</span>
                      <select value={uf.detectedTarget} onChange={(e) => { const val = e.target.value as CollectionTab; setUploadedFiles(prev => prev.map((f, i) => i === idx ? { ...f, detectedTarget: val } : f)); }} className="bg-carbon-900 border border-carbon-700 text-copper-light text-[11px] rounded px-2 py-0.5 outline-none font-mono">
                        <option value="complaints">Complaints & Issues</option>
                        <option value="mines">Mines</option>
                        <option value="inspections">Inspections</option>
                        <option value="profiles">Workforce / Users</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleProcessUploadedFiles} disabled={processing} className="text-xs font-bold">
                  {processing ? 'Processing...' : 'Ingest & Process Datasets'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Data tabs & table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-carbon-700/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => { setActiveTab(key); setSearch(''); }} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${active ? 'bg-copper text-white shadow-copper-glow' : 'text-warm-sand/80 bg-carbon-850 hover:bg-carbon-800'}`}>
                  <span>{label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${active ? 'bg-black/25 text-white' : 'bg-carbon-700 text-warm-slate'}`}>{counts[key]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportJson} className="text-xs"><Download className="w-3.5 h-3.5 mr-1" /> Export JSON</Button>
            <Button variant="secondary" onClick={handleClearCollection} disabled={role !== 'super_admin'} className="text-xs text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5 mr-1" /> Clear</Button>
            <Button onClick={() => {
              setIsNewRecord(true);
              if (activeTab === 'complaints') { const now = new Date().toISOString(); setEditItem({ complaint_number: 'CM-' + Date.now().toString().slice(-6), title: '', description: '', category: 'Safety', severity: 'High', status: 'Submitted', mine_id: 'M001', reported_by: 'super_admin', reported_by_name: 'Super Admin', reported_employee_id: 'SA-0001', reported_at: now, is_archived: false, archived_at: null, archived_by: null, created_at: now, updated_at: now }); }
              else if (activeTab === 'mines') setEditItem({ mine_name: '', mine_code: 'M00' + (counts.mines + 1), state: 'Chhattisgarh', location: 'Korba', mine_type: 'OPENCAST', status: 'Active', created_at: new Date().toISOString() });
              else if (activeTab === 'inspections') setEditItem({ inspection_number: 'INSP-' + (1000 + counts.inspections), mine_id: 'M001', inspection_type: 'Safety Audit', inspector_role: 'Safety Officer', checklist_score_pct: 90, observation_summary: '', severity: 'LOW', status: 'COMPLETED', date: new Date().toISOString().split('T')[0] });
              else if (activeTab === 'profiles') setEditItem({ email: '', full_name: '', employee_id: 'EMP-' + (1000 + counts.profiles), role: 'worker', department: 'Operations', mine_id: 'M001', is_active: true, created_at: new Date().toISOString() });
            }} className="text-xs font-semibold"><Plus className="w-3.5 h-3.5 mr-1" /> Add Record</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 max-w-md">
          <Search className="w-4 h-4 text-warm-slate" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={'Search ' + activeTab + '...'} className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60" />
        </div>

        {loading ? <Spinner size="lg" label={'Loading ' + activeTab + '...'} /> : filteredItems.length === 0 ? (
          <div className="bg-carbon-850 border border-carbon-700/60 rounded-xl p-8 text-center text-warm-slate text-xs">
            No records found in {activeTab}. Click "1-Click Ingest" or drop a CSV to load data.
          </div>
        ) : (
          <DataHubTable activeTab={activeTab} items={filteredItems} onEdit={(item) => { setIsNewRecord(false); setEditItem({ ...item }); }} onDelete={handleDeleteRecord} hideDelete={role !== 'super_admin'} />
        )}
      </div>
    </div>
  );
};
