// ────────────────────────────────────────────────────────────────
// Complaint PDF report generator — professional compliance/audit
// documents (jsPDF). Replaces the old CSV export of the Reports &
// Export view: org header, category/period meta, summary strip,
// one row per complaint and paginated table with page numbers.
// ────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import { Complaint } from './types';
import { formatDate } from './analytics';

// Standard fonts cannot render non-ASCII glyphs — strip them.
const sanitize = (v: unknown) =>
  String(v ?? '').replace(/[^\x20-\x7E]/g, ' ').trim().slice(0, 120);

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;

const PAGE_W = 842; // A4 landscape (pt)
const PAGE_H = 595;
const MARGIN = 30;

const OPEN_STATUSES = [
  'Submitted', 'Under Review', 'Assigned', 'Inspection Required',
  'Action In Progress', 'Escalated',
];

type RGB = [number, number, number];
function severityColor(severity: string): RGB {
  switch (severity) {
    case 'Critical': return [225, 80, 90];
    case 'High': return [245, 165, 90];
    case 'Medium': return [245, 205, 140];
    default: return [180, 220, 180];
  }
}

export interface ComplaintReportOptions {
  orgName?: string;
  mineName?: string | null;
  reportTitle: string;
  category?: string | null;
  filtersNote?: string;
  generatedBy?: string;
}

/** Builds a paginated landscape-A4 PDF table of complaints (jsPDF). */
export function generateComplaintsReportPdf(
  options: ComplaintReportOptions,
  complaints: Complaint[],
): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // ── Org header ────────────────────────────────────────────────
  doc.setFillColor(32, 24, 22);
  doc.rect(0, 0, PAGE_W, 64, 'F');
  doc.setFillColor(158, 88, 57);
  doc.rect(0, 64, PAGE_W, 3, 'F');
  doc.setTextColor(240, 222, 190);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitize(options.orgName || 'Coal Mine Compliance System'), MARGIN, 26);
  doc.setFontSize(12);
  doc.setTextColor(245, 205, 160);
  doc.text(sanitize(options.reportTitle), MARGIN, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(210, 194, 174);
  const meta =
    `Mine: ${sanitize(options.mineName) || 'ALL'}` +
    (options.category && options.category !== 'All' ? `  |  Category: ${sanitize(options.category)}` : '') +
    (options.filtersNote ? `  |  ${sanitize(options.filtersNote)}` : '');
  doc.text(meta, MARGIN, 54);
  const generated = `Generated: ${sanitize(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}  |  By: ${sanitize(options.generatedBy) || 'System'}`;
  doc.setTextColor(210, 194, 174);
  doc.text(generated, PAGE_W - MARGIN, 22, { align: 'right' });

  // ── Summary strip ─────────────────────────────────────────────
  const total = complaints.length;
  const open = complaints.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const verified = complaints.filter((c) => c.status === 'Verified').length;
  const escalated = complaints.filter((c) => c.status === 'Escalated').length;
  const critical = complaints.filter((c) => c.severity === 'Critical').length;
  const high = complaints.filter((c) => c.severity === 'High').length;
  doc.setFontSize(8.5);
  doc.setTextColor(220, 208, 190);
  doc.text(
    `Total: ${total}  |  Open: ${open}  |  Verified: ${verified}  |  Escalated: ${escalated}  |  Critical: ${critical}  |  High: ${high}`,
    MARGIN,
    76,
  );

  // ── Table ─────────────────────────────────────────────────────
  const colW = [24, 86, 140, 80, 62, 78, 96, 74, 72]; // sum 712 ≤ usable 782
  const header = ['#', 'Complaint #', 'Title', 'Category', 'Severity', 'Status', 'Reported By', 'Reported At', 'Last Updated'];
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

  let y = 92;
  drawHeader(y);
  y += rowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  complaints.forEach((c, i) => {
    if (y > PAGE_H - 40) { doc.addPage('a4', 'landscape'); y = 70; drawHeader(y); y += rowH; }
    if (i % 2 === 1) { doc.setFillColor(28, 24, 22); doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, rowH, 'F'); }

    const title = truncate(sanitize(c.title), 34);
    const cells = [
      String(i + 1),
      sanitize(c.complaint_number),
      title,
      sanitize(c.category),
      sanitize(c.severity),
      sanitize(c.status),
      sanitize(c.reported_by_name || ''),
      sanitize(formatDate(c.reported_at)),
      sanitize(formatDate(c.updated_at)),
    ];
    let cx = MARGIN;
    cells.forEach((cell, ci) => {
      if (ci === 4) {
        const [r, g, b] = severityColor(cell);
        doc.setTextColor(r, g, b);
      } else {
        doc.setTextColor(232, 226, 214);
      }
      doc.text(cell, cx + 3, y + rowH - 6);
      cx += colW[ci];
    });
    y += rowH;
  });

  // ── Footer page numbers ───────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 150, 140);
    doc.text(`Page ${p} of ${pages}`, PAGE_W / 2, PAGE_H - 14, { align: 'center' });
  }

  return doc.output('blob');
}

/** Triggers a browser download for a generated PDF blob. */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}