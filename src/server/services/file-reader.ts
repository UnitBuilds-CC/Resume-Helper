import { extname } from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        // pdf-parse 2.x interleaves its own page separators; they would land in the stored
        // posting text and then in every AI prompt that reads it.
        return result.text.replace(/^\s*-- \d+ of \d+ --\s*$/gm, '').trim();
      } finally {
        await parser.destroy();
      }
    }
    case '.docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case '.txt':
    case '.md':
    case '.markdown':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}
