import type Database from 'better-sqlite3';
import { StoreError } from './job-posting-store.js';

export interface BlockInput {
  title?: unknown;
  content?: unknown;
  skills?: unknown;
  is_generic?: unknown;
  target_companies?: unknown;
  employment_ids?: unknown;
  system_ids?: unknown;
  project_ids?: unknown;
}

const idsFrom = (csv: unknown) => (csv ? String(csv).split(',').map(Number) : []);

/**
 * The list shape the edit form round-trips. It has to include the link ids: without them the form posts
 * empty arrays, PUT treats a defined array as authoritative, and saving a block deletes its links.
 */
export function listBlocks(db: Database.Database, filters: { skill?: unknown; search?: unknown; id?: number } = {}) {
  let query = `
    SELECT b.*, GROUP_CONCAT(DISTINCT s.name) as skill_names,
      (SELECT GROUP_CONCAT(be.employment_id) FROM block_employment be WHERE be.block_id = b.id) AS employment_id_csv,
      (SELECT GROUP_CONCAT(bsy.system_id) FROM block_systems bsy WHERE bsy.block_id = b.id) AS system_id_csv,
      (SELECT GROUP_CONCAT(bpr.project_id) FROM block_projects bpr WHERE bpr.block_id = b.id) AS project_id_csv
    FROM blocks b
    LEFT JOIN block_skills bs ON bs.block_id = b.id
    LEFT JOIN skills s ON s.id = bs.skill_id
  `;
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.id != null) {
    conditions.push('b.id = ?');
    params.push(filters.id);
  }
  if (filters.skill) {
    conditions.push('b.id IN (SELECT bs2.block_id FROM block_skills bs2 JOIN skills s2 ON s2.id = bs2.skill_id WHERE s2.name = ?)');
    params.push(String(filters.skill));
  }
  if (filters.search) {
    conditions.push('(b.title LIKE ? OR b.content LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY b.id ORDER BY b.updated_at DESC';

  return (db.prepare(query).all(...params) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    skills: r.skill_names ? String(r.skill_names).split(',') : [],
    employment_ids: idsFrom(r.employment_id_csv),
    system_ids: idsFrom(r.system_id_csv),
    project_ids: idsFrom(r.project_id_csv),
    is_generic: r.is_generic === 1,
    target_companies: r.target_companies || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function readBlock(db: Database.Database, id: number) {
  const found = listBlocks(db, { id })[0];
  if (!found) throw new StoreError('block ' + id + ' does not exist', [], 404);
  return found;
}

function assertKnownIds(db: Database.Database, table: string, column: string, label: string, ids: number[], problems: string[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const known = new Set(
    (db.prepare(`SELECT ${column} AS id FROM ${table} WHERE ${column} IN (${placeholders})`).all(...ids) as { id: number }[])
      .map((r) => r.id)
  );
  const unknown = ids.filter((i) => !known.has(i));
  if (unknown.length) problems.push(label + ' references unknown id(s): ' + unknown.join(', '));
}

const asIdList = (value: unknown, label: string, problems: string[]): number[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) { problems.push(label + ' must be an array of ids'); return []; }
  const bad = value.filter((v) => typeof v !== 'number' || !Number.isInteger(v));
  if (bad.length) problems.push(label + ' must contain integers (got ' + JSON.stringify(bad.slice(0, 3)) + ')');
  return value.filter((v): v is number => typeof v === 'number' && Number.isInteger(v));
};

function writeSkills(db: Database.Database, blockId: number, names: unknown) {
  db.prepare('DELETE FROM block_skills WHERE block_id = ?').run(blockId);
  if (!Array.isArray(names)) return;
  const insert = db.prepare('INSERT OR IGNORE INTO skills (name) VALUES (?)');
  const link = db.prepare('INSERT INTO block_skills (block_id, skill_id) VALUES (?, ?)');
  for (const name of names) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) continue;
    insert.run(trimmed);
    const skill = db.prepare('SELECT id FROM skills WHERE name = ?').get(trimmed) as { id: number };
    link.run(blockId, skill.id);
  }
}

function relink(db: Database.Database, table: string, column: string, blockId: number, ids: number[]) {
  db.prepare(`DELETE FROM ${table} WHERE block_id = ?`).run(blockId);
  const link = db.prepare(`INSERT INTO ${table} (block_id, ${column}) VALUES (?, ?)`);
  for (const id of ids) link.run(blockId, id);
}

/**
 * Validates both directions before writing: the block's own fields, and that every link target exists.
 * Previously an unknown id reached SQLite's foreign key and surfaced as an unhandled 500.
 */
export function saveBlockLinks(
  db: Database.Database,
  blockId: number,
  input: BlockInput,
  options: { replaceSkills: boolean; replaceLinks: boolean }
) {
  const problems: string[] = [];
  const employmentIds = asIdList(input.employment_ids, 'employment_ids', problems);
  const systemIds = asIdList(input.system_ids, 'system_ids', problems);
  const projectIds = asIdList(input.project_ids, 'project_ids', problems);

  assertKnownIds(db, 'employment', 'id', 'employment_ids', employmentIds, problems);
  assertKnownIds(db, 'systems', 'id', 'system_ids', systemIds, problems);
  assertKnownIds(db, 'projects', 'id', 'project_ids', projectIds, problems);
  if (input.skills !== undefined && !Array.isArray(input.skills)) problems.push('skills must be an array of names');

  if (problems.length) throw new StoreError('block links rejected', problems);

  const write = db.transaction(() => {
    if (options.replaceSkills && input.skills !== undefined) writeSkills(db, blockId, input.skills);
    if (options.replaceLinks) {
      // Absent means "leave alone"; an explicit empty list means "unlink everything", which is what the
      // form now sends when the user really clears a field.
      if (input.employment_ids !== undefined) relink(db, 'block_employment', 'employment_id', blockId, employmentIds);
      if (input.system_ids !== undefined) relink(db, 'block_systems', 'system_id', blockId, systemIds);
      if (input.project_ids !== undefined) relink(db, 'block_projects', 'project_id', blockId, projectIds);
    }
  });
  write();
}

export function createBlock(db: Database.Database, input: BlockInput) {
  if (typeof input.title !== 'string' || !input.title.trim()) throw new StoreError('title is required');
  if (typeof input.content !== 'string' || !input.content.trim()) throw new StoreError('content is required');

  const problems: string[] = [];
  const employmentIds = asIdList(input.employment_ids, 'employment_ids', problems);
  const systemIds = asIdList(input.system_ids, 'system_ids', problems);
  const projectIds = asIdList(input.project_ids, 'project_ids', problems);
  assertKnownIds(db, 'employment', 'id', 'employment_ids', employmentIds, problems);
  assertKnownIds(db, 'systems', 'id', 'system_ids', systemIds, problems);
  assertKnownIds(db, 'projects', 'id', 'project_ids', projectIds, problems);
  if (problems.length) throw new StoreError('block rejected', problems);

  const created = db.transaction(() => {
    const result = db.prepare('INSERT INTO blocks (title, content, is_generic, target_companies) VALUES (?, ?, ?, ?)')
      .run(input.title, input.content, input.is_generic === false ? 0 : 1, String(input.target_companies ?? ''));
    const blockId = Number(result.lastInsertRowid);
    writeSkills(db, blockId, input.skills);
    relink(db, 'block_employment', 'employment_id', blockId, employmentIds);
    relink(db, 'block_systems', 'system_id', blockId, systemIds);
    relink(db, 'block_projects', 'project_id', blockId, projectIds);
    return blockId;
  });
  return readBlock(db, created());
}

export function updateBlock(db: Database.Database, id: number, input: BlockInput) {
  readBlock(db, id);
  db.prepare(
    `UPDATE blocks SET title = COALESCE(?, title), content = COALESCE(?, content),
     is_generic = COALESCE(?, is_generic), target_companies = COALESCE(?, target_companies),
     updated_at = datetime('now') WHERE id = ?`
  ).run(
    typeof input.title === 'string' ? input.title : null,
    typeof input.content === 'string' ? input.content : null,
    input.is_generic === undefined ? null : (input.is_generic ? 1 : 0),
    input.target_companies === undefined ? null : String(input.target_companies),
    id
  );
  saveBlockLinks(db, id, input, { replaceSkills: true, replaceLinks: true });
  return readBlock(db, id);
}

export function deleteBlock(db: Database.Database, id: number) {
  const removed = db.transaction(() => {
    db.prepare('DELETE FROM block_skills WHERE block_id = ?').run(id);
    db.prepare('DELETE FROM block_employment WHERE block_id = ?').run(id);
    db.prepare('DELETE FROM block_systems WHERE block_id = ?').run(id);
    db.prepare('DELETE FROM block_projects WHERE block_id = ?').run(id);
    return db.prepare('DELETE FROM blocks WHERE id = ?').run(id).changes;
  });
  if (removed() === 0) throw new StoreError('block ' + id + ' does not exist', [], 404);
  return { deleted: true, id };
}
