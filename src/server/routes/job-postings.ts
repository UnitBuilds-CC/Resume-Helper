import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { status, application_status } = req.query;
  let query = 'SELECT * FROM job_postings';
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (application_status) {
    conditions.push('application_status = ?');
    params.push(application_status);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { title, company, url, content, notes } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  const result = db.prepare(
    'INSERT INTO job_postings (title, company, url, content, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(title, company ?? null, url ?? null, content, notes ?? null);
  const row = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const { title, company, url, content, notes, status, application_status, compiled_cv_id, red_team_result_id } = req.body;
  const existing = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(
    `UPDATE job_postings SET title = COALESCE(?, title), company = COALESCE(?, company),
     url = COALESCE(?, url), content = COALESCE(?, content), notes = COALESCE(?, notes),
     status = COALESCE(?, status), application_status = COALESCE(?, application_status),
     compiled_cv_id = COALESCE(?, compiled_cv_id), red_team_result_id = COALESCE(?, red_team_result_id),
     updated_at = datetime('now') WHERE id = ?`
  ).run(title ?? null, company ?? null, url ?? null, content ?? null,
        notes ?? null, status ?? null, application_status ?? null,
        compiled_cv_id ?? null, red_team_result_id ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id));
});

router.patch('/:id/application-status', (req, res) => {
  const { application_status, compiled_cv_id, red_team_result_id } = req.body;
  const validStatuses = ['not_applied', 'preparing', 'ready_to_apply', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
  if (!application_status || !validStatuses.includes(application_status)) {
    return res.status(400).json({ error: 'valid application_status is required' });
  }
  const existing = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  
  const appliedDate = application_status === 'applied' ? new Date().toISOString() : null;
  
  db.prepare(
    `UPDATE job_postings SET application_status = ?, 
     compiled_cv_id = COALESCE(?, compiled_cv_id),
     red_team_result_id = COALESCE(?, red_team_result_id),
     applied_date = COALESCE(?, applied_date),
     updated_at = datetime('now') WHERE id = ?`
  ).run(application_status, compiled_cv_id ?? null, red_team_result_id ?? null, appliedDate, req.params.id);
  res.json(db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM job_postings WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

export default router;
