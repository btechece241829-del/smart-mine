// ────────────────────────────────────────────────────────────────
// AttendanceMarkView — Field Officer "Mark Attendance" page.
// Field officers (Mining Mate / Overman / Safety Officer) select a
// mine, date and shift, then mark each worker Present / Absent /
// On Leave. Every mark is written to the PERMANENT attendance register
// (Firestore + offline-first local storage) and locks immediately —
// only a Super Admin can later correct or delete a mark.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck, Lock, Users, CalendarDays, RefreshCw, Plus, CheckCircle2, ShieldCheck, Info, Send,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { Card, Button, Spinner, EmptyState } from './ui/primitives';
import { Modal } from './ui/inputs';
import { AttendanceShift, AttendanceStatus, AttendanceRecord, UserRole } from '../lib/types';
import {
  fetchMines, fetchRoster, fetchAttendance, markAttendance, submitForVerification,
  RosterWorker, ATTENDANCE_SHIFTS, ATTENDANCE_STATUSES,
} from '../lib/attendance';
import { ATTENDANCE_STATUS_META } from '../lib/attendanceUi';

const STATUS_STYLES: Record<AttendanceStatus, string> = Object.fromEntries(
  Object.entries(ATTENDANCE_STATUS_META).map(([k, v]) => [k, v.badge])
) as Record<AttendanceStatus, string>;

const STATUS_DOT: Record<AttendanceStatus, string> = Object.fromEntries(
  Object.entries(ATTENDANCE_STATUS_META).map(([k, v]) => [k, v.dot])
) as Record<AttendanceStatus, string>;

export const AttendanceMarkView: React.FC = () => {
  const { profile, role } = useAuth();

  const [mines, setMines] = useState<any[]>([]);
  const [mineId, setMineId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<AttendanceShift>('Day');

  const [roster, setRoster] = useState<RosterWorker[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const [adHocName, setAdHocName] = useState('');
  const [adHocRole, setAdHocRole] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mineName = mines.find((m) => m.id === mineId)?.mine_name ?? mineId;

  // Load mine list once; default to the officer's assigned mine if set.
  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await fetchMines();
      if (!alive) return;
      setMines(m);
      setMineId((prev) => prev || profile?.mine_id || (m[0]?.id ?? ''));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile]);

  // Load roster + already-marked roll whenever mine / date / shift changes.
  useEffect(() => {
    if (!mineId) { setRoster([]); setRecords([]); return; }
    let alive = true;
    setBusy(true);
    (async () => {
      const [r, recs] = await Promise.all([
        fetchRoster(mineId, (role === 'overman') ? (profile?.id ?? null) : undefined),
        fetchAttendance({ mineId, date, shift }),
      ]);
      if (!alive) return;
      setRoster(r);
      setRecords(recs);
      const defaults: Record<string, AttendanceStatus> = {};
      r.forEach((w) => { defaults[w.worker_id] = 'Present'; });
      setMarks((prev) => ({ ...defaults, ...prev }));
      setBusy(false);
    })();
    return () => { alive = false; };
  }, [mineId, date, shift]);

  const recordByWorker = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r) => { map[r.worker_id] = r; });
    return map;
  }, [records]);

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, 'Off Day': 0, Holiday: 0, 'Other Duty': 0,
    };
    records.forEach((r) => {
      if (r.status in counts) counts[r.status] += 1;
    });
    return counts;
  }, [records]);

  const pendingCount = roster.filter((w) => !recordByWorker[w.worker_id]).length;
  const lockedCount = roster.filter((w) => recordByWorker[w.worker_id]).length;

  // Records on this roll that are still being worked (Draft / Rework) and can be submitted for verification.
  const submittableRecords = useMemo(
    () => records.filter((r) =>
      r.verification_status === 'Draft' || r.verification_status === 'Rework'
    ),
    [records],
  );

  const setStatus = (workerId: string, status: AttendanceStatus) => {
    setMarks((prev) => ({ ...prev, [workerId]: status }));
  };

  const addAdHocWorker = () => {
    const name = adHocName.trim();
    if (!name) return;
    const w: RosterWorker = {
      worker_id: `adhoc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      worker_name: name,
      worker_role: adHocRole.trim() || 'General Worker',
    };
    setRoster((prev) => [...prev, w]);
    setMarks((prev) => ({ ...prev, [w.worker_id]: 'Present' }));
    setAdHocName('');
    setAdHocRole('');
  };

  const saveRoll = async () => {
    if (!mineId || saving) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);

    const rows = roster
      .filter((w) => !recordByWorker[w.worker_id]) // never overwrite a locked mark
      .map((w) => ({
        mine_id: mineId,
        mine_name: mineName,
        worker_id: w.worker_id,
        worker_name: w.worker_name,
        worker_role: w.worker_role,
        shift,
        status: marks[w.worker_id] ?? 'Present',
        attendance_date: date,
        remarks: null,
      }));

    if (rows.length === 0) {
      setError('Every worker on this roll is already marked for that date/shift. Marks are locked — only a Super Admin can change them.');
      setSaving(false);
      return;
    }

    const actor = {
      id: profile?.id ?? 'unknown',
      name: profile?.full_name ?? 'Unknown Field Officer',
      role: (role ?? 'worker') as UserRole,
    };
    const res = await markAttendance(rows, actor);
    setSavedMsg(
      `Saved ${res.saved} mark${res.saved === 1 ? '' : 's'} for ${mineName} · ${date} · ${shift} shift. ` +
      'They are now locked in the permanent register — only a Super Admin can later correct them.'
    );

    const recs = await fetchAttendance({ mineId, date, shift });
    setRecords(recs);
    setSaving(false);
  };

  const openSubmitModal = () => {
    if (submittableRecords.length === 0) {
      setError('There are no draft records on this roll to submit. Save marks first, then submit them for verification.');
      return;
    }
    setSubmitModalOpen(true);
  };

  const confirmSubmit = async () => {
    if (!mineId || submitting || submittableRecords.length === 0) return;
    setSubmitting(true);
    setError(null);
    const actor = {
      id: profile?.id ?? 'unknown',
      name: profile?.full_name ?? 'Unknown Field Officer',
      role: (role ?? 'worker') as UserRole,
    };
    const res = await submitForVerification(submittableRecords.map((r) => r.id), actor);
    const recs = await fetchAttendance({ mineId, date, shift });
    setRecords(recs);
    setSubmitModalOpen(false);
    setSubmitting(false);
    setSavedMsg(
      res.submitted > 0
        ? `Submitted ${res.submitted} record${res.submitted === 1 ? '' : 's'} for verification. The Manager will review them on the Attendance Review page.`
        : 'Nothing to submit — records are already in the review queue or approved.'
    );
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner size="lg" label="Loading attendance sheet..." />
      </div>
    );
  }

  if (mines.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-8 h-8" />}
        title="No mines configured yet"
        subtitle="A Super Admin needs to add mines (or ingest the sample datasets in Data Hub) before attendance can be marked."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-pale flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-copper-light" /> Mark Attendance
          </h1>
          <p className="text-xs text-warm-slate mt-0.5 max-w-2xl">
            Permanent worker attendance register — marks are recorded forever and lock immediately after saving.
            Only a <span className="text-copper-light font-semibold">Super Admin</span> can correct or remove a mark.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { setSavedMsg(null); setError(null); }} className="text-[11px]">
          <RefreshCw className="w-3.5 h-3.5" /> Fresh Sheet
        </Button>
      </div>

      {/* Selector bar */}
      <Card padded={false}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Mine</span>
            <select
              value={mineId}
              onChange={(e) => setMineId(e.target.value)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            >
              {mines.map((m) => (
                <option key={m.id} value={m.id}>{m.mine_name} ({m.id})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Attendance Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || date)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60 [color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Shift</span>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as AttendanceShift)}
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            >
              {ATTENDANCE_SHIFTS.map((s) => <option key={s} value={s}>{s} Shift</option>)}
            </select>
          </label>
        </div>
      </Card>

      {/* Status banners */}
      {savedMsg && (
        <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {savedMsg}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Roll summary */}
      <Card title="Roll Summary" subtitle={`${mineName} · ${date} · ${shift} shift`} icon={<CalendarDays className="w-4 h-4 text-copper-light" />}>
        <div className="flex flex-wrap gap-3">
          {ATTENDANCE_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-900 border border-carbon-700">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
              <span className="text-xs text-warm-slate">{s}</span>
              <span className="font-mono font-bold text-sm text-warm-pale">{summary[s]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-900 border border-carbon-700">
            <Lock className="w-3.5 h-3.5 text-warm-slate" />
            <span className="text-xs text-warm-slate">Locked</span>
            <span className="font-mono font-bold text-sm text-warm-pale">{lockedCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-900 border border-carbon-700">
            <Users className="w-3.5 h-3.5 text-warm-slate" />
            <span className="text-xs text-warm-slate">To mark</span>
            <span className="font-mono font-bold text-sm text-copper-light">{pendingCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-900 border border-sky-500/40">
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs text-warm-slate">Draft to submit</span>
            <span className="font-mono font-bold text-sm text-sky-400">{submittableRecords.length}</span>
          </div>
        </div>
      </Card>

      {/* Marking sheet */}
      <Card
        title="Worker Attendance Sheet"
        subtitle="Tap Present / Absent / On Leave for each worker, then save the whole roll."
        icon={<Users className="w-4 h-4 text-copper-light" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={openSubmitModal}
              disabled={submittableRecords.length === 0 || submitting}
            >
              <Send className="w-4 h-4" /> Submit for Verification ({submittableRecords.length})
            </Button>
            <Button variant="success" onClick={saveRoll} loading={saving} disabled={pendingCount === 0}>
              <ShieldCheck className="w-4 h-4" /> Save Roll ({pendingCount})
            </Button>
          </div>
        }
        padded={false}
      >
        {busy && roster.length === 0 ? (
          <div className="p-8 flex justify-center"><Spinner label="Loading roster..." /></div>
        ) : roster.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No workers rostered at this mine yet"
            subtitle="Add a worker manually below, or have a Super Admin ingest the workers dataset in Data Hub."
          />
        ) : (
          <div className="divide-y divide-carbon-700/60">
            {roster.map((w) => {
              const marked = recordByWorker[w.worker_id];
              const locked = Boolean(marked);
              return (
                <div key={w.worker_id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-semibold text-warm-pale">{w.worker_name}</div>
                    <div className="text-[10px] font-mono text-warm-slate">
                      {w.worker_id} · {w.worker_role || 'Worker'}
                    </div>
                  </div>
                  {locked ? (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${STATUS_STYLES[marked!.status]}`}>
                        <Lock className="w-3 h-3" /> {marked!.status}
                      </span>
                      <span className="text-[10px] text-warm-slate max-w-[220px] truncate" title={`Marked by ${marked!.marked_by_name} — locked permanent register`}>
                        by {marked!.marked_by_name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {ATTENDANCE_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(w.worker_id, s)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                            marks[w.worker_id] === s
                              ? STATUS_STYLES[s]
                              : 'bg-carbon-900 text-warm-slate border-carbon-700 hover:border-copper/50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Ad-hoc worker add */}
        <div className="p-4 border-t border-carbon-700/60 flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-[180px]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Worker not on roster (add manually)</span>
            <input
              value={adHocName}
              onChange={(e) => setAdHocName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAdHocWorker(); } }}
              placeholder="Full name, e.g. Ram Prasad"
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            />
          </label>
          <label className="block w-40">
            <span className="text-[10px] font-mono uppercase tracking-wider text-warm-slate">Designation</span>
            <input
              value={adHocRole}
              onChange={(e) => setAdHocRole(e.target.value)}
              placeholder="e.g. Helper"
              className="mt-1 w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-warm-pale focus:outline-none focus:border-copper/60"
            />
          </label>
          <Button variant="secondary" onClick={addAdHocWorker} disabled={!adHocName.trim()}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </Card>

      {/* Note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-carbon-850/60 border border-carbon-700/50 text-[11px] text-warm-slate">
        <ShieldCheck className="w-4 h-4 text-copper-light shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold text-warm-pale">Why every mark locks:</span> the register is a permanent statutory-style record.
          Field officers cannot change a saved mark, and nothing is ever auto-deleted. If a mark is wrong, the <span className="text-copper-light font-semibold">Super Admin</span>
          can correct it from the Attendance Register — the correction is recorded with the admin's name for the audit trail.
        </span>
      </div>

      {/* Submit-for-verification confirmation modal */}
      <Modal open={submitModalOpen} onClose={() => { if (!submitting) setSubmitModalOpen(false); }} title="Submit Roll for Verification">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-carbon-900 border border-carbon-700 text-xs text-warm-slate">
            You are about to submit <span className="text-sky-400 font-bold font-mono">{submittableRecords.length}</span> draft
            record{submittableRecords.length === 1 ? '' : 's'} for <span className="text-warm-pale font-semibold">Manager verification</span>.
            Once submitted, your Overman/Manager can approve, reject, or request changes. You will not be able to mark these workers again for
            <span className="text-warm-pale font-mono"> {date} · {shift}</span> until the Manager responds.
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {submittableRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-carbon-850/80 border border-carbon-700/60">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-warm-pale truncate">{r.worker_name}</div>
                  <div className="font-mono text-[10px] text-warm-slate truncate">{r.worker_id} · {r.work_area ?? 'no area'}</div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold ${ATTENDANCE_STATUS_META[r.status]?.badge ?? ''}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSubmitModalOpen(false)} disabled={submitting} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={confirmSubmit} loading={submitting} className="flex-1">
              <Send className="w-4 h-4" /> Submit for Verification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceMarkView;