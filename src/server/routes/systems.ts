import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, description, industry, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(
    'INSERT INTO systems (name, description, industry, notes) VALUES (?, ?, ?, ?)'
  ).run(name, description ?? null, industry ?? null, notes ?? null);
  const row = db.prepare('SELECT * FROM systems WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const { name, description, industry, notes } = req.body;
  db.prepare(
    `UPDATE systems SET name = COALESCE(?, name), description = COALESCE(?, description),
     industry = COALESCE(?, industry), notes = COALESCE(?, notes),
     updated_at = datetime('now') WHERE id = ?`
  ).run(name ?? null, description ?? null, industry ?? null, notes ?? null, req.params.id);
  const row = db.prepare('SELECT * FROM systems WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM systems WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

export default router;
