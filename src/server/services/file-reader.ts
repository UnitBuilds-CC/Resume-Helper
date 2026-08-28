import { extname } from 'path';
import mammoth from 'mammoth';

const _require = typeof require !== 'undefined' ? require : null;
const pdfParse = _require ? _require('pdf-parse') : null;

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf': {
      if (!pdfParse) throw new Error('pdf-parse not available');
      const data = await pdfParse(buffer);
      return data.text;
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
