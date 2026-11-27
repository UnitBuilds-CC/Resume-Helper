import type Database from 'better-sqlite3';

export const APPLICATION_STATUSES = [
  'not_applied', 'preparing', 'ready_to_apply', 'applied', 'interview', 'offer', 'rejected', 'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Mirrors JobPosting.status in src/shared/types.ts - the legacy sibling of application_status.
export const POSTING_STATUSES = ['active', 'applied', 'rejected', 'withdrawn'] as const;

export class StoreError extends Error {
  readonly problems: string[];
  readonly status: number;
  constructor(message: string, problems: string[] = [], status = 400) {
    // The detail travels inside the message so a caller that only sees the Error still learns what it rejected,
    // while `problems` stays structured for the HTTP response.
    super(problems.length ? message + ': ' + problems.join('; ') : message);
    this.name = 'StoreError';
    this.problems = problems;
    this.status = status;
  }
}

const COLUMNS: Record<string, string> = {
  title: 'title',
  company: 'company',
  url: 'url',
  content: 'content',
  notes: 'notes',
  status: 'status',
  application_status: 'application_status',
  compiled_cv_id: 'compiled_cv_id',
  red_team_result_id: 'red_team_result_id',
};

function validate(db: Database.Database, body: Record<string, unknown>, problems: string[]) {
  if ('status' in body && body.status != null && !(POSTING_STATUSES as readonly string[]).includes(String(body.status))) {
    problems.push('status must be one of ' + POSTING_STATUSES.join(', '));
  }
  if ('application_status' in body && body.application_status != null &&
      !(APPLICATION_STATUSES as readonly string[]).includes(String(body.application_status))) {
    problems.push('application_status must be one of ' + APPLICATION_STATUSES.join(', '));
  }
  if (body.compiled_cv_id != null && !db.prepare('SELECT id FROM compiled_cvs WHERE id = ?').get(Number(body.compiled_cv_id))) {
    problems.push('compiled_cv_id ' + body.compiled_cv_id + ' does not exist');
  }
  if (body.red_team_result_id != null && !db.prepare('SELECT id FROM red_team_results WHERE id = ?').get(Number(body.red_team_result_id))) {
    problems.push('red_team_result_id ' + body.red_team_result_id + ' does not exist');
  }
  return problems;
}

/**
 * Presence is the signal, not emptiness. Every link column used to go through COALESCE(?, col), which meant
 * an explicit null - "unlink this" - silently kept the old reference, and PUT accepted any status string at
 * the same time the PATCH route guarded it.
 */
function applyPatch(db: Database.Database, postingId: number, body: Record<string, unknown>) {
  const problems = validate(db, body, []);
  if (problems.length) throw new StoreError('job posting rejected', problems);

  const existing = db.prepare('SELECT id FROM job_postings WHERE id = ?').get(postingId);
  if (!existing) throw new StoreError('job posting ' + postingId + ' does not exist', [], 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(COLUMNS)) {
    if (!(key in body)) continue;
    const value = body[key];
    sets.push(column + ' = ?');
    params.push(value == null ? null : key.endsWith('_id') ? Number(value) : value);
  }

  if (body.application_status === 'applied') {
    sets.push("applied_date = ?");
    params.push(new Date().toISOString());
  }

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    db.prepare('UPDATE job_postings SET ' + sets.join(', ') + ' WHERE id = ?').run(...params, postingId);
  }
  return db.prepare('SELECT * FROM job_postings WHERE id = ?').get(postingId);
}

export function setApplicationStatus(db: Database.Database, postingId: number, body: Record<string, unknown>) {
  if (typeof body.application_status !== 'string') {
    throw new StoreError('application_status is required', ['application_status must be one of ' + APPLICATION_STATUSES.join(', ')]);
  }
  return applyPatch(db, postingId, body);
}

export function updateJobPosting(db: Database.Database, postingId: number, body: Record<string, unknown>) {
  return applyPatch(db, postingId, body);
}

export function jobPostingExists(db: Database.Database, id: unknown) {
  if (id == null) return false;
  return !!db.prepare('SELECT id FROM job_postings WHERE id = ?').get(Number(id));
}

/** One create path for the UI form, the scraper import and the MCP import_job tool. */
export function createJobPosting(db: Database.Database, body: Record<string, unknown>) {
  if (typeof body.title !== 'string' || !body.title.trim()) throw new StoreError('title is required');
  if (typeof body.content !== 'string' || !body.content.trim()) throw new StoreError('content is required');
  const applicationStatus = body.application_status == null ? 'not_applied' : String(body.application_status);
  if (!(APPLICATION_STATUSES as readonly string[]).includes(applicationStatus)) {
    throw new StoreError('application_status must be one of ' + APPLICATION_STATUSES.join(', '));
  }
  const inserted = db.prepare(
    'INSERT INTO job_postings (title, company, url, content, notes, status, application_status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(body.title, body.company ?? null, body.url ?? null, body.content, body.notes ?? null,
        body.status == null ? 'active' : String(body.status), applicationStatus);
  return db.prepare('SELECT * FROM job_postings WHERE id = ?').get(Number(inserted.lastInsertRowid));
}

export function deleteJobPosting(db: Database.Database, id: unknown) {
  const existing = db.prepare('SELECT id FROM job_postings WHERE id = ?').get(Number(id));
  if (!existing) throw new StoreError('job posting ' + String(id) + ' does not exist', [], 404);
  db.prepare('DELETE FROM job_postings WHERE id = ?').run(Number(id));
  return { deleted: true, id: Number(id) };
}
