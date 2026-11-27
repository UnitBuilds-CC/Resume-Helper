import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'resume-helper-assembly-'));

type DB = import('better-sqlite3').Database;
let db: DB;

beforeAll(async () => {
  db = (await import('../../db.js')).default as unknown as DB;
});

async function mods() {
  const [assembly, postings, blocks] = await Promise.all([
    import('../cv-assembly.js'),
    import('../job-posting-store.js'),
    import('../block-store.js'),
  ]);
  return { ...assembly, ...postings, ...blocks };
}

describe('assembleCv', () => {
  it('assembles stored content into a new version, in the order picked', async () => {
    const { assembleCv, createJobPosting, createBlock } = await mods();
    const posting = (createJobPosting(db, { title: 'Rust Engineer', company: 'Acme', content: 'Rust, APIs, tests.' }) as any).id as number;
    const first = (createBlock(db, { title: 'Alpha engine', content: 'Built the alpha.' }) as any).id as number;
    const second = (createBlock(db, { title: 'Beta service', content: 'Shipped the beta.' }) as any).id as number;

    const result = assembleCv(db, { job_posting_id: posting, block_ids: [second, first] }) as any;
    expect(result.version).toBe(1);
    expect(result.blocks_used).toBe(2);

    const row = db.prepare('SELECT content FROM compiled_cvs WHERE id = ?').get(result.id) as { content: string };
    expect(row.content).toContain('# ');
    expect(row.content).toContain('## Key Achievements');
    // Order is a decision the caller makes, not something the database should decide.
    expect(row.content.indexOf('Beta service')).toBeLessThan(row.content.indexOf('Alpha engine'));
    expect(row.content).toContain('Shipped the beta.');

    const again = assembleCv(db, { job_posting_id: posting, block_ids: [first] }) as any;
    expect(again.version).toBe(2);
  });

  it('refuses an empty selection, an unknown posting and an unknown block', async () => {
    const { assembleCv, createJobPosting, StoreError } = await mods();
    const posting = (createJobPosting(db, { title: 'Engineer', company: 'Beta', content: 'Builds.' }) as any).id as number;

    expect(() => assembleCv(db, { job_posting_id: posting, block_ids: [] })).toThrow(/at least one achievement block/);
    expect(() => assembleCv(db, { job_posting_id: 987654, block_ids: [1] })).toThrow(/does not exist/);
    expect(() => assembleCv(db, { job_posting_id: posting, block_ids: [987654] })).toThrow(/block_ids references unknown id/);
    expect(() => assembleCv(db, { job_posting_id: posting, block_ids: [1], system_ids: [987654] })).toThrow(/system_ids references unknown id/);
    expect(StoreError).toBeDefined();
  });

  it('honours the education and employment switches', async () => {
    const { assembleCv, createJobPosting, createBlock } = await mods();
    const posting = (createJobPosting(db, { title: 'Engineer', company: 'Gamma', content: 'Builds.' }) as any).id as number;
    const block = (createBlock(db, { title: 'Only block', content: 'Only content.' }) as any).id as number;
    db.prepare('INSERT INTO employment (company, title, start_date, end_date, description) VALUES (?,?,?,?,?)')
      .run('Fictional Systems CC', 'Engineer', 'January 2024', 'December 2025', 'ERP.');

    const withJob = assembleCv(db, { job_posting_id: posting, block_ids: [block] }) as any;
    const textWith = (db.prepare('SELECT content FROM compiled_cvs WHERE id = ?').get(withJob.id) as any).content;
    expect(textWith).toContain('## Professional Experience');

    const withoutJob = assembleCv(db, { job_posting_id: posting, block_ids: [block], include_employment: false }) as any;
    const textWithout = (db.prepare('SELECT content FROM compiled_cvs WHERE id = ?').get(withoutJob.id) as any).content;
    expect(textWithout).not.toContain('## Professional Experience');
  });
});
