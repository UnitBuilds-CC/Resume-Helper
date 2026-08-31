import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all projects
router.get('/', (_req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects);
});

// Get single project
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

// Create project
router.post('/', (req, res) => {
  const { name, description, url, github_url, demo_url, technologies, start_date, end_date, category } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  
  const result = db.prepare(
    'INSERT INTO projects (name, description, url, github_url, demo_url, technologies, start_date, end_date, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name, 
    description ?? null, 
    url ?? null, 
    github_url ?? null, 
    demo_url ?? null, 
    technologies ?? null,
    start_date ?? null,
    end_date ?? null,
    category ?? 'personal'
  );
  
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// Update project
router.put('/:id', (req, res) => {
  const { name, description, url, github_url, demo_url, technologies, start_date, end_date, category } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  db.prepare(
    `UPDATE projects SET 
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      url = COALESCE(?, url),
      github_url = COALESCE(?, github_url),
      demo_url = COALESCE(?, demo_url),
      technologies = COALESCE(?, technologies),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      category = COALESCE(?, category),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? null,
    description ?? null,
    url ?? null,
    github_url ?? null,
    demo_url ?? null,
    technologies ?? null,
    start_date ?? null,
    end_date ?? null,
    category ?? null,
    req.params.id
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// Delete project
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

export default router;
