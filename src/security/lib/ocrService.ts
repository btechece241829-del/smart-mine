// ────────────────────────────────────────────────────────────────
// OCR Service — Tesseract.js client-side OCR for attendance photos
//
// Extracts text from an uploaded image (scanned attendance sheet),
// parses it into structured attendance rows, and generates a PDF
// report. Runs entirely in the browser (no API key needed).
// ────────────────────────────────────────────────────────────────
import Tesseract from 'tesseract.js';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { AttendanceRecord, AttendanceShift, AttendanceStatus } from './types';
import { Profile } from './types';

// PDF.js worker is bundled by Vite from the package exports.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// ── OCR extraction ────────────────────────────────────────────

export interface OcrProgress {
  status: string;
  progress: number; // 0–1
}

/**
 * Run Tesseract OCR on a File/Blob and return the extracted text.
 * `onProgress` fires with 0–1 progress updates while the engine works.
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress({ status: m.status ?? 'Processing...', progress: m.progress });
      }
    },
  });
  return result.data.text;
}

/**
 * Extract text from an uploaded attendance-sheet file.
 * Supports raster images (JPG/PNG) via Tesseract and PDF pages via
 * pdfjs-dist (each page is rendered then OCR'd). Progress is reported
 * through the onProgress callback.
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const type = file.type.toLowerCase();
  if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let all = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.({ status: `Rendering PDF page ${i} / ${pdf.numPages}…`, progress: (i - 1) / pdf.numPages });
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      onProgress?.({ status: `OCR page ${i} / ${pdf.numPages}…`, progress: i / pdf.numPages });
      const pageBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const text = await extractTextFromImage(
        new File([pageBlob], `page_${i}.png`, { type: 'image/png' }),
        (p) => onProgress?.({ status: p.status, progress: ((i - 1) + p.progress) / pdf.numPages }),
      );
      all += text + '\n';
    }
    return all;
  }
  return extractTextFromImage(file, onProgress);
}

// ── Text → attendance rows parser ─────────────────────────────

const STATUS_KEY_MAP: Record<string, AttendanceStatus> = {
  'present': 'Present', 'p': 'Present', 'yes': 'Present',
  'y': 'Present', '1': 'Present',
  'absent': 'Absent', 'a': 'Absent', 'no': 'Absent',
  'n': 'Absent', '0': 'Absent',
  'on leave': 'On Leave', 'on-leave': 'On Leave',
  'leave': 'On Leave', 'l': 'On Leave', 'ol': 'On Leave',
  'ml': 'On Leave', 'el': 'On Leave', 'cl': 'On Leave', 'pl': 'On Leave',
  'half day': 'Half Day', 'half-day': 'Half Day', 'half': 'Half Day', 'hd': 'Half Day',
  'off day': 'Off Day', 'off-day': 'Off Day', 'off': 'Off Day', 'od': 'Off Day',
  'weekly off': 'Off Day', 'wo': 'Off Day',
  'holiday': 'Holiday', 'hol': 'Holiday', 'h': 'Holiday',
  'other duty': 'Other Duty', 'other-duty': 'Other Duty', 'odt': 'Other Duty',
  'duty': 'Other Duty', 'outside': 'Other Duty', 'deputation': 'Other Duty',
};

function stripStatusToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
}

function isStrictStatus(raw: string): boolean {
  return stripStatusToken(raw) in STATUS_KEY_MAP;
}

function normaliseStatus(raw: string): AttendanceStatus {
  return STATUS_KEY_MAP[stripStatusToken(raw)] ?? 'Present';
}

export interface ParsedAttendanceRow {
  worker_id: string;
  worker_name: string;
  worker_role: string | null;
  status: AttendanceStatus;
  /** OCR confidence 0–1 for the whole row. High-confidence ≥ 0.65. */
  confidence: number;
  /** Fields heuristically pulled from the sheet header (when present). */
  sheet_date?: string | null;
  sheet_shift?: AttendanceShift | null;
  /** Matched employee record from the master (when one is found). */
  employee?: Profile | null;
}

/** Confidence threshold under which a row MUST be reviewed manually. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Heuristic confidence for a parsed row — stronger status token + clean id ⇒ higher. */
function rowConfidence(statusRaw: string, workerId: string, workerName: string): number {
  let conf = 0.5;
  const status = stripStatusToken(statusRaw);
  if (STATUS_KEY_MAP[status]) conf += 0.2;                      // recognised status token
  if (/^[A-Z]{2,}[-\/]?\d/i.test(workerId)) conf += 0.15;       // id looks like EMP-1234
  if (/^[A-Za-z]{3,}/.test(workerName)) conf += 0.1;            // plausible name
  if (statusRaw.length >= 4) conf += 0.05;                      // long token = more signal
  return Math.min(conf, 0.95);
}

/** Match an OCR row against the employee master by id then by name. */
export function matchEmployee(row: ParsedAttendanceRow, employees: Profile[]): Profile | null {
  if (!employees.length) return null;
  const norm = (s: string) => s.trim().toUpperCase();
  const byId = row.worker_id ? employees.find((e) => norm(e.employee_id) === norm(row.worker_id)) : undefined;
  if (byId) return byId;
  const nameNeedle = norm(row.worker_name).replace(/\s+/g, ' ');
  // longest common-substring style check: employee full name token match
  const byName = employees.find((e) => {
    const em = norm(e.full_name).replace(/\s+/g, ' ');
    return em.includes(nameNeedle) || nameNeedle.includes(em);
  });
  return byName ?? null;
}

/** First token only counts as a worker id if it clearly looks like one. */
function looksLikeWorkerId(token: string): boolean {
  return (
    /^[A-Z]{2,}[-\/]?\d/.test(token) ||          // EMP-1001, TN2025, TECH/008
    /^[A-Z]{1,2}\d{3,}$/.test(token) ||           // W101, A1002
    /^\d{3,}[A-Z]*$/.test(token)                  // 12345
  );
}

/** Split a worker-name string into (id, name) when the first token is an id. */
function splitIdName(namePart: string): { worker_id: string; worker_name: string } {
  const m = namePart.match(/^(\S+)(?:\s+)(.+)$/);
  if (m && looksLikeWorkerId(m[1])) {
    return { worker_id: m[1], worker_name: m[2] };
  }
  return { worker_id: '', worker_name: namePart };
}

/**
 * Heuristic parser for OCR'd attendance sheet text.
 * Handles pipe / tab / multi-space / single-space delimiters and common
 * OCR artefacts. Header lines are only skipped in the first few lines, so
 * rows carrying Present/Absent statuses are never mistaken for headers.
 */
export function parseAttendanceText(rawText: string): ParsedAttendanceRow[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedAttendanceRow[] = [];

  // Only the top of the sheet contains a title / column headers.
  const isHeaderLine = (l: string) =>
    /^serial|^#|^s\.?no|^sln|^sl\.?no|^employee|^worker|^name|^mine|^date|^shift|register|total|^page/i.test(l);

  const pushRow = (namePart: string, statusRaw: string) => {
    const { worker_id, worker_name } = splitIdName(namePart);
    rows.push({
      worker_id: worker_id || `ocr_${Date.now()}_${rows.length}`,
      worker_name: worker_name || `Worker ${rows.length + 1}`,
      worker_role: null,
      status: normaliseStatus(statusRaw),
      confidence: rowConfidence(statusRaw, worker_id, worker_name),
    });
  };

  // Try to pull the sheet date & shift from the header region (first lines).
  let sheetDate: string | null = null;
  let sheetShift: AttendanceShift | null = null;
  for (const line of lines.slice(0, 8)) {
    const dateMatch = line.match(/(?:date|dt)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i)
      || line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateMatch) {
      const raw = dateMatch[0].replace(/^(date|dt)\s*/i, '').trim();
      sheetDate = normaliseDateToken(raw) ?? sheetDate;
    }
    const shiftMatch = line.match(/(day|night|general)\s*shift/i);
    if (shiftMatch) {
      const s = shiftMatch[1].toLowerCase();
      sheetShift = s === 'night' ? 'Night' : s === 'general' ? 'General' : 'Day';
    }
  }

  for (const [idx, line] of lines.entries()) {
    if (idx < 5 && isHeaderLine(line)) continue;

    const columnar = line.split(/[\t|;]{1,}|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    const serialFirst = columnar.length > 0 && /^\d{1,4}$/.test(columnar[0]);
    const startIdx = serialFirst ? 1 : 0;
    const meaningful = columnar.slice(startIdx);

    if (meaningful.length >= 2) {
      const statusRaw = meaningful[meaningful.length - 1];
      if (!isStrictStatus(statusRaw)) continue;
      pushRow(meaningful.slice(0, meaningful.length - 1).join(' '), statusRaw);
      continue;
    }

    // Columnar split failed (single-space separated OCR text). Fall back to
    // a per-token parse where the LAST token must be a clear status marker.
    const tokens = line.split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      const lastRaw = tokens[tokens.length - 1];
      if (!isStrictStatus(lastRaw)) continue;
      const tStart = /^\d{1,4}$/.test(tokens[0]) ? 1 : 0;
      const nameTokens = tokens.slice(tStart, tokens.length - 1);
      if (nameTokens.length === 0) continue;
      pushRow(nameTokens.join(' '), lastRaw);
    }
  }

  if (sheetDate || sheetShift) {
    return rows.map((r) => ({ ...r, sheet_date: sheetDate, sheet_shift: sheetShift }));
  }
  return rows;
}

/** Best-effort normalisation of OCR date tokens (dd/mm/yy, dd-mm-yyyy, …) to YYYY-MM-DD. */
function normaliseDateToken(raw: string): string | null {
  const t = raw.trim().replace(/[./]/g, '-');
  const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (!m) return null;
  let [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  if (!(day >= 1 && day <= 31) || !(month >= 1 && month <= 12)) return null;
  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── PDF report generation ─────────────────────────────────────

export interface OcrReportOptions {
  mineName: string;
  date: string;
  shift: AttendanceShift;
  rows: Array<Partial<AttendanceRecord>>;
  summary?: Partial<Record<AttendanceStatus, number>>;
}

const sanitize = (v: unknown) =>
  String(v ?? '').replace(/[^\x20-\x7E]/g, ' ').trim().slice(0, 60);

export function generateAttendancePdf(options: OcrReportOptions): Blob {
  const { mineName, date, shift, rows } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const x0 = 30;
  const colW = [22, 64, 100, 80, 122, 92, 42, 50, 116];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const headerBg: [number, number, number] = [40, 34, 32];
  const rowH = 18;
  const header = ['#', 'Date', 'Mine', 'Worker ID', 'Worker Name', 'Designation', 'Shift', 'Status', 'Marked By'];

  const drawHeader = (y: number) => {
    doc.setFillColor(...headerBg);
    doc.rect(x0, y, pageW - 2 * x0, rowH, 'F');
    doc.setTextColor(240, 222, 200);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let cx = x0;
    header.forEach((h, i) => { doc.text(h, cx + 4, y + rowH - 6); cx += colW[i]; });
  };

  doc.setFillColor(32, 24, 22);
  doc.rect(0, 0, pageW, 60, 'F');
  doc.setTextColor(240, 215, 160);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('OCR-Extracted Attendance Report', 30, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(214, 198, 176);
  doc.text(
    `Mine: ${mineName || 'ALL'}  |  Date: ${date || 'N/A'}  |  Shift: ${shift}  |  Records: ${rows.length}  |  Source: OCR extraction`,
    30, 42,
  );

  let y = 76;
  drawHeader(y);
  y += rowH;
  doc.setFontSize(7.5);
  rows.forEach((r, i) => {
    if (y > pageH - 46) { doc.addPage('a4', 'landscape'); y = 60; drawHeader(y); y += rowH; }
    if (i % 2 === 1) { doc.setFillColor(28, 24, 22); doc.rect(x0, y, pageW - 2 * x0, rowH, 'F'); }
    doc.setTextColor(232, 226, 214);
    doc.setFont('helvetica', 'normal');
    const cells = [String(i + 1), sanitize(r.attendance_date), sanitize(r.mine_name), sanitize(r.worker_id),
      sanitize(r.worker_name), sanitize(r.worker_role), sanitize(r.shift), sanitize(r.status), sanitize(r.marked_by_name)];
    let cx = x0;
    cells.forEach((c, ci) => { doc.text(c, cx + 4, y + rowH - 6); cx += colW[ci]; });
    y += rowH;
  });

  const s = options.summary ?? {};
  const present = s.Present ?? rows.filter((r) => r.status === 'Present').length;
  const absent = s.Absent ?? rows.filter((r) => r.status === 'Absent').length;
  const onLeave = s['On Leave'] ?? rows.filter((r) => r.status === 'On Leave').length;
  const halfDay = s['Half Day'] ?? 0;
  const offDay = s['Off Day'] ?? 0;
  const holiday = s.Holiday ?? 0;
  const otherDuty = s['Other Duty'] ?? 0;
  y += 12;
  doc.setFontSize(8);
  doc.setTextColor(214, 198, 176);
  doc.text(`Summary:  Present: ${present}  |  Absent: ${absent}  |  On Leave: ${onLeave}  |  Half Day: ${halfDay}  |  Off Day: ${offDay}  |  Holiday: ${holiday}  |  Other Duty: ${otherDuty}  |  Total: ${rows.length}`, 30, y);

  return doc.output('blob');
}

export function downloadAttendancePdf(options: OcrReportOptions): void {
  const blob = generateAttendancePdf(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr_attendance_${options.mineName || 'all'}_${options.date || 'nodate'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
