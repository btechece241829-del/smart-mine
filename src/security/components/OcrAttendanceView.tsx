// ────────────────────────────────────────────────────────────────
// OcrAttendanceView — Super Admin "OCR Attendance Import" page.
// Upload a JPG/PNG/PDF attendance sheet, run client-side OCR, review
// and verify every extracted row (confidence-aware), then save the
// VERIFIED rows to the permanent register with source = 'OCR'.
// Low-confidence rows are highlighted and MUST be confirmed before
// the import proceeds.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScanLine, Save, Download, Trash2, CheckCircle2, AlertTriangle, FileImage,
  PencilLine, FileText, UploadCloud, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Card, Button, EmptyState } from './ui/primitives';
import {
  fetchMines, markAttendance, AttendanceActor, ATTENDANCE_SHIFTS, ATTENDANCE_STATUSES,
} from '../lib/attendance';
import { AttendanceShift, AttendanceStatus, Profile } from '../lib/types';
import {
  extractTextFromFile, parseAttendanceText, ParsedAttendanceRow, matchEmployee,
  LOW_CONFIDENCE_THRESHOLD, downloadAttendancePdf, OcrProgress,
} from '../lib/ocrService';
import { fetchEmployees } from '../lib/employeeService';
import { AttendanceStatusBadge } from '../lib/attendanceUi';

export const OcrAttendanceView: React.FC = () => {
  const { profile, role } = useAuth();

  const [mines, setMines] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [mineId, setMineId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<AttendanceShift>('Day');

  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [parsed, setParsed] = useState<ParsedAttendanceRow[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSaved, setLastSaved] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([fetchMines(), fetchEmployees()]).then(([m, e]) => {
      setMines(m);
      setEmployees(e);
    }).catch(() => {});
  }, []);

  const mineName = useMemo(
    () => mines.find((m) => m.id === mineId)?.mine_name ?? '',
    [mines, mineId],
  );

  const handleFile = (file: File) => {
    setImage({ url: URL.createObjectURL(file), name: file.name });
    setOcrText('');
    setParsed([]);
    setConfirmed(new Set());
    setLastSaved([]);
    setFlash(null);
  };

  const runOcr = async () => {
    if (!image) return;
    const file = await fetch(image.url).then((r) => r.blob()).then(
      (b) => new File([b], image.name, { type: b.type || 'image/*' }),
    );
    setOcrProgress({ status: 'Starting OCR engine…', progress: 0 });
    setFlash(null);
    try {
      const text = await extractTextFromFile(file, (p) => setOcrProgress(p));
      setOcrText(text);
      const rows = parseAttendanceText(text).map((r) => ({
        ...r,
        sheet_date: r.sheet_date ?? date,
        sheet_shift: r.sheet_shift ?? shift,
        employee: matchEmployee(r, employees),
      }));
      setParsed(rows);
      setConfirmed(new Set());
      setOcrProgress(null);
      const low = rows.filter((r) => r.confidence < LOW_CONFIDENCE_THRESHOLD).length;
      setFlash({ type: low ? 'error' : 'success', text: `OCR complete — ${rows.length} entries extracted. ${low ? `${low} low-confidence row(s) need manual verification.` : 'All rows high confidence.'} Review below.` });
    } catch (err: any) {
      setOcrProgress(null);
      setFlash({ type: 'error', text: 'OCR failed: ' + (err?.message ?? err) });
    }
  };
const updateRow = (idx: number, patch: Partial<ParsedAttendanceRow>) => {
    setParsed((prev) => { const next = [...prev]; next[idx] = { ...next[idx], ...patch }; return next; });
  };
  const removeRow = (idx: number) => setParsed((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () =>
    setParsed((prev) => [...prev, {
      worker_id: '',
      worker_name: 'Worker ' + (prev.length + 1),
      worker_role: null,
      status: 'Present',
      confidence: 1.0,
    }]);
  const toggleConfirm = (idx: number) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const confirmAll = () => {
    setConfirmed(new Set(parsed.map((_, i) => i)));
    setFlash({ type: 'success', text: 'All rows confirmed for import.' });
  };

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, 'Off Day': 0, Holiday: 0, 'Other Duty': 0,
    };
    parsed.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [parsed]);

  const lowConfidenceCount = useMemo(() => parsed.filter((r) => r.confidence < LOW_CONFIDENCE_THRESHOLD).length, [parsed]);

  const saveRecords = async () => {
    if (!mineId) { setFlash({ type: 'error', text: 'Select a mine first.' }); return; }
    if (!date) { setFlash({ type: 'error', text: 'Select the attendance date.' }); return; }
    const unconfirmed = parsed.filter((r, i) => r.confidence < LOW_CONFIDENCE_THRESHOLD && !confirmed.has(i));
    if (unconfirmed.length > 0) {
      setFlash({ type: 'error', text: `Confirm ${unconfirmed.length} low-confidence row(s) first.` }); return;
    }
    if (parsed.length === 0) { setFlash({ type: 'error', text: 'Nothing to import — run OCR first.' }); return; }

    setSaving(true);
    setFlash(null);
    const actor: AttendanceActor = {
      id: profile?.id ?? 'unknown',
      name: profile?.full_name ?? 'Super Admin',
      role: (role ?? 'super_admin') as 'super_admin',
    };
    const rows = parsed.map((r) => {
      const emp = r.employee ?? null;
      return {
        mine_id: mineId,
        mine_name: mineName || mineId,
        worker_id: emp?.employee_id ?? (r.worker_id || `ocr_${r.worker_name.replace(/\s+/g, '_')}`),
        worker_name: emp?.full_name ?? r.worker_name,
        worker_role: emp?.designation ?? r.worker_role,
        work_area: emp?.work_area ?? null,
        department: emp?.department ?? null,
        shift: r.sheet_shift ?? shift,
        status: r.status,
        attendance_date: r.sheet_date ?? date,
        remarks: `OCR import (confidence ${Math.round(r.confidence * 100)}%)`,
      };
    });
    const res = await markAttendance(rows, actor, 'OCR');
    setSaving(false);
    setFlash(res.saved > 0
      ? { type: 'success', text: `Saved ${res.saved} OCR record(s). ${res.skipped} duplicate(s) skipped.` }
      : { type: 'error', text: `No new records saved — ${res.skipped} duplicate(s) already exist for that date/shift.` });
    setLastSaved(rows.map((r) => ({ ...r, id: `saved_${Date.now()}` })));
    setParsed([]);
    setImage(null);
    setOcrText('');
    setConfirmed(new Set());
  };

  const exportPdf = () => {
    if (!lastSaved.length) return;
    downloadAttendancePdf({
      mineName: mineName || 'All',
      date,
      shift,
      rows: lastSaved,
      summary: {
        Present: lastSaved.filter((r) => r.status === 'Present').length,
        Absent: lastSaved.filter((r) => r.status === 'Absent').length,
        'On Leave': lastSaved.filter((r) => r.status === 'On Leave').length,
        'Half Day': lastSaved.filter((r) => r.status === 'Half Day').length,
        'Off Day': lastSaved.filter((r) => r.status === 'Off Day').length,
        Holiday: lastSaved.filter((r) => r.status === 'Holiday').length,
        'Other Duty': lastSaved.filter((r) => r.status === 'Other Duty').length,
      },
    });
  };
const accept = useMemo(() => '.jpg,.jpeg,.png,.pdf,.gif,.bmp,.tiff', []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-copper-light" /> OCR Attendance Import
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            Upload a scanned attendance sheet — OCR extracts entries, then review and import them.
          </p>
        </div>
      </div>

      {flash && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${flash.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
          {flash.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {flash.text}
        </div>
      )}

      {/* Config row: mine / date / shift + upload button */}
      <Card title="Configuration" subtitle="Set the mine, date, and shift for the attendance sheet being imported" icon={<FileText className="w-4 h-4 text-copper-light" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1.5">Mine *</label>
            <select value={mineId} onChange={(e) => setMineId(e.target.value)}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2.5 text-sm text-warm-pale focus:outline-none focus:border-copper/60">
              <option value="">Select mine</option>
              {mines.map((m) => <option key={m.id} value={m.id}>{m.mine_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1.5">Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || date)}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2.5 text-sm text-warm-pale focus:outline-none focus:border-copper/60 [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1.5">Shift *</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as AttendanceShift)}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2.5 text-sm text-warm-pale focus:outline-none focus:border-copper/60">
              {ATTENDANCE_SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${image ? 'border-copper/60 bg-copper/5' : 'border-carbon-600 hover:border-copper/40 hover:bg-carbon-850/50'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {image ? (
            <>
              {/\.(png|jpe?g|gif|bmp|tiff)$/i.test(image.name) ? (
                <img src={image.url} alt="uploaded" className="max-h-48 mx-auto rounded-lg border border-carbon-600 shadow-panel" />
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-copper-light">
                  <FileText className="w-5 h-5" /> {image.name}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <UploadCloud className="w-8 h-8 mx-auto text-warm-slate" />
              <div className="text-sm text-warm-slate">Drop a scanned attendance sheet (JPG, PNG, PDF) here, or click to browse.</div>
            </div>
          )}
        </div>
      </Card>
{/* OCR Progress bar */}
      {ocrProgress && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-warm-slate">
            <ScanLine className="w-3.5 h-3.5 animate-pulse text-copper-light" />
            {ocrProgress.status} ({Math.round(ocrProgress.progress * 100)}%)
          </div>
          <div className="w-full h-2 rounded-full bg-carbon-800 overflow-hidden">
            <div className="h-full bg-copper transition-all duration-300" style={{ width: `${ocrProgress.progress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Action row */}
      {image && !ocrProgress && parsed.length === 0 && (
        <div className="flex justify-center">
          <Button onClick={runOcr} className="flex items-center gap-2 px-6 py-2.5">
            <ScanLine className="w-4 h-4" /> Run OCR
          </Button>
        </div>
      )}

      {/* Summary row + action buttons (shown when parsed) */}
      {parsed.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {ATTENDANCE_STATUSES.map((s) => (
              <div key={s} className="rounded-lg bg-carbon-800/70 border border-carbon-700/60 px-2 py-2 text-center">
                <div className="text-lg font-extrabold font-mono text-warm-pale">{summary[s]}</div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-warm-slate mt-0.5">{s}</div>
              </div>
            ))}
            <div className="rounded-lg bg-carbon-800/70 border border-carbon-700/60 px-2 py-2 text-center">
              <div className="text-lg font-extrabold font-mono text-copper-light">{parsed.length}</div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-warm-slate mt-0.5">Total</div>
            </div>
            <div className="rounded-lg bg-carbon-800/70 border border-carbon-700/60 px-2 py-2 text-center">
              <div className={`text-lg font-extrabold font-mono ${lowConfidenceCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{lowConfidenceCount}</div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-warm-slate mt-0.5">Low Conf.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addRow} variant="secondary"><PencilLine className="w-3.5 h-3.5" /> Add row</Button>
            <Button onClick={confirmAll} variant="secondary"><ShieldCheck className="w-3.5 h-3.5" /> Confirm all</Button>
            <Button loading={saving} onClick={saveRecords} className="flex-1 sm:flex-none"><Save className="w-3.5 h-3.5" /> Import to register</Button>
            {lastSaved.length > 0 && (
              <Button onClick={exportPdf} variant="secondary"><Download className="w-3.5 h-3.5" /> Export PDF</Button>
            )}
          </div>
        </>
      )}
{/* Review & Verify table */}
      {parsed.length > 0 && (
        <Card
          title="Review & Verify"
          subtitle={`${confirmed.size} of ${parsed.length} confirmed. ${lowConfidenceCount} low-confidence row(s) require manual review.`}
          icon={<ShieldCheck className="w-4 h-4 text-copper-light" />}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-center px-3 py-2.5 w-10"><input type="checkbox" checked={confirmed.size === parsed.length && parsed.length > 0} onChange={() => confirmed.size === parsed.length ? setConfirmed(new Set()) : confirmAll()} className="accent-copper" /></th>
                  <th className="text-left px-3 py-2.5">Employee ID</th>
                  <th className="text-left px-3 py-2.5">Name</th>
                  <th className="text-left px-3 py-2.5">Date</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Confidence</th>
                  <th className="text-left px-3 py-2.5">Employee</th>
                  <th className="text-center px-3 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, idx) => {
                  const isLow = r.confidence < LOW_CONFIDENCE_THRESHOLD;
                  const isConfirmed = confirmed.has(idx);
                  return (
                    <tr key={idx} className={`border-b border-carbon-700/40 ${isLow ? 'bg-rose-500/5' : isConfirmed ? 'bg-emerald-500/5' : 'hover:bg-carbon-850/60'}`}>
                      <td className="px-3 py-2.5 text-center">
                        <input type="checkbox" checked={isConfirmed} onChange={() => toggleConfirm(idx)} className="accent-copper" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input value={r.worker_id} onChange={(e) => updateRow(idx, { worker_id: e.target.value })}
                          placeholder="ID" className="w-full bg-transparent border border-carbon-700 rounded px-2 py-1 text-warm-pale focus:outline-none focus:border-copper/60 font-mono text-[11px]" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input value={r.worker_name} onChange={(e) => updateRow(idx, { worker_name: e.target.value })}
                          className="w-full bg-transparent border border-carbon-700 rounded px-2 py-1 text-warm-pale focus:outline-none focus:border-copper/60" />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">{r.sheet_date ?? date}</td>
                      <td className="px-3 py-2.5">
                        <select value={r.status} onChange={(e) => updateRow(idx, { status: e.target.value as AttendanceStatus })}
                          className="bg-transparent border border-carbon-700 rounded px-2 py-1 text-warm-pale focus:outline-none focus:border-copper/60 text-[11px]">
                          {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isLow ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'}`}>
                          {Math.round(r.confidence * 100)}%
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px]">
                        {r.employee
                          ? <span className="text-emerald-400">{r.employee.full_name} ({r.employee.employee_id})</span>
                          : <span className="text-warm-slate/50">No match</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => removeRow(idx)} className="p-1.5 rounded hover:bg-rose-500/10 text-warm-slate hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!image && parsed.length === 0 && !ocrProgress && (
        <EmptyState icon={<ScanLine className="w-8 h-8" />} title="No attendance sheet uploaded"
          subtitle="Upload a JPG, PNG or PDF of an existing paper attendance sheet. The OCR engine will extract employee details and attendance status." />
      )}
    </div>
  );
};

export default OcrAttendanceView;