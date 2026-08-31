import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all application questions for a job posting
router.get('/questions/:job_posting_id', (req, res) => {
  const questions = db.prepare(
    'SELECT * FROM application_questions WHERE job_posting_id = ? ORDER BY sort_order'
  ).all(req.params.job_posting_id);
  res.json(questions);
});

// Add a question to a job posting
router.post('/questions', (req, res) => {
  const { job_posting_id, question, question_type, sort_order } = req.body;
  if (!job_posting_id || !question) {
    return res.status(400).json({ error: 'job_posting_id and question are required' });
  }
  
  const result = db.prepare(
    'INSERT INTO application_questions (job_posting_id, question, question_type, sort_order) VALUES (?, ?, ?, ?)'
  ).run(job_posting_id, question, question_type ?? 'text', sort_order ?? 0);
  
  const questionRow = db.prepare('SELECT * FROM application_questions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(questionRow);
});

// Update a question
router.put('/questions/:id', (req, res) => {
  const { question, question_type, sort_order } = req.body;
  db.prepare(
    `UPDATE application_questions SET 
     question = COALESCE(?, question),
     question_type = COALESCE(?, question_type),
     sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(question ?? null, question_type ?? null, sort_order ?? null, req.params.id);
  
  const questionRow = db.prepare('SELECT * FROM application_questions WHERE id = ?').get(req.params.id);
  if (!questionRow) return res.status(404).json({ error: 'not found' });
  res.json(questionRow);
});

// Delete a question
router.delete('/questions/:id', (req, res) => {
  const result = db.prepare('DELETE FROM application_questions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

// Get all answers for a job posting
router.get('/answers/:job_posting_id', (req, res) => {
  const answers = db.prepare(`
    SELECT aa.*, aq.question, aq.sort_order
    FROM application_answers aa
    JOIN application_questions aq ON aq.id = aa.question_id
    WHERE aa.job_posting_id = ?
    ORDER BY aq.sort_order
  `).all(req.params.job_posting_id);
  
  res.json(answers);
});

// Save an answer
router.post('/answers', (req, res) => {
  const { job_posting_id, question_id, answer, is_auto_generated } = req.body;
  if (!job_posting_id || !question_id || !answer) {
    return res.status(400).json({ error: 'job_posting_id, question_id, and answer are required' });
  }
  
  // Check if answer already exists
  const existing = db.prepare(
    'SELECT id FROM application_answers WHERE job_posting_id = ? AND question_id = ?'
  ).get(job_posting_id, question_id);
  
  if (existing) {
    // Update existing answer
    db.prepare(
      `UPDATE application_answers SET answer = ?, is_auto_generated = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(answer, is_auto_generated ? 1 : 0, existing.id);
    
    const answerRow = db.prepare('SELECT * FROM application_answers WHERE id = ?').get(existing.id);
    res.json(answerRow);
  } else {
    // Create new answer
    const result = db.prepare(
      `INSERT INTO application_answers (job_posting_id, question_id, answer, is_auto_generated)
       VALUES (?, ?, ?, ?)`
    ).run(job_posting_id, question_id, answer, is_auto_generated ? 1 : 0);
    
    const answerRow = db.prepare('SELECT * FROM application_answers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(answerRow);
  }
});

// Delete an answer
router.delete('/answers/:id', (req, res) => {
  const result = db.prepare('DELETE FROM application_answers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

// Get all questions and answers for a job posting (combined)
router.get('/all/:job_posting_id', (req, res) => {
  const questions = db.prepare(
    'SELECT * FROM application_questions WHERE job_posting_id = ? ORDER BY sort_order'
  ).all(req.params.job_posting_id);
  
  const answers = db.prepare(
    'SELECT * FROM application_answers WHERE job_posting_id = ?'
  ).all(req.params.job_posting_id);
  
  const answerMap = new Map(answers.map((a: any) => [a.question_id, a]));
  
  const result = questions.map((q: any) => ({
    ...q,
    answer: answerMap.get(q.id)?.answer || null,
    is_auto_generated: answerMap.get(q.id)?.is_auto_generated || 0
  }));
  
  res.json(result);
});

export default router;
