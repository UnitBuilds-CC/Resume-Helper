import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { saveCoverLetterAsNewVersion } from '../cover-letter-versions.js';

// save_cover_letter is described as "creates new version" but the handler ran
// UPDATE cover_letters SET content = ? WHERE id = ?, which destroyed the text it claimed to
// keep. These cases pin the append-a-version behaviour, and the last one reproduces the old
// UPDATE so the suite proves the difference rather than merely describing it.
function freshDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE job_postings (id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT);
    CREATE TABLE cover_letters (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      job_posting_id  INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
      content         TEXT NOT NULL,
      version         INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(job_posting_id, version)
    );
    INSERT INTO job_postings (id, company) VALUES (1, 'Acme Analytics, Inc.'), (2, 'Beta Logistics');
  `);
  return db;
}

const seed = (db: Database.Database, job: number, content: string, version: number) =>
  db.prepare('INSERT INTO cover_letters (job_posting_id, content, version) VALUES (?, ?, ?)').run(job, content, version)
    .lastInsertRowid as number;

// Mirrors GET /api/cover-letters/:job_posting_id.
const latest = (db: Database.Database, job: number) =>
  db.prepare('SELECT * FROM cover_letters WHERE job_posting_id = ? ORDER BY version DESC LIMIT 1').get(job) as any;

let db: Database.Database;
beforeEach(() => { db = freshDb(); });

describe('saveCoverLetterAsNewVersion', () => {
  it('appends a version instead of overwriting the row it was given', () => {
    const first = seed(db, 1, 'draft one', 1);
    const saved = saveCoverLetterAsNewVersion(db, first, 'draft two')!;

    expect(saved.id).not.toBe(first);
    expect(saved.version).toBe(2);
    expect(db.prepare('SELECT content FROM cover_letters WHERE id = ?').get(first)).toEqual({ content: 'draft one' });
    expect(saved.job_posting_id).toBe(1);
  });

  it('derives the next version above every version the posting already has', () => {
    seed(db, 1, 'v1', 1);
    seed(db, 1, 'v2', 2);
    seed(db, 1, 'v3', 3);
    const saved = saveCoverLetterAsNewVersion(db, seed(db, 1, 'v4', 4), 'v5')!;
    expect(saved.version).toBe(5);
  });

  it('keeps per-posting numbering, so a second job posting is unaffected', () => {
    seed(db, 1, 'acme v1', 1);
    seed(db, 1, 'acme v2', 2);
    const beta = seed(db, 2, 'beta v1', 1);
    expect(saveCoverLetterAsNewVersion(db, beta, 'beta v2')!.version).toBe(2);
    expect(db.prepare('SELECT COUNT(*) c FROM cover_letters WHERE job_posting_id = 1').get()).toEqual({ c: 2 });
  });

  it('lands on the row the read path returns as latest', () => {
    const first = seed(db, 1, 'draft one', 1);
    saveCoverLetterAsNewVersion(db, first, 'corrected denial removed');
    expect(latest(db, 1).content).toBe('corrected denial removed');
    expect(latest(db, 1).version).toBe(2);
  });

  it('refuses an unknown id without writing anything', () => {
    seed(db, 1, 'v1', 1);
    expect(saveCoverLetterAsNewVersion(db, 9999, 'orphan')).toBeNull();
    expect(db.prepare('SELECT COUNT(*) c FROM cover_letters').get()).toEqual({ c: 1 });
  });

  it('control: the previous UPDATE destroys history, which is what these tests exist to prevent', () => {
    const only = seed(db, 1, 'I do not work in Ruby or Rails', 1);
    db.prepare("UPDATE cover_letters SET content = ?, updated_at = datetime('now') WHERE id = ?").run('corrected', only);
    const after = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(only) as any;
    expect(after.version).toBe(1);
    expect(db.prepare('SELECT COUNT(*) c FROM cover_letters').get()).toEqual({ c: 1 });
    expect(after.content).toBe('corrected');
  });
});
