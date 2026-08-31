import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getBlockWithSkills(blockId: number) {
  const block = db.prepare('SELECT * FROM blocks WHERE id = ?').get(blockId) as any;
  if (!block) return null;
  const skills = db.prepare(
    `SELECT s.name FROM skills s
     JOIN block_skills bs ON bs.skill_id = s.id
     WHERE bs.block_id = ?`
  ).all(blockId) as { name: string }[];
  
  const employment = db.prepare(
    `SELECT e.id FROM employment e
     JOIN block_employment be ON be.employment_id = e.id
     WHERE be.block_id = ?`
  ).all(blockId) as { id: number }[];
  
  const systems = db.prepare(
    `SELECT s.id FROM systems s
     JOIN block_systems bs ON bs.system_id = s.id
     WHERE bs.block_id = ?`
  ).all(blockId) as { id: number }[];
  
  const projects = db.prepare(
    `SELECT p.id FROM projects p
     JOIN block_projects bp ON bp.project_id = p.id
     WHERE bp.block_id = ?`
  ).all(blockId) as { id: number }[];
  
  return { 
    ...block, 
    skills: skills.map(s => s.name),
    employment_ids: employment.map(e => e.id),
    system_ids: systems.map(s => s.id),
    project_ids: projects.map(p => p.id),
    is_generic: block.is_generic === 1,
    target_companies: block.target_companies || ''
  };
}

function setBlockSkills(blockId: number, skillNames: string[]) {
  db.prepare('DELETE FROM block_skills WHERE block_id = ?').run(blockId);
  const insert = db.prepare('INSERT OR IGNORE INTO skills (name) VALUES (?)');
  const link = db.prepare('INSERT INTO block_skills (block_id, skill_id) VALUES (?, ?)');
  for (const name of skillNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    insert.run(trimmed);
    const skill = db.prepare('SELECT id FROM skills WHERE name = ?').get(trimmed) as { id: number };
    link.run(blockId, skill.id);
  }
}

function setBlockEmployment(blockId: number, employmentIds: number[]) {
  db.prepare('DELETE FROM block_employment WHERE block_id = ?').run(blockId);
  const link = db.prepare('INSERT INTO block_employment (block_id, employment_id) VALUES (?, ?)');
  for (const empId of employmentIds) {
    link.run(blockId, empId);
  }
}

function setBlockSystems(blockId: number, systemIds: number[]) {
  db.prepare('DELETE FROM block_systems WHERE block_id = ?').run(blockId);
  const link = db.prepare('INSERT INTO block_systems (block_id, system_id) VALUES (?, ?)');
  for (const sysId of systemIds) {
    link.run(blockId, sysId);
  }
}

function setBlockProjects(blockId: number, projectIds: number[]) {
  db.prepare('DELETE FROM block_projects WHERE block_id = ?').run(blockId);
  const link = db.prepare('INSERT INTO block_projects (block_id, project_id) VALUES (?, ?)');
  for (const projId of projectIds) {
    link.run(blockId, projId);
  }
}

router.get('/', (req, res) => {
  const { skill, search } = req.query;
  let query = `
    SELECT b.*, GROUP_CONCAT(s.name) as skill_names
    FROM blocks b
    LEFT JOIN block_skills bs ON bs.block_id = b.id
    LEFT JOIN skills s ON s.id = bs.skill_id
  `;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (skill) {
    conditions.push('b.id IN (SELECT bs2.block_id FROM block_skills bs2 JOIN skills s2 ON s2.id = bs2.skill_id WHERE s2.name = ?)');
    params.push(skill);
  }
  if (search) {
    conditions.push('(b.title LIKE ? OR b.content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY b.id ORDER BY b.updated_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  const blocks = rows.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    skills: r.skill_names ? r.skill_names.split(',') : [],
    is_generic: r.is_generic === 1,
    target_companies: r.target_companies || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  res.json(blocks);
});

router.post('/', (req, res) => {
  const { title, content, skills, is_generic, target_companies, employment_ids, system_ids, project_ids } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  const result = db.prepare('INSERT INTO blocks (title, content, is_generic, target_companies) VALUES (?, ?, ?, ?)').run(title, content, is_generic === false ? 0 : 1, target_companies || '');
  const blockId = Number(result.lastInsertRowid);
  if (skills?.length) setBlockSkills(blockId, skills);
  if (employment_ids?.length) setBlockEmployment(blockId, employment_ids);
  if (system_ids?.length) setBlockSystems(blockId, system_ids);
  if (project_ids?.length) setBlockProjects(blockId, project_ids);
  res.status(201).json(getBlockWithSkills(blockId));
});

router.put('/:id', (req, res) => {
  const { title, content, skills, is_generic, target_companies, employment_ids, system_ids, project_ids } = req.body;
  const existing = db.prepare('SELECT * FROM blocks WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'not found' });

  db.prepare(
    `UPDATE blocks SET title = COALESCE(?, title), content = COALESCE(?, content),
     is_generic = COALESCE(?, is_generic), target_companies = COALESCE(?, target_companies),
     updated_at = datetime('now') WHERE id = ?`
  ).run(title ?? null, content ?? null, is_generic !== undefined ? (is_generic ? 1 : 0) : null, target_companies ?? null, req.params.id);

  if (skills !== undefined) setBlockSkills(Number(req.params.id), skills);
  if (employment_ids !== undefined) setBlockEmployment(Number(req.params.id), employment_ids);
  if (system_ids !== undefined) setBlockSystems(Number(req.params.id), system_ids);
  if (project_ids !== undefined) setBlockProjects(Number(req.params.id), project_ids);
  res.json(getBlockWithSkills(Number(req.params.id)));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM block_skills WHERE block_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM blocks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

export default router;
