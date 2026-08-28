import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT q.*, cc.job_posting_id, jp.title as job_title, jp.company as job_company
    FROM questions q
    JOIN red_team_results rt ON rt.id = q.red_team_result_id
    JOIN compiled_cvs cc ON cc.id = rt.compiled_cv_id
    JOIN job_postings jp ON jp.id = cc.job_posting_id
  `;
  const params: unknown[] = [];
  if (status) { query += ' WHERE q.status = ?'; params.push(status); }
  query += ' ORDER BY q.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.put('/:id', (req, res) => {
  const { status, answer } = req.body;
  db.prepare(
    "UPDATE questions SET status = COALESCE(?, status), answer = COALESCE(?, answer) WHERE id = ?"
  ).run(status ?? null, answer ?? null, req.params.id);
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

export default router;
