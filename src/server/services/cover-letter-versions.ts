import type Database from 'better-sqlite3';
import { assertClaimsGrounded } from './timeline.js';

export interface CoverLetterVersion {
  id: number;
  job_posting_id: number;
  content: string;
  version: number;
}

// cover_letters carries UNIQUE(job_posting_id, version) and the read path takes
// ORDER BY version DESC LIMIT 1, so an edit is meant to append a version rather than
// overwrite one. The version must be derived per job posting, not per row: a caller holding
// an older row id still has to land above the newest version for that posting.
export function saveCoverLetterAsNewVersion(
  db: Database.Database,
  coverLetterId: number,
  content: string,
  acknowledge?: unknown
): CoverLetterVersion | null {
  const existing = db
    .prepare('SELECT job_posting_id FROM cover_letters WHERE id = ?')
    .get(coverLetterId) as { job_posting_id: number } | undefined;
  if (!existing) return null;

  // A letter is the most-read document in the application, and it is the one an agent rewrites most often.
  assertClaimsGrounded(db, content, 'cover letter', acknowledge);

  const top = db
    .prepare('SELECT MAX(version) AS max_version FROM cover_letters WHERE job_posting_id = ?')
    .get(existing.job_posting_id) as { max_version: number | null } | undefined;
  const version = (top?.max_version ?? 0) + 1;

  const inserted = db
    .prepare(
      "INSERT INTO cover_letters (job_posting_id, content, version, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    )
    .run(existing.job_posting_id, content, version);

  return db
    .prepare('SELECT id, job_posting_id, content, version FROM cover_letters WHERE id = ?')
    .get(inserted.lastInsertRowid) as CoverLetterVersion;
}
