import { PDFDocument, StandardFonts, rgb, PDFString, PDFName } from 'pdf-lib';

interface PdfData {
  name: string;
  title: string;
  contact: string;
  summary: string;
  content: string;
  jobTitle?: string;
  jobCompany?: string;
  keywords?: string[];
}

// Parse inline markdown formatting into segments
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[2]) {
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      segments.push({ text: match[3], bold: true, italic: false });
    } else if (match[4]) {
      segments.push({ text: match[4], bold: false, italic: true });
    }
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }
  if (segments.length === 0) {
    segments.push({ text, bold: false, italic: false });
  }
  return segments;
}

// Sanitize text for WinAnsi encoding
function sanitizeText(text: string): string {
  return text
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xC0 && code <= 0xC5) return 'A';
      if (code === 0xC7) return 'C';
      if (code >= 0xC8 && code <= 0xCB) return 'E';
      if (code >= 0xCC && code <= 0xCF) return 'I';
      if (code === 0xD0) return 'D';
      if (code === 0xD1) return 'N';
      if (code >= 0xD2 && code <= 0xD6) return 'O';
      if (code === 0xD8) return 'O';
      if (code >= 0xD9 && code <= 0xDC) return 'U';
      if (code === 0xDD) return 'Y';
      if (code >= 0xE0 && code <= 0xE5) return 'a';
      if (code === 0xE7) return 'c';
      if (code >= 0xE8 && code <= 0xEB) return 'e';
      if (code >= 0xEC && code <= 0xEF) return 'i';
      if (code === 0xF0) return 'd';
      if (code === 0xF1) return 'n';
      if (code >= 0xF2 && code <= 0xF6) return 'o';
      if (code === 0xF8) return 'o';
      if (code >= 0xF9 && code <= 0xFC) return 'u';
      if (code === 0xFD) return 'y';
      if (code === 0xFF) return 'y';
      if (code === 0xDF) return 'ss';
      return '';
    });
}

// Auto-linkify plain URLs in markdown
function autoLinkify(md: string): string {
  return md.replace(
    /(?<!\[)(?<!\()(?<!<)(https?:\/\/)?((?:github\.com|dev\.to)\/[\w-]+)(?!\])(?!\))(?!>)/g,
    (match, protocol, path) => {
      if (protocol) return match;
      return `[${path}](https://${path})`;
    }
  );
}

// Strip inline markdown formatting markers from text (for plain text rendering)
function stripMarkdown(text: string): string {
  return text.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
             .replace(/\*\*(.+?)\*\*/g, '$1')
             .replace(/\*(.+?)\*/g, '$1');
}

// Parse markdown into structured blocks
function parseMarkdown(md: string): Array<{type: string; text: string; links: Array<{text: string; url: string}>}> {
  const linked = autoLinkify(md);
  const lines = linked.split('\n');
  const blocks: Array<{type: string; text: string; links: Array<{text: string; url: string}>}> = [];
  
  let currentBlock: {type: string; text: string; links: Array<{text: string; url: string}>} | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }
    
    const links: Array<{text: string; url: string}> = [];
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
      // Check if this line starts with bold text (common in resumes for skill categories)
      const startsWithBold = trimmed.startsWith('**');
      const prevEndsWithBold = currentBlock && currentBlock.text.trim().endsWith('**');
      
      // Start a new paragraph if:
      // 1. No current block, or
      // 2. Current block is not a paragraph/emphasis, or
      // 3. This line starts with bold text AND previous didn't end with bold (new section)
      if (!currentBlock || (currentBlock.type !== 'p' && currentBlock.type !== 'em') || (startsWithBold && !prevEndsWithBold)) {
        if (currentBlock) blocks.push(currentBlock);
        const isEmphasis = trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**');
        currentBlock = { type: isEmphasis ? 'em' : 'p', text: '', links: [] };
      }
      // Add newline separator between bold-starting lines within same paragraph
      const separator = (currentBlock.text && startsWithBold) ? '\n' : ' ';
      currentBlock.text += (currentBlock.text ? separator : '') + plainText;
      currentBlock.links.push(...links);
    }
  }
  
  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

// Helper to estimate height of wrapped text
function estimateTextHeight(text: string, size: number, maxWidth: number, lineHeight: number, font: any): number {
  const sanitized = sanitizeText(text);
  const words = sanitized.split(' ');
  let lines = 1;
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    
    if (testWidth > maxWidth && currentLine) {
      lines++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  return lines * lineHeight;
}

export async function generatePdf(data: PdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  
  function getFont(bold: boolean, italic: boolean): any {
    if (bold && italic) return helveticaBoldOblique;
    if (bold) return helveticaBold;
    if (italic) return helveticaOblique;
    return helvetica;
  }
  
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  
  // Consistent margins
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };
  const contentWidth = width - margin.left - margin.right;
  let y = height - margin.top;
  
  // Consistent spacing constants
  const SPACING = {
    xs: 4,    // Extra small: tight elements
    sm: 8,    // Small: related elements
    md: 12,   // Medium: section elements
    lg: 16,   // Large: section breaks
    xl: 24,   // Extra large: major sections
  };
  
  function newPage() {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - margin.top;
  }
  
  // Check if we need a page break, with optional minimum content height
  function checkPageBreak(minContentHeight: number = 0) {
    if (y - minContentHeight < margin.bottom) {
      newPage();
    }
  }
  
  // Helper to add link annotation
  function addLinkAnnotation(url: string, x: number, linkY: number, linkWidth: number, linkHeight: number) {
    const action = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Action',
        S: PDFName.of('URI'),
        URI: PDFString.of(url),
      })
    );
    
    const link = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('Link'),
        Rect: [x, linkY - linkHeight, x + linkWidth, linkY],
        Border: [0, 0, 0],
        A: action,
      })
    );
    
    const pageDict = page.node;
    const existingAnnots = pageDict.lookup(PDFName.of('Annots'));
    
    if (existingAnnots) {
      (existingAnnots as any).push(link);
    } else {
      const newAnnots = pdfDoc.context.register(pdfDoc.context.obj([link]));
      pageDict.set(PDFName.of('Annots'), newAnnots);
    }
  }
  
  // Draw a single line with inline markdown formatting
  function drawFormattedLine(
    text: string,
    x: number,
    lineY: number,
    size: number,
    defaultFont: any,
    color: any,
    links: Array<{text: string; url: string}> = []
  ): number {
    const segments = parseInlineMarkdown(text);
    let cursorX = x;
    
    for (const seg of segments) {
      const segText = sanitizeText(seg.text);
      if (!segText) continue;
      
      const font = getFont(seg.bold, seg.italic);
      page.drawText(segText, { x: cursorX, y: lineY, size, font, color });
      cursorX += font.widthOfTextAtSize(segText, size);
      
      // Check for links in this segment
      for (const link of links) {
        const linkText = sanitizeText(link.text);
        const segIndex = segText.indexOf(linkText);
        if (segIndex !== -1) {
          const beforeLink = segText.substring(0, segIndex);
          const linkX = cursorX - font.widthOfTextAtSize(segText, size) + font.widthOfTextAtSize(beforeLink, size);
          const linkWidth = font.widthOfTextAtSize(linkText, size);
          addLinkAnnotation(link.url, linkX, lineY, linkWidth, size);
        }
      }
    }
    
    return cursorX - x; // return line width
  }
  
  // Calculate width of a formatted text line
  function formattedLineWidth(text: string, size: number): number {
    const segments = parseInlineMarkdown(text);
    let w = 0;
    for (const seg of segments) {
      const segText = sanitizeText(seg.text);
      if (!segText) continue;
      const font = getFont(seg.bold, seg.italic);
      w += font.widthOfTextAtSize(segText, size);
    }
    return w;
  }
  
  // Draw text with word wrap, inline formatting, and link detection
  function drawText(text: string, options: {
    x: number;
    y: number;
    size: number;
    font: any;
    color?: any;
    maxWidth: number;
    lineHeight?: number;
    links?: Array<{text: string; url: string}>;
  }): { endY: number } {
    const { x, y: startY, size, font, color = rgb(0, 0, 0), maxWidth, lineHeight = size * 1.4, links = [] } = options;
    
    // Split text by newlines first, then process each line
    const textLines = text.split('\n');
    let currentY = startY;
    
    for (const textLine of textLines) {
      // Split text into words, preserving markdown formatting
      const sanitized = sanitizeText(textLine);
      const words = sanitized.split(' ');
      let line = '';
      
      function flushLine() {
        if (!line) return;
        drawFormattedLine(line, x, currentY, size, font, color, links);
        currentY -= lineHeight;
        line = '';
      }
      
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const testWidth = formattedLineWidth(testLine, size);
        
        if (testWidth > maxWidth && line) {
          flushLine();
          line = word;
        } else {
          line = testLine;
        }
      }
      
      flushLine();
    }
    
    return { endY: currentY };
  }
  
  // Estimate height of formatted text
  function estimateFormattedTextHeight(text: string, size: number, maxWidth: number, lineHeight?: number): number {
    const lh = lineHeight || size * 1.4;
    const sanitized = sanitizeText(text);
    const words = sanitized.split(' ');
    let lines = 1;
    let currentLineWidth = 0;
    
    for (const word of words) {
      const wordWidth = formattedLineWidth(word, size);
      const spaceWidth = helvetica.widthOfTextAtSize(' ', size);
      
      if (currentLineWidth + spaceWidth + wordWidth > maxWidth && currentLineWidth > 0) {
        lines++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += (currentLineWidth > 0 ? spaceWidth : 0) + wordWidth;
      }
    }
    
    return lines * lh;
  }
  
  // === HEADER SECTION ===
  // Name
  if (data.name) {
    const nameSize = 22;
    page.drawText(sanitizeText(data.name), {
      x: margin.left,
      y,
      size: nameSize,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= nameSize + SPACING.sm;
  }
  
  // Professional title
  if (data.title) {
    const titleSize = 11;
    page.drawText(sanitizeText(data.title), {
      x: margin.left,
      y,
      size: titleSize,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= titleSize + SPACING.sm;
  }
  
  // Contact info
  if (data.contact) {
    const contactSize = 9.5;
    const linkedContact = autoLinkify(data.contact);
    const contactLinks: Array<{text: string; url: string}> = [];
    const contactLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let contactMatch;
    while ((contactMatch = contactLinkRegex.exec(linkedContact)) !== null) {
      contactLinks.push({ text: contactMatch[1], url: contactMatch[2] });
    }
    const contactText = linkedContact.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    const contactLines = drawText(contactText, {
      x: margin.left,
      y,
      size: contactSize,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth: contentWidth,
      links: contactLinks,
    });
    y = contactLines.endY - SPACING.md;
  }
  
  // Summary
  if (data.summary) {
    const summarySize = 10;
    const summaryLines = drawText(data.summary, {
      x: margin.left,
      y,
      size: summarySize,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: contentWidth,
      lineHeight: summarySize * 1.5,
    });
    y = summaryLines.endY - SPACING.lg;
  }
  
  // === CONTENT SECTION ===
  const blocks = parseMarkdown(data.content);
  
  // Skip the compiled CV's header section if template CV already has a name.
  let startIdx = 0;
  if (data.name && blocks.length > 0 && blocks[0].type === 'h1') {
    startIdx = 1;
    // Skip everything until we hit an hr or h2 (the header section boundary)
    while (startIdx < blocks.length) {
      const b = blocks[startIdx];
      if (b.type === 'hr' || b.type === 'h2') break;
      startIdx++;
    }
    // Skip the hr itself if present
    if (startIdx < blocks.length && blocks[startIdx].type === 'hr') {
      startIdx++;
    }
  }
  
  // Skip the compiled CV's SUMMARY section if template CV already has a summary
  if (data.summary && startIdx < blocks.length && blocks[startIdx].type === 'h2') {
    const h2Text = stripMarkdown(blocks[startIdx].text).toUpperCase();
    if (h2Text.includes('SUMMARY') || h2Text.includes('OBJECTIVE') || h2Text.includes('PROFILE')) {
      startIdx++;
      // Skip the summary paragraph(s) that follow
      while (startIdx < blocks.length && (blocks[startIdx].type === 'p' || blocks[startIdx].type === 'em')) {
        startIdx++;
      }
      // Skip the hr after summary if present
      if (startIdx < blocks.length && blocks[startIdx].type === 'hr') {
        startIdx++;
      }
    }
  }
  
  // Render content blocks
  for (let i = startIdx; i < blocks.length; i++) {
    const block = blocks[i];
    
    if (block.type === 'h1') {
      // Major section header - keep with following content
      // Look ahead to see what follows and ensure we have space
      let followingContentHeight = 0;
      const nextBlock = (i + 1 < blocks.length) ? blocks[i + 1] : null;
      
      if (nextBlock?.type === 'h2') {
        // If followed by h2, ensure space for h1 + h2 + h2's content
        followingContentHeight = 120; // Conservative estimate
      } else if (nextBlock?.type === 'h3') {
        // If followed by h3, ensure space for h1 + h3 + h3's content
        followingContentHeight = 100;
      } else if (nextBlock?.type === 'p' || nextBlock?.type === 'em') {
        // If followed by paragraph, ensure space for header + paragraph
        const nextSize = nextBlock.type === 'em' ? 9.5 : 10;
        const nextLineHeight = nextSize * 1.5;
        followingContentHeight = estimateFormattedTextHeight(nextBlock.text, nextSize, contentWidth, nextLineHeight);
      } else if (nextBlock?.type === 'list') {
        // If followed by list, ensure space for header + first few items
        followingContentHeight = 80;
      }
      
      // Ensure space for header + underline + following content (minimum 100px)
      checkPageBreak(Math.max(100, 16 + SPACING.sm + SPACING.md + followingContentHeight));
      
      y -= SPACING.lg;
      const size = 16;
      drawFormattedLine(block.text, margin.left, y, size, helveticaBold, rgb(0.1, 0.1, 0.1));
      y -= size + SPACING.sm;
      // Add a subtle line under h1
      page.drawLine({
        start: { x: margin.left, y },
        end: { x: width - margin.right, y },
        thickness: 0.75,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= SPACING.md;
      
    } else if (block.type === 'h2') {
      // Section header - keep with following content
      // Look ahead to see what follows and ensure we have space
      let followingContentHeight = 0;
      const nextBlock = (i + 1 < blocks.length) ? blocks[i + 1] : null;
      
      if (nextBlock?.type === 'h3') {
        // If followed by h3, ensure space for h2 + h3 + h3's content
        followingContentHeight = 100; // Conservative estimate
      } else if (nextBlock?.type === 'p' || nextBlock?.type === 'em') {
        // If followed by paragraph, ensure space for header + paragraph
        const nextSize = nextBlock.type === 'em' ? 9.5 : 10;
        const nextLineHeight = nextSize * 1.5;
        followingContentHeight = estimateFormattedTextHeight(nextBlock.text, nextSize, contentWidth, nextLineHeight);
      } else if (nextBlock?.type === 'list') {
        // If followed by list, ensure space for header + first few items
        followingContentHeight = 60;
      }
      
      // Ensure space for header + following content (minimum 90px)
      checkPageBreak(Math.max(90, 11 + SPACING.xs + SPACING.sm + followingContentHeight));
      
      y -= SPACING.md;
      const size = 11;
      drawFormattedLine(block.text.toUpperCase(), margin.left, y, size, helveticaBold, rgb(0.2, 0.2, 0.2));
      y -= size + SPACING.xs;
      // Add a line under h2
      page.drawLine({
        start: { x: margin.left, y },
        end: { x: width - margin.right, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= SPACING.sm;
      
    } else if (block.type === 'h3') {
      // Subsection header - keep with following content (date/location, description)
      // Look ahead to calculate total height needed for header + next few blocks
      let totalHeightNeeded = 0;
      const headerHeight = 10.5 + SPACING.sm; // h3 height + spacing
      
      // Add height for next 1-2 blocks (typically date line + description)
      for (let j = 1; j <= 2 && (i + j) < blocks.length; j++) {
        const nextBlock = blocks[i + j];
        if (nextBlock.type === 'p' || nextBlock.type === 'em') {
          const nextSize = nextBlock.type === 'em' ? 9.5 : 10;
          const nextLineHeight = nextSize * 1.5;
          const nextHeight = estimateFormattedTextHeight(nextBlock.text, nextSize, contentWidth, nextLineHeight);
          totalHeightNeeded += nextHeight + SPACING.sm;
        } else if (nextBlock.type === 'list') {
          // Just add space for first list item to keep header with start of list
          totalHeightNeeded += 20; // Approximate first item height
          break; // Don't add more after list starts
        } else {
          break; // Stop at other block types
        }
      }
      
      // Ensure space for header + following content (minimum 100px, or calculated amount)
      checkPageBreak(Math.max(100, headerHeight + totalHeightNeeded));
      
      y -= SPACING.sm;
      const size = 10.5;
      drawFormattedLine(block.text, margin.left, y, size, helveticaBold, rgb(0.15, 0.15, 0.15));
      y -= size + SPACING.sm;
      
    } else if (block.type === 'list') {
      // List with proper spacing
      y -= SPACING.xs;
      const items = block.text.split('\n');
      for (const item of items) {
        const size = 9.5;
        const itemHeight = estimateFormattedTextHeight(item, size, contentWidth - 10);
        
        // Keep list items together when possible
        checkPageBreak(Math.min(itemHeight + SPACING.sm, 60));
        
        const itemLines = drawText(item, {
          x: margin.left + 10,
          y,
          size,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
          maxWidth: contentWidth - 10,
          links: block.links,
        });
        y = itemLines.endY - SPACING.xs;
      }
      y -= SPACING.xs;
      
    } else if (block.type === 'hr') {
      // Horizontal rule
      checkPageBreak(20);
      y -= SPACING.sm;
      page.drawLine({
        start: { x: margin.left, y },
        end: { x: width - margin.right, y },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= SPACING.md;
      
    } else if (block.type === 'em') {
      // Emphasis/italic text
      const size = 9.5;
      const blockHeight = estimateFormattedTextHeight(block.text, size, contentWidth, size * 1.5);
      checkPageBreak(Math.min(blockHeight + SPACING.sm, 60));
      
      const emLines = drawText(block.text, {
        x: margin.left,
        y,
        size,
        font: helveticaOblique,
        color: rgb(0.4, 0.4, 0.4),
        maxWidth: contentWidth,
        links: block.links,
      });
      y = emLines.endY - SPACING.sm;
      
    } else if (block.type === 'p') {
      // Paragraph
      const size = 10;
      const lineHeight = size * 1.5;
      const blockHeight = estimateFormattedTextHeight(block.text, size, contentWidth, lineHeight);
      
      // If this is a short label paragraph followed by a list, keep them together
      const nextBlock = (i + 1 < blocks.length) ? blocks[i + 1] : null;
      const isLabelBeforeList = nextBlock?.type === 'list' && block.text.length < 60;
      const minSpace = isLabelBeforeList ? blockHeight + SPACING.md + 60 : Math.min(blockHeight + SPACING.sm, 80);
      checkPageBreak(minSpace);
      
      const pLines = drawText(block.text, {
        x: margin.left,
        y,
        size,
        font: helvetica,
        color: rgb(0.15, 0.15, 0.15),
        maxWidth: contentWidth,
        lineHeight,
        links: block.links,
      });
      y = pLines.endY - SPACING.md;
    }
  }
  
  // Embed PDF metadata for ATS compatibility
  const docTitle = data.jobTitle
    ? `${data.name} - ${data.jobTitle}${data.jobCompany ? ` at ${data.jobCompany}` : ''}`
    : `${data.name} - Professional CV`;
  pdfDoc.setTitle(docTitle);
  pdfDoc.setAuthor(data.name);
  pdfDoc.setSubject('Curriculum Vitae');
  if (data.keywords?.length) {
    pdfDoc.setKeywords(data.keywords);
  }
  pdfDoc.setCreator('UnitBuilds CV System');
  pdfDoc.setProducer('UnitBuilds CV System');
  
  return await pdfDoc.save();
}
