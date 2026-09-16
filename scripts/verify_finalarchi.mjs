// ─────────────────────────────────────────────────────────────
// Verify finalarchi.pdf contents by extracting text per page.
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(readFileSync(new URL('../finalarchi.pdf', import.meta.url)));
const doc = await getDocument({ data }).promise;
console.log('pages:', doc.numPages);

const out = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const t = tc.items.map((i) => i.str).join(' ');
  out.push(`--- PAGE ${p} ---\n${t}`);
}
writeFileSync(new URL('../__pdftext.txt', import.meta.url), out.join('\n'));
console.log('text extracted -> __pdftext.txt');