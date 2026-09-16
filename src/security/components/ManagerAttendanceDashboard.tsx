// ────────────────────────────────────────────────────────────────
// ManagerAttendanceDashboard — Mine Manager attendance review.
// Filters by date/shift/department/work-area/search, shows dashboard
// statistics (Present/Absent/Leave/Half Day counts + attendance %),
// reviews records submitted by Overmen and approves / rejects /
// requests correction. Subscribe to real-time updates so newly
// submitted rolls appear without a refresh.
// ────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle2, ClipboardCheck, Filter, RefreshCw, Search, ShieldCheck, XCircle, Undo2, UserCheck,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Card, Button, Spinner, EmptyState } from './ui/primitives';
import { Modal, TextInput, Select, TextArea } from './ui/inputs';
import { AttendanceRecord, AttendanceShift, UserRole } from '../lib/types';
import {
  fetchMines, fetchRoster, fetchAttendance, approveAttendance, rejectAttendance, requestCorrection,
  attendancePercentage, AttendanceActor, ATTENDANCE_SHIFTS, RosterWorker, subscribeAttendance,
} from '../lib/attendance';
import {
  AttendanceStatusBadge, VerificationBadge, SOURCE_META, SHIFT_META,
} from '../lib/attendanceUi';
import { fetchDepartments } from '../lib/employeeService';
import { AttendanceCalendar } from './AttendanceCalendar';

export const ManagerAttendanceDashboard: React.FC = () => {
  const { profile, role } = useAuth();
  const [mines, setMines] = useState<any[]>([]);
  const [mineId, setMineId] = useState<string>(profile?.mine_id ?? '');
  const [departments, setDepartments] = useState<string[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<string>('');
  const [dept, setDept] = useState<string>('');
  const [workArea, setWorkArea] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<RosterWorker[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<AttendanceRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reworkNote, setReworkNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [liveStatus, setLiveStatus] = useState<'idle' | 'live' | 'error'>('idle');

  const actor: AttendanceActor = {
    id: profile?.id ?? 'unknown',
    name: profile?.full_name ?? 'Manager',
    role: (role ?? 'mine_manager') as UserRole,
  };

  const loadMinesAndMeta = useCallback(async () => {
    const [m, deps] = await Promise.all([fetchMines(), fetchDepartments()]);
    setMines(m);
    setDepartments(deps);
    setMineId((prev) => prev || profile?.mine_id || (m[0]?.id ?? ''));
  }, [profile]);

  const loadRecords = useCallback(async (mId: string) => {
    if (!mId) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    const [recs, ros] = await Promise.all([fetchAttendance({ mineId: mId }), fetchRoster(mId)]);
    setRecords(recs);
    setRoster(ros);
    setLoading(false);
  }, []);

  useEffect(() => { loadMinesAndMeta(); }, [loadMinesAndMeta]);
  useEffect(() => { if (mineId) loadRecords(mineId); }, [mineId, loadRecords]);

  // Real-time subscription: new rolls marked/submitted by Overmen appear
  // without a refresh, keeping the manager review queue live.
  useEffect(() => {
    if (!mineId) return;
    const unsubscribe = subscribeAttendance(
      mineId,
      (rows) => { setRecords(rows); setLiveStatus('live'); },
      () => setLiveStatus('error'),
    );
    return unsubscribe;
  }, [mineId]);

  const pickDate = (iso: string) => {
    setSelectedDate(iso);
    setDate(iso);
  };

  const workAreas = useMemo(
    () => Array.from(new Set(roster.map((r) => r.work_area).filter((w): w is string => !!w))).sort(),
    [roster],
  );

  const filtered = useMemo(() => {
    let rows = records;
    if (date) rows = rows.filter((r) => r.attendance_date === date);
    if (shift) rows = rows.filter((r) => r.shift === shift);
    if (dept) rows = rows.filter((r) => r.department === dept);
    if (workArea) rows = rows.filter((r) => r.work_area === workArea);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.worker_name.toLowerCase().includes(needle) ||
        r.worker_id.toLowerCase().includes(needle));
    }
    return rows;
  }, [records, date, shift, dept, workArea, q]);

  const submittedSet = useMemo(
    () => records.filter((r) => r.verification_status === 'Submitted' || r.verification_status === 'Rework'),
    [records],
  );

  const stats = useMemo(() => {
    const counts = { Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, Holiday: 0, 'Off Day': 0, 'Other Duty': 0 };
    filtered.forEach((r) => { if (r.status in counts) counts[r.status as keyof typeof counts] += 1; });
    return { counts, pct: attendancePercentage(filtered), total: filtered.length };
  }, [filtered]);

  const reviewFor = (r: AttendanceRecord) => {
    setReviewTarget(r);
    setRejectReason('');
    setReworkNote('');
  };

  const approve = async () => {
    if (!reviewTarget) return;
    setSaving(true);
    await approveAttendance(reviewTarget.id, actor);
    setSaving(false);
    setReviewTarget(null);
    setFlash({ type: 'success', text: `Approved attendance for ${reviewTarget.worker_name}.` });
    loadRecords(mineId);
  };

  const reject = async () => {
    if (!reviewTarget) return;
    if (!rejectReason.trim()) { setFlash({ type: 'error', text: 'A rejection reason is required.' }); return; }
    setSaving(true);
    await rejectAttendance(reviewTarget.id, rejectReason.trim(), actor);
    setSaving(false);
    setReviewTarget(null);
    setFlash({ type: 'error', text: `Rejected attendance for ${reviewTarget.worker_name}.` });
    loadRecords(mineId);
  };

  const rework = async () => {
    if (!reviewTarget) return;
    if (!reworkNote.trim()) { setFlash({ type: 'error', text: 'Describe the correction needed.' }); return; }
    setSaving(true);
    await requestCorrection(reviewTarget.id, reworkNote.trim(), actor);
    setSaving(false);
    setReviewTarget(null);
    setFlash({ type: 'success', text: `Correction requested for ${reviewTarget.worker_name}.` });
    loadRecords(mineId);
  };

  const quickApprove = async (r: AttendanceRecord) => {
    const name = r.worker_name;
    await approveAttendance(r.id, actor);
    setFlash({ type: 'success', text: `Approved attendance for ${name}.` });
    loadRecords(mineId);
  };
if (loading && records.length === 0 && roster.length === 0) {
    return <Spinner size="lg" label="Loading manager dashboard..." />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-copper-light" /> Manager Attendance Dashboard
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">Review, approve and correct attendance submitted by Overmen.</p>
        </div>
        <div className="flex items-center gap-2">
          {liveStatus === 'live' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          )}
          {liveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Offline
            </span>
          )}
          <Button variant="secondary" onClick={() => { if (mineId) loadRecords(mineId); }}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
        </div>
      </div>

      {flash && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${flash.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
          {flash.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {flash.text}
        </div>
      )}

      {/* Filters */}
      <Card title="Filters" subtitle="Narrow the register to a specific day / shift / department / area" icon={<Filter className="w-4 h-4 text-copper-light" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Mine</label>
            <Select value={mineId} onChange={(e) => setMineId(e.target.value)}
              options={mines.map((m) => ({ value: m.id, label: m.mine_name }))} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || date)}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60 [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Shift</label>
            <Select value={shift} onChange={(e) => setShift(e.target.value)}
              options={[{ value: '', label: 'All shifts' }, ...ATTENDANCE_SHIFTS.map((s) => ({ value: s, label: `${s} Shift` }))]} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Department</label>
            <Select value={dept} onChange={(e) => setDept(e.target.value)}
              options={[{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d, label: d }))]} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Work Area</label>
            <Select value={workArea} onChange={(e) => setWorkArea(e.target.value)}
              options={[{ value: '', label: 'All areas' }, ...workAreas.map((w) => ({ value: w, label: w }))]} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-warm-slate mb-1">Search</label>
            <div className="flex items-center gap-2 bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-warm-slate" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / ID" className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60" />
            </div>
          </div>
        </div>
      </Card>
{/* Dashboard statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total" value={stats.total} tone="text-warm-pale" />
        <StatCard label="Present" value={stats.counts.Present} tone="text-emerald-400" />
        <StatCard label="Absent" value={stats.counts.Absent} tone="text-rose-400" />
        <StatCard label="On Leave" value={stats.counts['On Leave']} tone="text-amber-400" />
        <StatCard label="Half Day" value={stats.counts['Half Day']} tone="text-sky-400" />
        <StatCard label="Off Day" value={stats.counts['Off Day']} tone="text-violet-400" />
        <StatCard label="Holiday" value={stats.counts.Holiday} tone="text-teal-400" />
        <StatCard label="Attend %" value={`${stats.pct}%`} tone="text-copper-light" />
      </div>

      {/* Attendance calendar (visual indicators, click a day to filter) */}
      <AttendanceCalendar
        records={records}
        mineName={mines.find((m) => m.id === mineId)?.mine_name}
        selectedDate={selectedDate}
        onSelectDate={pickDate}
      />

      {/* Pending review queue */}
      {submittedSet.length > 0 && (
        <Card
          title={`Review Queue (${submittedSet.length})`}
          subtitle="Attendance submitted by Overmen awaiting your decision"
          icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {submittedSet.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-carbon-900 border border-carbon-700/60">
                <div className="min-w-[160px]">
                  <div className="text-sm font-semibold text-warm-pale">{r.worker_name}</div>
                  <div className="font-mono text-[10px] text-warm-slate">{r.worker_id} · {r.attendance_date} · {r.shift}</div>
                </div>
                <AttendanceStatusBadge status={r.status} />
                <VerificationBadge status={r.verification_status} />
                <div className="text-[10px] text-warm-slate flex-1 min-w-[120px]">
                  Marked by {r.marked_by_name} <span className="text-copper-light">·</span> {r.source} · {r.work_area ?? 'no area'}
                </div>
                <Button variant="success" onClick={() => quickApprove(r)} className="!px-2.5 !py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button variant="secondary" onClick={() => reviewFor(r)} className="!px-2.5 !py-1">
                  <ClipboardCheck className="w-3.5 h-3.5" /> Review
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
{/* Register table */}
      <Card
        title="Attendance Register"
        subtitle={`${filtered.length} record(s) shown`}
        icon={<UserCheck className="w-4 h-4 text-copper-light" />}
        padded={false}
      >
        {filtered.length === 0 ? (
          <EmptyState icon={<CalendarDays className="w-8 h-8" />} title="No attendance records"
            subtitle="Records appear once Overmen have marked and submitted a roll for this mine/date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-carbon-700/60 text-warm-slate">
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-left px-4 py-2.5">Designation</th>
                  <th className="text-left px-4 py-2.5">Area</th>
                  <th className="text-left px-4 py-2.5">Shift</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Times</th>
                  <th className="text-left px-4 py-2.5">Verification</th>
                  <th className="text-left px-4 py-2.5">Source</th>
                  <th className="text-center px-4 py-2.5 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-carbon-700/40 hover:bg-carbon-850/60">
                    <td className="px-4 py-2.5 font-mono text-[11px]">{r.attendance_date}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-warm-pale">{r.worker_name}</div>
                      <div className="font-mono text-[10px] text-warm-slate">{r.worker_id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-warm-slate">{r.worker_role ?? '—'}</td>
                    <td className="px-4 py-2.5 text-warm-slate">{r.work_area ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${SHIFT_META[r.shift]}`}>{r.shift}</span>
                    </td>
                    <td className="px-4 py-2.5"><AttendanceStatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-warm-slate">{r.check_in ?? '—'} / {r.check_out ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <VerificationBadge status={r.verification_status} />
                      {r.verified_by_name && <div className="text-[9px] text-warm-slate mt-0.5">by {r.verified_by_name}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${SOURCE_META[r.source]?.badge ?? SOURCE_META.Manual.badge}`}>{r.source}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {(r.verification_status === 'Submitted' || r.verification_status === 'Rework' || r.verification_status === 'Draft') && (
                          <>
                            <button title="Approve" onClick={() => quickApprove(r)} className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                            <button title="Reject / Rework" onClick={() => reviewFor(r)} className="p-1.5 rounded hover:bg-rose-500/10 text-amber-400"><XCircle className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
{/* Review modal */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Review Attendance Record">
        {reviewTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-carbon-900 border border-carbon-700 text-xs">
              <div className="font-semibold text-warm-pale">{reviewTarget.worker_name} <span className="font-mono text-[10px] text-warm-slate">({reviewTarget.worker_id})</span></div>
              <div className="text-warm-slate mt-1">{reviewTarget.attendance_date} · {reviewTarget.shift} shift · {reviewTarget.work_area ?? 'no area'}</div>
              <div className="mt-2 flex items-center gap-2">
                <AttendanceStatusBadge status={reviewTarget.status} />
                <VerificationBadge status={reviewTarget.verification_status} />
              </div>
              {reviewTarget.rejection_reason && (
                <div className="mt-2 text-[11px] text-amber-400">Last decision: {reviewTarget.rejection_reason}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Reject reason</label>
              <TextArea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Check-in time missing; verify against shift register" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Correction request (rework)</label>
              <TextArea rows={2} value={reworkNote} onChange={(e) => setReworkNote(e.target.value)} placeholder="Describe what the Overman must correct" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="success" loading={saving} onClick={approve} className="flex-1">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
              <Button variant="danger" loading={saving} onClick={reject} className="flex-1">
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button variant="secondary" loading={saving} onClick={rework} className="flex-1">
                <Undo2 className="w-4 h-4" /> Request Fix
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; tone: string }> = ({ label, value, tone }) => (
  <div className="rounded-xl bg-carbon-800/70 border border-carbon-700/60 px-3 py-2.5 text-center">
    <div className={`text-lg font-extrabold font-mono ${tone}`}>{value}</div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-warm-slate mt-0.5">{label}</div>
  </div>
);

export default ManagerAttendanceDashboard;