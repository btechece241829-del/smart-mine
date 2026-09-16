// ────────────────────────────────────────────────────────────────
// Attendance PDF report generator — professional compliance/audit
// documents (jsPDF). Covers Daily and Monthly reports with org header,
// report period, filters, employee details, summary, attendance
// percentage, generated-by/at and approval status.
// ────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import { AttendanceRecord, AttendanceShift } from './types';
import { attendancePercentage } from './attendance';

const sanitize = (v: unknown) =>
  String(v ?? '').replace(/[^\x20-\x7E]/g, ' ').trim().slice(0, 60);

export interface AttReportFilters {
  orgName: string;
  mineName: string;
  department?: string | null;
  shift?: AttendanceShift | null;
  workArea?: string | null;
  reportTitle: string;
  periodLabel: string;
  approvedStatus?: string;
}

const PAGE_W = 842;  // A4 landscape (pt)
const PAGE_H = 595;
const MARGIN = 30;

function drawReportHeader(doc: jsPDF, filters: AttReportFilters, generatedBy: string): void {
  doc.setFillColor(32, 24, 22);
  doc.rect(0, 0, PAGE_W, 64, 'F');
  doc.setFillColor(158, 88, 57);
  doc.rect(0, 64, PAGE_W, 3, 'F');
  doc.setTextColor(240, 222, 190);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitize(filters.orgName || 'Coal Mine Compliance System'), MARGIN, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(245, 205, 160);
  doc.text(sanitize(filters.reportTitle), MARGIN, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(210, 194, 174);
  const meta = `Mine: ${sanitize(filters.mineName) || 'ALL'}  |  Period: ${sanitize(filters.periodLabel)}` +
    (filters.department ? `  |  Department: ${sanitize(filters.department)}` : '') +
    (filters.shift ? `  |  Shift: ${sanitize(filters.shift)}` : '') +
    (filters.workArea ? `  |  Work Area: ${sanitize(filters.workArea)}` : '');
  doc.text(meta, MARGIN, 54);
  const right = `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  |  By: ${sanitize(generatedBy)}`;
  doc.setTextColor(210, 194, 174);
  doc.text(right, PAGE_W - MARGIN, 22, { align: 'right' });
  if (filters.approvedStatus) {
    doc.setTextColor(120, 210, 160);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Approval: ${sanitize(filters.approvedStatus)}`, PAGE_W - MARGIN, 38, { align: 'right' });
  }
}
/** Daily attendance report — one row per employee record. */
export function generateDailyReportPdf(
  filters: AttReportFilters,
  rows: AttendanceRecord[],
  generatedBy: string,
): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  drawReportHeader(doc, filters, generatedBy);

  const colW = [26, 80, 128, 96, 66, 44, 60, 64, 88, 110];
  const header = ['#', 'Date', 'Employee ID', 'Employee Name', 'Designation', 'Shift', 'Status', 'Check-in', 'Check-out', 'Marked By'];
  const rowH = 17;
  const drawHeader = (y: number) => {
    doc.setFillColor(40, 34, 32);
    doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, rowH, 'F');
    doc.setTextColor(240, 222, 200);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    let cx = MARGIN;
    header.forEach((h, i) => { doc.text(h, cx + 3, y + rowH - 6); cx += colW[i]; });
  };

  let y = 82;
  drawHeader(y);
  y += rowH;
  doc.setFontSize(7);
  rows.forEach((r, i) => {
    if (y > PAGE_H - 40) { doc.addPage('a4', 'landscape'); y = 70; drawHeader(y); y += rowH; }
    if (i % 2 === 1) { doc.setFillColor(28, 24, 22); doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, rowH, 'F'); }
    doc.setTextColor(232, 226, 214);
    doc.setFont('helvetica', 'normal');
    const cells = [
      String(i + 1), r.attendance_date, sanitize(r.worker_id), sanitize(r.worker_name),
      sanitize(r.worker_role), r.shift, r.status,
      r.check_in ?? '—', r.check_out ?? '—', sanitize(r.marked_by_name),
    ];
    let cx = MARGIN;
    cells.forEach((c, ci) => { doc.text(c, cx + 3, y + rowH - 6); cx += colW[ci]; });
    y += rowH;
  });

  // Summary block
  y += 10;
  const summary = attendanceSummaryImpl(rows);
  doc.setFontSize(8);
  doc.setTextColor(214, 198, 176);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Summary → Present: ${summary.Present} | Absent: ${summary.Absent} | On Leave: ${summary['On Leave']} | ` +
    `Half Day: ${summary['Half Day']} | Off Day: ${summary['Off Day']} | Holiday: ${summary.Holiday} | ` +
    `Other Duty: ${summary['Other Duty']} | Total: ${rows.length}`,
    MARGIN, y,
  );
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(158, 88, 57);
  doc.text(`Attendance Percentage: ${attendancePercentage(rows)}%`, MARGIN, y);

  return doc.output('blob');
}

function attendanceSummaryImpl(rows: AttendanceRecord[]) {
  const s: Record<string, number> = { Present: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0, 'Off Day': 0, Holiday: 0, 'Other Duty': 0 };
  rows.forEach((r) => { if (r.status in s) s[r.status] += 1; });
  return s;
}
/** Monthly report — one row per employee with totals. */
export function generateMonthlyReportPdf(
  filters: AttReportFilters,
  rows: AttendanceRecord[],
  generatedBy: string,
): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFillColor(32, 24, 22);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');
  doc.setFillColor(158, 88, 57);
  doc.rect(0, 64, doc.internal.pageSize.getWidth(), 3, 'F');
  doc.setTextColor(240, 222, 190);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitize(filters.orgName || 'Coal Mine Compliance System'), MARGIN, 26);
  doc.setFontSize(12);
  doc.setTextColor(245, 205, 160);
  doc.text(sanitize(filters.reportTitle), MARGIN, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(210, 194, 174);
  doc.text(
    `Mine: ${sanitize(filters.mineName) || 'ALL'}  |  Period: ${sanitize(filters.periodLabel)}` +
    (filters.department ? `  |  Department: ${sanitize(filters.department)}` : '') +
    (filters.shift ? `  |  Shift: ${sanitize(filters.shift)}` : ''),
    MARGIN, 54,
  );
  doc.text(
    `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  |  By: ${sanitize(generatedBy)}`,
    doc.internal.pageSize.getWidth() - MARGIN, 22, { align: 'right' },
  );

  // Aggregate per employee
  const byWorker = new Map<string, AttendanceRecord[]>();
  rows.forEach((r) => {
    const key = `${r.worker_id}|${r.worker_name}`;
    const arr = byWorker.get(key) ?? [];
    arr.push(r);
    byWorker.set(key, arr);
  });
  const agg = Array.from(byWorker.values()).sort((a, b) => a[0].worker_name.localeCompare(b[0].worker_name));

  const colW = [22, 80, 70, 78, 62, 50, 56, 56, 60];
  const header = ['#', 'Employee ID', 'Name', 'Working Days', 'Present', 'Absent', 'Leave', 'Half Day', '%'];
  const rowH = 17;
  const drawHeader = (y: number) => {
    doc.setFillColor(40, 34, 32);
    doc.rect(MARGIN, y, doc.internal.pageSize.getWidth() - 2 * MARGIN, rowH, 'F');
    doc.setTextColor(240, 222, 200);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    let cx = MARGIN;
    header.forEach((h, i) => { doc.text(h, cx + 3, y + rowH - 6); cx += colW[i]; });
  };

  let y = 82;
  drawHeader(y);
  y += rowH;
  doc.setFontSize(7);
  agg.forEach((recs, i) => {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage('a4', 'portrait'); y = 70; drawHeader(y); y += rowH; }
    if (i % 2 === 1) { doc.setFillColor(28, 24, 22); doc.rect(MARGIN, y, doc.internal.pageSize.getWidth() - 2 * MARGIN, rowH, 'F'); }
    const s = attendanceSummaryImpl(recs);
    const total = recs.length;
    const pct = attendancePercentage(recs);
    doc.setTextColor(232, 226, 214);
    doc.setFont('helvetica', 'normal');
    const cells = [
      String(i + 1), sanitize(recs[0].worker_id), sanitize(recs[0].worker_name), String(total),
      String(s.Present), String(s.Absent), String(s['On Leave']), String(s['Half Day']), `${pct}%`,
    ];
    let cx = MARGIN;
    cells.forEach((c, ci) => { doc.text(c, cx + 3, y + rowH - 6); cx += colW[ci]; });
    y += rowH;
  });

  return doc.output('blob');
}