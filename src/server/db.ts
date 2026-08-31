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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    company         TEXT,
    url             TEXT,
    content         TEXT NOT NULL,
    notes           TEXT,
    status          TEXT DEFAULT 'active',
    application_status TEXT DEFAULT 'not_applied',
    applied_date    TEXT,
    compiled_cv_id  INTEGER REFERENCES compiled_cvs(id),
    red_team_result_id INTEGER REFERENCES red_team_results(id),
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
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
    recommendation  TEXT,
    red_flags       TEXT,
    job_fit_summary TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS red_team_dimensions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    red_team_result_id  INTEGER NOT NULL REFERENCES red_team_results(id) ON DELETE CASCADE,
    dimension_name      TEXT NOT NULL,
    score               INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
    weight              REAL NOT NULL,
    feedback            TEXT NOT NULL,
    strengths           TEXT,
    gaps                TEXT,
    evidence            TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS application_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id  INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    question_type   TEXT DEFAULT 'text',
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS application_answers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id      INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    question_id         INTEGER NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    answer              TEXT NOT NULL,
    is_auto_generated   INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
  );
`);

const seedTemplate = db.prepare('SELECT id FROM template_cv WHERE id = 1');
if (!seedTemplate.get()) {
  db.prepare('INSERT INTO template_cv (id) VALUES (1)').run();
}

// Migrations for new columns (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
try { db.exec(`ALTER TABLE template_cv ADD COLUMN professional_title TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE blocks ADD COLUMN is_generic INTEGER DEFAULT 1`); } catch {}
try { db.exec(`ALTER TABLE blocks ADD COLUMN target_companies TEXT DEFAULT ''`); } catch {}

// Settings table for app preferences (e.g., language)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Git integration tables
db.exec(`
  CREATE TABLE IF NOT EXISTS git_repos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    path                TEXT NOT NULL UNIQUE,
    remote_url          TEXT,
    branch              TEXT DEFAULT 'main',
    last_synced_commit  TEXT,
    last_synced_at      TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS git_systems (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id      INTEGER NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    commit_hash  TEXT NOT NULL,
    file_path    TEXT,
    name         TEXT NOT NULL,
    description  TEXT,
    industry     TEXT,
    notes        TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS git_blocks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id      INTEGER NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    commit_hash  TEXT NOT NULL,
    file_path    TEXT,
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS git_sync_log (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id            INTEGER NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    sync_started_at    TEXT NOT NULL,
    sync_completed_at  TEXT,
    status             TEXT DEFAULT 'in_progress',
    commits_processed  INTEGER DEFAULT 0,
    systems_extracted  INTEGER DEFAULT 0,
    blocks_extracted   INTEGER DEFAULT 0,
    error_message      TEXT
  );
`);

// Cover letters table
db.exec(`
  CREATE TABLE IF NOT EXISTS cover_letters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id  INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    version         INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(job_posting_id, version)
  );
`);

// Projects table for portfolio/portfolio items
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    url             TEXT,
    github_url      TEXT,
    demo_url        TEXT,
    technologies    TEXT,
    start_date      TEXT,
    end_date        TEXT,
    category        TEXT DEFAULT 'personal',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );
`);

// Link tables for blocks relationships
db.exec(`
  CREATE TABLE IF NOT EXISTS block_employment (
    block_id       INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    employment_id  INTEGER NOT NULL REFERENCES employment(id) ON DELETE CASCADE,
    PRIMARY KEY (block_id, employment_id)
  );

  CREATE TABLE IF NOT EXISTS block_systems (
    block_id  INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    PRIMARY KEY (block_id, system_id)
  );

  CREATE TABLE IF NOT EXISTS block_projects (
    block_id   INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (block_id, project_id)
  );
`);

// Job match scorecard tables
db.exec(`
  CREATE TABLE IF NOT EXISTS job_match_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id  INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    overall_score   INTEGER NOT NULL,
    recommendation  TEXT NOT NULL,
    summary         TEXT NOT NULL,
    gap_suggestions TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_match_dimensions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    job_match_result_id INTEGER NOT NULL REFERENCES job_match_results(id) ON DELETE CASCADE,
    dimension_name     TEXT NOT NULL,
    score              INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
    weight             REAL NOT NULL,
    feedback           TEXT NOT NULL,
    strengths          TEXT,
    gaps               TEXT,
    evidence           TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );
`);

export default db;
