import { Router } from 'express';
import db from '../db.js';
import {
  createJobPosting, deleteJobPosting, setApplicationStatus, updateJobPosting,
} from '../services/job-posting-store.js';

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
  res.status(201).json(createJobPosting(db, req.body));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  res.json(updateJobPosting(db, Number(req.params.id), req.body));
});

router.patch('/:id/application-status', (req, res) => {
  res.json(setApplicationStatus(db, Number(req.params.id), req.body));
});

router.delete('/:id', (req, res) => {
  res.json(deleteJobPosting(db, req.params.id));
});

export default router;
