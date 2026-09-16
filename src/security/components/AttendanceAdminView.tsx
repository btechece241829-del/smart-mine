// ────────────────────────────────────────────────────────────────
// AttendanceAdminView — Super Admin "Attendance Register" page.
// Full read-only register + corrections/deletes (Super Admin ONLY,
// each with an audit note), plus one-click PDF / CSV export of the
// filtered register. Mine Managers get a read-only view.
// ────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ClipboardList, Download, FileText, Lock, PenLine, RefreshCw, Search, ShieldAlert, Trash2, X, Users,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Card, Button, Spinner, EmptyState } from './ui/primitives';
import { AttendanceRecord, AttendanceStatus } from '../lib/types';
import {
  fetchMines, fetchAttendance, correctAttendance, deleteAttendance,
  ATTENDANCE_STATUSES, attendanceSummary,
} from '../lib/attendance';
import { ATTENDANCE_STATUS_META } from '../lib/attendanceUi';
import { AttendanceCalendar } from './AttendanceCalendar';

const STATUS_STYLES: Record<AttendanceStatus, string> = Object.fromEntries(
  Object.entries(ATTENDANCE_STATUS_META).map(([k, v]) => [k, v.badge])
) as Record<AttendanceStatus, string>;

const sanitize = (v: any) => String(v ?? '').replace(/[^\x20-\x7E]/g, ' ').trim().slice(0, 60);

export const AttendanceAdminView: React.FC = () => {
  const { profile, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [mines, setMines] = useState<any[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [mineId, setMineId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [correctFor, setCorrectFor] = useState<AttendanceRecord | null>(null);
  const [correctStatus, setCorrectStatus] = useState<AttendanceStatus>('Present');
  const [correctNote, setCorrectNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const pickDate = (iso: string) => {
    setSelectedDate(iso);
    setDate(iso);
  };

  const load = useCallback(async () => {
    const [m, recs] = await Promise.all([fetchMines(), fetchAttendance()]);
    setMines(m);
    setRecords(recs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const minesById = useMemo(() => new Map(mines.map((m) => [m.id, m])), [mines]);

  const filtered = useMemo(() => {
    let rows = records;
    if (mineId) rows = rows.filter((r) => r.mine_id === mineId);
    if (date) rows = rows.filter((r) => r.attendance_date === date);
    if (status) rows = rows.filter((r) => r.status === status);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.worker_name.toLowerCase().includes(needle) ||
        r.worker_id.toLowerCase().includes(needle) ||
        r.mine_name.toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [records, mineId, date, status, q]);

  const summary = useMemo(() => attendanceSummary(filtered), [filtered]);

  const matchesToday = records.filter((r) => r.attendance_date === new Date().toISOString().slice(0, 10)).length;
  const correctedCount = records.filter((r) => r.corrected_by_name).length;

  const openCorrect = (r: AttendanceRecord) => {
    setCorrectFor(r);
    setCorrectStatus(r.status);
    setCorrectNote(r.correction_note ?? '');
  };

  const submitCorrection = async () => {
    if (!correctFor || saving) return;
    setSaving(true);
    await correctAttendance(
      correctFor.id,
      { status: correctStatus, shift: correctFor.shift, remarks: correctNote || null },
      { id: profile?.id ?? 'unknown', name: profile?.full_name ?? 'Super Admin', role: role ?? 'super_admin' },
      correctNote.trim() || 'Status corrected',
    );
    setCorrectFor(null);
    setSaving(false);
    setFlash(`Corrected ${correctFor.worker_name} → ${correctStatus} (correction recorded).`);
    await load();
  };

  const handleDelete = async (r: AttendanceRecord) => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`Permanently delete the attendance mark for ${r.worker_name} (${r.attendance_date}, ${r.shift})? This cannot be undone.`)) return;
    await deleteAttendance(r.id, { id: profile?.id ?? 'unknown', name: profile?.full_name ?? 'Super Admin', role: role ?? 'super_admin' });
    setFlash(`Deleted mark for ${r.worker_name}.`);
    await load();
  };

  const downloadCsv = () => {
    const head = 'Date,Mine,Mine ID,Worker ID,Worker Name,Designation,Shift,Status,Marked By,Corrected By,Correction Note';
    const lines = filtered.map((r) => [
      r.attendance_date, r.mine_name, r.mine_id, r.worker_id, r.worker_name,
      r.worker_role ?? '', r.shift, r.status, r.marked_by_name,
      r.corrected_by_name ?? '', r.correction_note ?? '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_register_${date || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const x0 = 30;
    const colW = [22, 64, 100, 80, 122, 92, 42, 50, 116, 96];
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const headerBg: [number, number, number] = [40, 34, 32];
    const rowH = 18;
    const header = ['#', 'Date', 'Mine', 'Worker ID', 'Worker Name', 'Designation', 'Shift', 'Status', 'Marked By', 'Corrected By'];

    const drawHeader = (y: number) => {
      doc.setFillColor(...headerBg);
      doc.rect(x0, y, pageW - 2 * x0, rowH, 'F');
      doc.setTextColor(240, 222, 200);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let cx = x0;
      header.forEach((h, i) => {
        doc.text(h, cx + 4, y + rowH - 6);
        cx += colW[i];
      });
    };

    doc.setFillColor(32, 24, 22);
    doc.rect(0, 0, pageW, 52, 'F');
    doc.setTextColor(240, 215, 160);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Worker Attendance Register (Permanent Record)', 30, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(214, 198, 176);
    doc.text(
      `Mine: ${mineId ? (minesById.get(mineId)?.mine_name ?? mineId) : 'ALL'}   |   Date: ${date || 'ALL'}   |   Status: ${status || 'ALL'}   |   Records: ${filtered.length}`,
      30, 42,
    );

    let y = 70;
    drawHeader(y);
    y += rowH;
    doc.setFontSize(7.5);
    filtered.forEach((r, i) => {
      if (y > pageH - 46) {
        doc.addPage('a4', 'landscape');
        y = 60;
        drawHeader(y);
        y += rowH;
      }
      if (i % 2 === 1) {
        doc.setFillColor(28, 24, 22);
        doc.rect(x0, y, pageW - 2 * x0, rowH, 'F');
      }
      doc.setTextColor(232, 226, 214);
      doc.setFont('helvetica', 'normal');
      const cells = [
        String(i + 1), r.attendance_date, sanitize(r.mine_name), sanitize(r.worker_id),
        sanitize(r.worker_name), sanitize(r.worker_role), r.shift, r.status,
        sanitize(r.marked_by_name), sanitize(r.corrected_by_name),
      ];
      let cx = x0;
      cells.forEach((c, ci) => {
        doc.text(sanitize(c), cx + 4, y + rowH - 6);
        cx += colW[ci];
      });
      y += rowH;
    });

    doc.setTextColor(160, 150, 138);
    doc.setFontSize(7);
    doc.text(`Generated ${new Date().toLocaleString()} · Coal Mine Compliance & Safety Management`, 30, pageH - 24);
    doc.save(`attendance_register_${date || 'all'}.pdf`);
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner size="lg" label="Loading attendance register..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-copper-light" /> Attendance Register
          </h1>
          <p className="text-xs text-warm-slate mt-0.5 max-w-2xl">
            Permanent worker attendance records marked by field officers. Correct/delete actions are
            <span className="text-copper-light font-semibold"> Super Admin only</span> and are recorded on the audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} className="text-[11px]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="secondary" onClick={downloadCsv} disabled={filtered.length === 0} className="text-[11px]">
            <FileText className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="primary" onClick={downloadPdf} disabled={filtered.length === 0} className="text-[11px]">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Read-only notice for non-super-admins */}
      {!isSuperAdmin && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-300">
          <Lock className="w-4 h-4 shrink-0" />
          Read-only view. Only a <span className="font-semibold">Super Admin</span> can correct or delete permanent attendance marks.
        </div>
      )}

      {/* Flash */}
      {flash && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-300">{flash}</div>
      )}

      {/* KPI chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padded className="!p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Total (filtered)</div>
          <div className="text-xl font-extrabold text-warm-pale font-mono mt-1">{filtered.length}</div>
        </Card>
        <Card padded className="!p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Present</div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">{summary.Present}</div>
        </Card>
        <Card padded className="!p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-400">Absent</div>
          <div className="text-xl font-extrabold text-rose-400 font-mono mt-1">{summary.Absent}</div>
        </Card>
        <Card padded className="!p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">On Leave</div>
          <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">{summary['On Leave']}</div>
        </Card>
      </div>

      {/* Attendance calendar (click a day to filter the register) */}
      <AttendanceCalendar
        records={records}
        selectedDate={selectedDate}
        onSelectDate={pickDate}
      />

      {/* Filters */}
      <Card padded={false}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Mine</span>
            <select
              value={mineId}
              onChange={(e) => setMineId(e.target.value)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            >
              <option value="">All mines</option>
              {mines.map((m) => (
                <option key={m.id} value={m.id}>{m.mine_name} ({m.id})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60 [color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            >
              <option value="">All statuses</option>
              {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Search worker</span>
            <div className="relative mt-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-warm-slate" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or ID..."
                className="w-full bg-carbon-900 border border-carbon-700 rounded-lg pl-8 pr-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
              />
            </div>
          </label>
        </div>
      </Card>

      {/* Register table */}
      <Card padded={false} title="Register" subtitle={`${filtered.length} record(s) · ${matchesToday} marks today · ${correctedCount} corrected`} icon={<Users className="w-4 h-4 text-copper-light" />}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title="No attendance records match"
            subtitle="Field-officer marks will appear here as soon as they save a roll. Try clearing the filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-[10px] font-mono uppercase tracking-wider text-warm-slate">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Mine</th>
                  <th className="px-3 py-2.5">Worker</th>
                  <th className="px-3 py-2.5">Designation</th>
                  <th className="px-3 py-2.5">Shift</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Marked By</th>
                  <th className="px-3 py-2.5">Correction</th>
                  {isSuperAdmin && <th className="px-3 py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-700/40">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-carbon-850/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-warm-pale whitespace-nowrap">{r.attendance_date}</td>
                    <td className="px-3 py-2.5 text-warm-sand">
                      <div>{r.mine_name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{r.mine_id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-warm-pale whitespace-nowrap">{r.worker_name}</div>
                      <div className="text-[10px] font-mono text-warm-slate">{r.worker_id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-warm-slate">{r.worker_role || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-warm-sand">{r.shift}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-warm-slate whitespace-nowrap">{r.marked_by_name}</td>
                    <td className="px-3 py-2.5 text-[10px] text-warm-slate">
                      {r.corrected_by_name ? (
                        <span className="text-amber-300">✎ {r.corrected_by_name}{r.correction_note ? ` — ${r.correction_note}` : ''}</span>
                      ) : '—'}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openCorrect(r)}
                            title="Correct this mark (recorded on audit trail)"
                            className="p-1.5 rounded-lg bg-carbon-850 hover:bg-copper/20 text-warm-sand hover:text-copper-light border border-carbon-700 transition-colors"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            title="Delete this mark permanently"
                            className="p-1.5 rounded-lg bg-carbon-850 hover:bg-rose-500/20 text-warm-slate hover:text-rose-400 border border-carbon-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Correction modal */}
      {correctFor && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-carbon-850 border border-carbon-700 rounded-xl shadow-panel">
            <div className="flex items-center justify-between px-4 py-3 border-b border-carbon-700/60">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-copper-light" />
                <h3 className="text-sm font-bold text-warm-pale">Correct Attendance Mark</h3>
              </div>
              <button onClick={() => setCorrectFor(null)} className="text-warm-slate hover:text-warm-pale">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-lg bg-carbon-900 border border-carbon-700 text-xs text-warm-slate">
                <div className="font-semibold text-warm-pale">{correctFor.worker_name}</div>
                <div className="font-mono text-[10px] mt-0.5">{correctFor.worker_id} · {correctFor.mine_name} · {correctFor.attendance_date} · {correctFor.shift} shift</div>
                <div className="mt-1 text-[11px]">Original mark: <span className="text-copper-light font-semibold">{correctFor.status}</span> by {correctFor.marked_by_name}</div>
              </div>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">New status</span>
                <select
                  value={correctStatus}
                  onChange={(e) => setCorrectStatus(e.target.value as AttendanceStatus)}
                  className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
                >
                  {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Correction note (audit trail)</span>
                <textarea
                  value={correctNote}
                  onChange={(e) => setCorrectNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Rechecked shift register — worker was present. Verified on-site."
                  className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60 resize-none"
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="secondary" onClick={() => setCorrectFor(null)} className="flex-1">Cancel</Button>
                <Button variant="primary" onClick={submitCorrection} loading={saving} className="flex-1">
                  <ShieldAlert className="w-4 h-4" /> Record Correction
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAdminView;