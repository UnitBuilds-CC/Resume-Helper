// The markdown reader for CV and cover-letter bodies, shared by the PDF and Word exporters. It was private
// to pdf-generator.ts; a second parser in the Word path would have disagreed about what a "block" is, which
// is the same class of divergence as the two version-number implementations this module family replaces.

export interface MarkdownBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'em' | 'list' | 'hr';
  text: string;
  links: { text: string; url: string }[];
}

export function autoLinkify(md: string): string {
  return md.replace(
    /(?<!\[)(?<!\()(?<!<)(https?:\/\/)?((?:github\.com|dev\.to)\/[\w-]+)(?!\])(?!\))(?!>)/g,
    (match, protocol, path) => {
      if (protocol) return match;
      return `[${path}](https://${path})`;
    }
  );
}

/** Strip inline markdown formatting markers from text (for plain-text rendering). */
export function stripMarkdown(text: string): string {
  return text.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
             .replace(/\*\*(.+?)\*\*/g, '$1')
             .replace(/\*(.+?)\*/g, '$1');
}

export interface InlineRun { text: string; bold: boolean; italic: boolean }

/**
 * Split a line into bold/italic runs. The PDF renderer flattens emphasis to plain text because it draws with
 * one font, but Word is where a recruiter edits the document, so the emphasis has to survive there.
 */
export function inlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index), bold: false, italic: false });
    if (match[2] !== undefined) runs.push({ text: match[2], bold: true, italic: true });
    else if (match[3] !== undefined) runs.push({ text: match[3], bold: true, italic: false });
    else runs.push({ text: match[4], bold: false, italic: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor), bold: false, italic: false });
  return runs.length ? runs : [{ text: '', bold: false, italic: false }];
}

export function parseMarkdown(md: string): MarkdownBlock[] {
  const linked = autoLinkify(md);
  const lines = linked.split('\n');
  const blocks: MarkdownBlock[] = [];

  let currentBlock: MarkdownBlock | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    const links: { text: string; url: string }[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(trimmed)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }

    const plainText = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    if (trimmed.startsWith('# ')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: 'h1', text: plainText.substring(2), links };
    } else if (trimmed.startsWith('## ')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: 'h2', text: plainText.substring(3), links };
    } else if (trimmed.startsWith('### ')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: 'h3', text: plainText.substring(4), links };
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentBlock || currentBlock.type !== 'list') {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'list', text: '', links: [] };
      }
      currentBlock.text += (currentBlock.text ? '\n' : '') + '• ' + plainText.substring(2);
      currentBlock.links.push(...links);
    } else if (trimmed === '---') {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'hr', text: '', links: [] });
      currentBlock = null;
    } else {
      // A line that opens with bold is usually a new skill category rather than a continuation.
      const startsWithBold = trimmed.startsWith('**');
      const prevEndsWithBold = currentBlock && currentBlock.text.trim().endsWith('**');

      if (!currentBlock || (currentBlock.type !== 'p' && currentBlock.type !== 'em') || (startsWithBold && !prevEndsWithBold)) {
        if (currentBlock) blocks.push(currentBlock);
        const isEmphasis = trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**');
        currentBlock = { type: isEmphasis ? 'em' : 'p', text: '', links: [] };
      }
      const separator = (currentBlock.text && startsWithBold) ? '\n' : ' ';
      currentBlock.text += (currentBlock.text ? separator : '') + plainText;
      currentBlock.links.push(...links);
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}
