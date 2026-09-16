// ────────────────────────────────────────────────────────────────
// AttendanceCalendar — reusable month calendar with per-day visual
// indicators drawn from the attendance register. Each day cell shows
// the dominant status mix (colored dots + count) so managers/admins
// can spot absences, leave clusters, or unsubmitted rolls at a glance.
// Clicking a day reports that date to the host view via onSelectDate.
// ────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { AttendanceRecord, AttendanceStatus } from '../lib/types';
import { CALENDAR_STATUS_COLOR, ATTENDANCE_STATUS_META } from '../lib/attendanceUi';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthMatrix(year: number, month: number): (Date | null)[] {
  // Monday-first week grid (weeks is the coal-industry standard).
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export interface AttendanceCalendarProps {
  records: AttendanceRecord[];
  mineName?: string;
  selectedDate?: string;          // YYYY-MM-DD, optional highlight
  onSelectDate?: (date: string) => void;
}

/** Attendance % per day, used by the tooltip. */
function dayStats(dayRecords: AttendanceRecord[]) {
  const total = dayRecords.length;
  const present = dayRecords.filter((r) => r.status === 'Present' || r.status === 'Half Day').length;
  const absents = dayRecords.filter((r) => r.status === 'Absent').length;
  const leave = dayRecords.filter((r) => r.status === 'On Leave').length;
  const pending = dayRecords.filter((r) => r.verification_status !== 'Verified').length;
  return { total, present, absents, leave, pending, pct: total ? Math.round((present / total) * 100) : 100 };
}

/** Helper: count records per status. */
function countByStatus(dayRecs: AttendanceRecord[]): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, 'Off Day': 0, Holiday: 0, 'Other Duty': 0,
  };
  dayRecs.forEach((r) => {
    if (r.status in counts) counts[r.status] += 1;
  });
  return counts;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  records, mineName, selectedDate, onSelectDate,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);

  const recordsByDay = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    records.forEach((r) => {
      (map[r.attendance_date] ??= []).push(r);
    });
    return map;
  }, [records]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long',
  });

  const move = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const resetToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <div className="rounded-xl bg-carbon-800/70 border border-carbon-700/60 shadow-panel overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-carbon-700/60">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-copper-light" />
          <div>
            <h3 className="text-sm font-semibold text-warm-pale">Attendance Calendar</h3>
            {mineName && <p className="text-[11px] text-warm-slate">{mineName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => move(-1)} className="p-1.5 rounded-lg hover:bg-carbon-700 text-warm-slate" title="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={resetToday} className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold text-warm-pale hover:bg-carbon-700 border border-carbon-700">
            {monthLabel}
          </button>
          <button onClick={() => move(1)} className="p-1.5 rounded-lg hover:bg-carbon-700 text-warm-slate" title="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-carbon-700/50">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="px-1 py-1.5 text-center text-[10px] font-mono uppercase tracking-wider text-warm-slate/70">
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="aspect-square bg-carbon-900/40" />;
          const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const isToday = iso === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const isSelected = iso === selectedDate;
          const dayRecs = recordsByDay[iso] ?? [];
          const stats = dayStats(dayRecs);
          const statusCounts = countByStatus(dayRecs);

          return (
            <button
              key={iso}
              onClick={() => onSelectDate?.(iso)}
              title={dayRecs.length
                ? `${stats.total} marked · ${stats.pct}% present · ${stats.absents} absent · ${stats.leave} leave${stats.pending ? ` · ${stats.pending} unverified` : ''}`
                : 'No records'}
              className={[
                'relative aspect-square flex flex-col items-center justify-start gap-0.5 p-1 border-b border-r border-carbon-700/40 transition-colors',
                isSelected
                  ? 'bg-copper/20 border-copper/60'
                  : 'hover:bg-carbon-700/40',
              ].join(' ')}
            >
              <span className={[
                'text-[11px] font-mono font-bold',
                isToday ? 'text-copper-light' : isSelected ? 'text-warm-pale' : dayRecs.length ? 'text-warm-sand' : 'text-warm-slate/50',
              ].join(' ')}>
                {day.getDate()}
              </span>

              {dayRecs.length > 0 && (
                <>
                  {/* Status dots */}
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {(Object.keys(statusCounts) as AttendanceStatus[])
                      .filter((s) => statusCounts[s] > 0)
                      .sort((a, b) => statusCounts[b] - statusCounts[a])
                      .slice(0, 5)
                      .map((s) => (
                        <span
                          key={s}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: CALENDAR_STATUS_COLOR[s] }}
                          title={`${ATTENDANCE_STATUS_META[s].label}: ${statusCounts[s]}`}
                        />
                      ))}
                  </div>
                  {/* Count */}
                  <span className="text-[9px] font-mono text-warm-slate/80">{stats.total}</span>
                  {/* Unverified ring */}
                  {stats.pending > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" title={`${stats.pending} unverified`} />
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-t border-carbon-700/60">
        {(Object.keys(CALENDAR_STATUS_COLOR) as AttendanceStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] font-mono text-warm-slate">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CALENDAR_STATUS_COLOR[s] }} />
            {ATTENDANCE_STATUS_META[s].label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> unverified
        </span>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
