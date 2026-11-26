import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractText } from '../file-reader';

const E9 = String.fromCharCode(0xe9);
const DASH = String.fromCharCode(0x2014);
const BULL = String.fromCharCode(0x2022);
const FFFD = String.fromCharCode(0xfffd);
const SENT = `B${E9}zier Curves ${DASH} stealth engine ${BULL} anti-bot`;

async function pdfWithSentinel(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage().drawText(SENT, { x: 40, y: 700, size: 12, font });
  return Buffer.from(await doc.save());
}

describe('extractText', () => {
  it('extracts PDF text and keeps non-ASCII glyphs intact', async () => {
    const text = await extractText(await pdfWithSentinel(), 'job-description.pdf');
    expect(text).toContain(`B${E9}zier`);
    expect(text).toContain(DASH);
    expect(text).toContain(BULL);
    expect(text).not.toContain(FFFD);
  });

  it('does not leak pdf-parse page separators into the returned text', async () => {
    const text = await extractText(await pdfWithSentinel(), 'job-description.pdf');
    expect(text).not.toMatch(/^-- \d+ of \d+ --$/m);
    expect(text.trim().startsWith(`B${E9}zier`)).toBe(true);
  });

  it('reads markdown as utf-8', async () => {
    const text = await extractText(Buffer.from(`# ${SENT}\n`, 'utf-8'), 'job.md');
    expect(text).toContain(SENT);
  });

  it('rejects an unsupported extension', async () => {
    await expect(extractText(Buffer.from('x'), 'job.rtf')).rejects.toThrow(/Unsupported file format/);
  });
});
