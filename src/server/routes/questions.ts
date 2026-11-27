import { Router } from 'express';
import db from '../db.js';
import { StoreError } from '../services/job-posting-store.js';

const router = Router();

export const QUESTION_STATUSES = ['pending', 'answered', 'dismissed'] as const;

router.get('/', (req, res) => {
  const { status, job_posting_id, red_team_result_id } = req.query;
  let query = `
    SELECT q.*, cc.job_posting_id, jp.title as job_title, jp.company as job_company
    FROM questions q
    JOIN red_team_results rt ON rt.id = q.red_team_result_id
    JOIN compiled_cvs cc ON cc.id = rt.compiled_cv_id
    JOIN job_postings jp ON jp.id = cc.job_posting_id
  `;
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    if (!(QUESTION_STATUSES as readonly string[]).includes(String(status))) {
      throw new StoreError('status must be one of ' + QUESTION_STATUSES.join(', '));
    }
    conditions.push('q.status = ?');
    params.push(status);
  }
  // Without these, the Questions page could not show the questions belonging to the CV in front of you.
  if (job_posting_id) {
    conditions.push('cc.job_posting_id = ?');
    params.push(Number(job_posting_id));
  }
  if (red_team_result_id) {
    conditions.push('q.red_team_result_id = ?');
    params.push(Number(red_team_result_id));
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY q.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!row) throw new StoreError('question ' + String(req.params.id) + ' does not exist', [], 404);
  res.json(row);
});

router.put('/:id', (req, res) => {
  const { status, answer } = req.body;
  const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
  if (!existing) throw new StoreError('question ' + String(req.params.id) + ' does not exist', [], 404);
  if (status !== undefined && !(QUESTION_STATUSES as readonly string[]).includes(String(status))) {
    throw new StoreError('status must be one of ' + QUESTION_STATUSES.join(', '));
  }

  // answer is nullable on purpose: clearing an answer is a legitimate edit, so absence means keep and
  // an explicit null means clear - COALESCE could not express the difference.
  const sets: string[] = [];
  const params: unknown[] = [];
  if (status !== undefined) { sets.push('status = ?'); params.push(status ?? null); }
  if ('answer' in req.body) { sets.push('answer = ?'); params.push(req.body.answer ?? null); }
  if (sets.length) db.prepare('UPDATE questions SET ' + sets.join(', ') + ' WHERE id = ?').run(...params, req.params.id);

  res.json(db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id));
});

// A dismissed-by-mistake or duplicated question had no way out: there was neither DELETE nor a way back to
// pending from the UI, and red_team_result_id was the only writer of rows.
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw new StoreError('question ' + String(req.params.id) + ' does not exist', [], 404);
  res.json({ deleted: true, id: Number(req.params.id) });
});

export default router;
