import type Database from 'better-sqlite3';
import { createCompiledCv } from './compiled-cv-store.js';
import { StoreError } from './job-posting-store.js';
import { renderDate, type DatePrecision } from './timeline.js';

export interface AssemblyChoice {
  job_posting_id: number;
  block_ids?: number[];
  system_ids?: number[];
  include_education?: boolean;
  include_employment?: boolean;
}

/** Dates in a CV are rendered from the record and its declared precision, never copied from prose. */
function renderLabel(row: any, which: 'start' | 'end' = 'start'): string {
  const iso = row[which + '_date'];
  if (!iso) return which === 'end' ? 'Present' : '';
  return renderDate(iso, null, (row[which + '_precision'] || 'month') as DatePrecision);
}

function selectByIds(db: Database.Database, table: string, ids: number[], label: string) {
  if (!ids.length) return [];
  const known = db.prepare(`SELECT id FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as { id: number }[];
  const found = new Set(known.map((r) => r.id));
  const unknown = ids.filter((i) => !found.has(i));
  if (unknown.length) throw new StoreError(label + ' references unknown id(s): ' + unknown.join(', '));
  const placeholders = ids.map(() => '?').join(',');
  // Preserve the caller's order: which block comes first in a CV is a decision, not a coincidence.
  const rows = db.prepare(`SELECT * FROM ${table} WHERE id IN (${placeholders})`).all(...ids) as any[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => byId.get(i));
}

/**
 * Assembles a CV out of stored content and stores it as a new version. This lived only inside the MCP tool,
 * so a person using the desktop app could not compile a CV at all without configuring an AI client, and the
 * REST route was free to invent a different layout.
 */
export function assembleCv(db: Database.Database, choice: AssemblyChoice) {
  const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(Number(choice.job_posting_id)) as any;
  if (!job) throw new StoreError('job posting ' + choice.job_posting_id + ' does not exist', [], 404);

  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  if (!templateCv) throw new StoreError('fill in the profile pad before compiling', ['GET /api/template-cv is empty'], 409);

  const blockIds = (choice.block_ids ?? []).map(Number);
  const systemIds = (choice.system_ids ?? []).map(Number);
  if (!blockIds.length) throw new StoreError('select at least one achievement block to compile from');

  const blocks = selectByIds(db, 'blocks', blockIds, 'block_ids');
  const systems = selectByIds(db, 'systems', systemIds, 'system_ids');
  const education = choice.include_education === false ? [] : db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all() as any[];
  const employment = choice.include_employment === false ? [] : db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all() as any[];

  let markdown = `# ${templateCv.full_name || 'Your Name'}\n`;
  markdown += `**Email:** ${templateCv.email || ''} | **Phone:** ${templateCv.phone || ''} | **Location:** ${templateCv.location || ''}\n`;
  if (templateCv.linkedin || templateCv.website) {
    markdown += `**Links:** ${[templateCv.linkedin, templateCv.website].filter(Boolean).join(' | ')}\n`;
  }
  markdown += '\n';

  if (templateCv.summary) markdown += `## Summary\n${templateCv.summary}\n\n`;

  if (systems.length > 0) {
    markdown += '## Technical Systems\n\n';
    for (const sys of systems) {
      markdown += `### ${sys.name}\n`;
      if (sys.industry) markdown += `*${sys.industry}*\n\n`;
      markdown += `${sys.description}\n\n`;
      if (sys.notes) markdown += `*${sys.notes}*\n\n`;
    }
  }

  if (blocks.length > 0) {
    markdown += '## Key Achievements\n\n';
    for (const block of blocks) {
      markdown += `### ${block.title}\n`;
      markdown += `${block.content}\n\n`;
    }
  }

  if (employment.length > 0) {
    markdown += '## Professional Experience\n\n';
    for (const emp of employment) {
      markdown += `### ${emp.title} — ${emp.company}\n`;
      markdown += `*${renderLabel(emp)} | ${emp.location || ''}*\n\n`;
      markdown += `${emp.description}\n\n`;
    }
  }

  if (education.length > 0) {
    markdown += '## Education\n\n';
    for (const edu of education) {
      markdown += `### ${edu.institution}\n`;
      markdown += `${edu.degree || ''}${edu.field ? ` in ${edu.field}` : ''} (${renderLabel(edu)} - ${renderLabel(edu, 'end')})\n`;
      if (edu.details) markdown += `${edu.details}\n`;
      markdown += '\n';
    }
  }

  const saved = createCompiledCv(db, { job_posting_id: job.id, content: markdown }) as { id: number; version: number };
  return { ...saved, blocks_used: blocks.length, systems_used: systems.length };
}
