// ────────────────────────────────────────────────────────────────
// Attendance UI helpers — shared badge styles/colors/status metadata
// used across all attendance views so the look is consistent.
// ────────────────────────────────────────────────────────────────
import { AttendanceStatus, AttendanceVerificationStatus, AttendanceShift } from './types';

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; dot: string; badge: string; cell: string }> = {
  Present: {
    label: 'Present',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    cell: 'text-emerald-400',
  },
  Absent: {
    label: 'Absent',
    dot: 'bg-rose-400',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
    cell: 'text-rose-400',
  },
  'On Leave': {
    label: 'On Leave',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    cell: 'text-amber-400',
  },
  'Half Day': {
    label: 'Half Day',
    dot: 'bg-sky-400',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
    cell: 'text-sky-400',
  },
  'Off Day': {
    label: 'Off Day',
    dot: 'bg-violet-400',
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
    cell: 'text-violet-400',
  },
  Holiday: {
    label: 'Holiday',
    dot: 'bg-teal-400',
    badge: 'bg-teal-500/15 text-teal-400 border-teal-500/40',
    cell: 'text-teal-400',
  },
  'Other Duty': {
    label: 'Other Duty',
    dot: 'bg-orange-400',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    cell: 'text-orange-400',
  },
};

export const VERIFICATION_META: Record<AttendanceVerificationStatus, { label: string; badge: string }> = {
  Draft: { label: 'Draft', badge: 'bg-carbon-700/60 text-warm-sand border-carbon-600' },
  Submitted: { label: 'Submitted', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  Verified: { label: 'Verified', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  Rejected: { label: 'Rejected', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/40' },
  Rework: { label: 'Rework', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
};

export const SHIFT_META: Record<AttendanceShift, string> = {
  Day: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40',
  Night: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  General: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
};

export const SOURCE_META = {
  Manual: { label: 'Manual', badge: 'bg-copper/15 text-copper-light border-copper/40' },
  OCR: { label: 'OCR', badge: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40' },
};

/** Rendering color used by the attendance calendar per status. */
export const CALENDAR_STATUS_COLOR: Record<AttendanceStatus, string> = {
  Present: '#10B981',
  Absent: '#EF4444',
  'On Leave': '#F59E0B',
  'Half Day': '#38BDF8',
  'Off Day': '#A78BFA',
  Holiday: '#14B8A6',
  'Other Duty': '#F97316',
};

export const AttendanceStatusBadge: React.FC<{ status: AttendanceStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const meta = ATTENDANCE_STATUS_META[status] ?? ATTENDANCE_STATUS_META.Present;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${meta.badge} ${size === 'md' ? 'px-2.5 py-1 text-xs' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export const VerificationBadge: React.FC<{ status: AttendanceVerificationStatus }> = ({ status }) => {
  const meta = VERIFICATION_META[status] ?? VERIFICATION_META.Draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${meta.badge}`}>
      {meta.label}
    </span>
  );
};