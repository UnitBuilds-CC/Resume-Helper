import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun,
} from 'docx';
import { inlineRuns, parseMarkdown, stripMarkdown, type MarkdownBlock } from './markdown-blocks.js';

export interface DocxData {
  name: string;
  title: string;
  contact: string;
  summary: string;
  content: string;
  jobTitle?: string;
  jobCompany?: string;
}

const HEADING: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
};

/** Split text on the link labels parseMarkdown found, so a URL renders as a real hyperlink in Word. */
function withLinks(text: string, links: MarkdownBlock['links']) {
  const children: (TextRun | ExternalHyperlink)[] = [];
  let rest = text;
  const labels = links.filter((l) => l.url && rest.includes(l.text));

  for (const link of labels) {
    const [before, after] = [rest.slice(0, rest.indexOf(link.text)), rest.slice(rest.indexOf(link.text) + link.text.length)];
    if (before) children.push(new TextRun({ text: before }));
    children.push(new ExternalHyperlink({
      link: link.url,
      children: [new TextRun({ text: link.text, style: 'Hyperlink' })],
    }));
    rest = after;
  }
  if (rest) children.push(new TextRun({ text: rest }));
  return children;
}

function paragraphFor(block: MarkdownBlock): (Paragraph | undefined)[] {
  if (block.type === 'hr') {
    return [new Paragraph({ text: '', border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } } })];
  }
  if (!block.text) return [undefined];

  const lines = block.text.split('\n');
  return lines.map((line) => {
    const runs = inlineRuns(line);
    const isListItem = block.type === 'list';
    const cleaned = isListItem ? line.replace(/^•\s*/, '') : line;
    const textRuns = inlineRuns(cleaned).map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));

    if (isListItem) {
      return new Paragraph({ children: textRuns, bullet: { level: 0 }, spacing: { after: 60 } });
    }
    if (block.type in HEADING) {
      return new Paragraph({ heading: HEADING[block.type], children: [new TextRun({ text: stripMarkdown(cleaned), bold: true })] });
    }
    if (block.type === 'em') {
      return new Paragraph({ children: textRuns, spacing: { after: 120 } });
    }
    return new Paragraph({ children: textRuns, spacing: { after: 120 } });
  });
}

/**
 * Mirrors the documented PDF behaviour: when the header carries the name, the # h1 block and everything up to
 * the first ## is skipped, and a body summary section is dropped rather than rendered twice. Keeping the two
 * exporters on one rule is the reason this file consumes markdown-blocks rather than parsing again.
 */
export function selectBodyBlocks(blocks: MarkdownBlock[], hasName: boolean, hasSummary: boolean): MarkdownBlock[] {
  let out = blocks;
  if (hasName) {
    const first = out.findIndex((b) => b.type === 'h2');
    out = first === -1 ? [] : out.filter((b, i) => !(b.type === 'h1') && !(i < first));
  }
  if (hasSummary) {
    const idx = out.findIndex((b) => b.type === 'h2' && /SUMMARY|OBJECTIVE|PROFILE/i.test(b.text));
    if (idx >= 0) {
      const end = out.findIndex((b, i) => i > idx && (b.type === 'h2' || b.type === 'h1'));
      out = [...out.slice(0, idx), ...(end === -1 ? [] : out.slice(end))];
    }
  }
  return out;
}

export async function generateDocx(data: DocxData): Promise<Uint8Array> {
  const paragraphs: Paragraph[] = [];

  if (data.name) {
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: data.name, bold: true, size: 40 })],
    }));
    if (data.title) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: data.title, size: 24 })], spacing: { after: 40 } }));
    }
    if (data.contact) {
      // Contact is stored as "email | phone | github.com/user", so the clickable parts have to be found
      // by shape rather than by markdown link syntax.
      const parts = data.contact.split('|').map((p) => p.trim()).filter(Boolean);
      const runs = parts.flatMap((part, i) => {
        const separator = i < parts.length - 1 ? [new TextRun({ text: '  |  ' })] : [];
        const url = /^(https?:\/\/)?(github\.com|gitlab\.com|www\.|linkedin\.com|dev\.to)/i.test(part)
          ? (part.startsWith('http') ? part : 'https://' + part)
          : null;
        if (url) {
          return [new ExternalHyperlink({ link: url, children: [new TextRun({ text: part, style: 'Hyperlink' })] }), ...separator];
        }
        return [new TextRun({ text: part }), ...separator];
      });
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 160 } }));
    }
    if (data.summary) {
      paragraphs.push(new Paragraph({ children: inlineRuns(data.summary).map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic })), spacing: { after: 200 } }));
    }
  }

  const blocks = selectBodyBlocks(parseMarkdown(data.content), !!data.name, !!data.summary);
  for (const block of blocks) {
    for (const paragraph of paragraphFor(block)) {
      if (paragraph) paragraphs.push(paragraph);
    }
  }

  const doc = new Document({
    creator: data.name || 'Resume Helper',
    title: data.title || (data.name ? `${data.name} – CV` : 'Curriculum Vitae'),
    description: data.jobTitle ? `Tailored for ${data.jobTitle}${data.jobCompany ? ' at ' + data.jobCompany : ''}` : undefined,
    sections: [{ properties: {}, children: paragraphs }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
