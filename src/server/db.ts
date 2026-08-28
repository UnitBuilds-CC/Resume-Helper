import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = typeof import.meta.url === 'string'
  ? dirname(fileURLToPath(import.meta.url))
  : dirname(__filename);
const dataDir = process.env.DATA_DIR || join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'resume-helper.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS systems (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    industry    TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skills (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS block_skills (
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (block_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS template_cv (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    full_name  TEXT,
    email      TEXT,
    phone      TEXT,
    location   TEXT,
    linkedin   TEXT,
    website    TEXT,
    summary    TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS education (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    institution    TEXT,
    degree         TEXT,
    field          TEXT,
    start_date     TEXT,
    end_date       TEXT,
    details        TEXT,
    sort_order     INTEGER DEFAULT 0,
    template_cv_id INTEGER DEFAULT 1 REFERENCES template_cv(id)
  );

  CREATE TABLE IF NOT EXISTS employment (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    company        TEXT,
    title          TEXT,
    start_date     TEXT,
    end_date       TEXT,
    location       TEXT,
    description    TEXT,
    sort_order     INTEGER DEFAULT 0,
    template_cv_id INTEGER DEFAULT 1 REFERENCES template_cv(id)
  );

  CREATE TABLE IF NOT EXISTS job_postings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    company    TEXT,
    url        TEXT,
    content    TEXT NOT NULL,
    notes      TEXT,
    status     TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS compiled_cvs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    version        INTEGER DEFAULT 1,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(job_posting_id, version)
  );

  CREATE TABLE IF NOT EXISTS red_team_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    compiled_cv_id  INTEGER NOT NULL REFERENCES compiled_cvs(id) ON DELETE CASCADE,
    phase1_qualified INTEGER,
    phase2_score    INTEGER,
    phase3_summary  TEXT,
    overall_score   INTEGER,
    full_analysis   TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    red_team_result_id INTEGER NOT NULL REFERENCES red_team_results(id) ON DELETE CASCADE,
    question           TEXT NOT NULL,
    context            TEXT,
    skill_tag          TEXT,
    status             TEXT DEFAULT 'pending',
    answer             TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );
`);

const seedTemplate = db.prepare('SELECT id FROM template_cv WHERE id = 1');
if (!seedTemplate.get()) {
  db.prepare('INSERT INTO template_cv (id) VALUES (1)').run();
}

export default db;
