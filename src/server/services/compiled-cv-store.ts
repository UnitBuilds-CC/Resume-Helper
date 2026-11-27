import type Database from 'better-sqlite3';
import { StoreError, jobPostingExists } from './job-posting-store.js';
import { assertClaimsGrounded } from './timeline.js';

export interface CompiledCvRow {
  id: number;
  job_posting_id: number;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Both create paths - the REST route the UI would use and compile_cv_from_blocks - assign the version this
 * way, and used to keep separate copies of the MAX(version)+1 query.
 */
export function createCompiledCv(db: Database.Database, input: { job_posting_id: unknown; content: unknown; acknowledge?: unknown }): CompiledCvRow {
  const { job_posting_id, content } = input;
  if (!jobPostingExists(db, job_posting_id)) {
    throw new StoreError('job_posting_id ' + String(job_posting_id) + ' does not exist');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new StoreError('content must be a non-empty string');
  }
  assertClaimsGrounded(db, content, 'compiled CV', input.acknowledge);

  const top = db.prepare('SELECT MAX(version) as max_version FROM compiled_cvs WHERE job_posting_id = ?')
    .get(Number(job_posting_id)) as { max_version: number | null };
  const version = (top?.max_version ?? 0) + 1;

  const inserted = db.prepare('INSERT INTO compiled_cvs (job_posting_id, content, version) VALUES (?, ?, ?)')
    .run(Number(job_posting_id), content, version);
  return db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(Number(inserted.lastInsertRowid)) as CompiledCvRow;
}

export function getCompiledCv(db: Database.Database, id: unknown) {
  const row = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(Number(id));
  if (!row) throw new StoreError('compiled CV ' + String(id) + ' does not exist', [], 404);
  return row as CompiledCvRow;
}

export function updateCompiledCv(db: Database.Database, id: unknown, content: unknown, acknowledge?: unknown) {
  const existing = getCompiledCv(db, id);
  if (content !== undefined && content !== null) {
    if (typeof content !== 'string' || !content.trim()) throw new StoreError('content must be a non-empty string');
    assertClaimsGrounded(db, content, 'compiled CV', acknowledge);
    db.prepare("UPDATE compiled_cvs SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, existing.id);
  }
  return getCompiledCv(db, id);
}

export function listCompiledCvs(db: Database.Database, jobPostingId?: unknown) {  let query = `
    SELECT cc.*, jp.title as job_title, jp.company as job_company
    FROM compiled_cvs cc
    JOIN job_postings jp ON jp.id = cc.job_posting_id
  `;
  const params: unknown[] = [];
  if (jobPostingId) {
    query += ' WHERE cc.job_posting_id = ?';
    params.push(Number(jobPostingId));
  }
  query += ' ORDER BY cc.updated_at DESC';
  return db.prepare(query).all(...params);
}

/**
 * job_postings.compiled_cv_id has no ON DELETE clause, so SQLite refused this delete and the route surfaced
 * it as an unhandled 500. Say which posting holds the link instead. Deleting a CV still cascades its own
 * evaluations and questions, which is what the table definitions declare.
 */
export function deleteCompiledCv(db: Database.Database, id: unknown) {
  const cv = getCompiledCv(db, id);
  const referencing = db.prepare('SELECT id, title FROM job_postings WHERE compiled_cv_id = ?').all(cv.id) as { id: number; title: string }[];
  if (referencing.length) {
    throw new StoreError(
      'compiled CV ' + cv.id + ' is still linked from job posting(s) ' + referencing.map((r) => r.id).join(', '),
      ['clear the link (PUT /api/job-postings/:id with compiled_cv_id null) before deleting this CV']
    );
  }
  db.prepare('DELETE FROM compiled_cvs WHERE id = ?').run(cv.id);
  return { deleted: true, id: cv.id };
}
