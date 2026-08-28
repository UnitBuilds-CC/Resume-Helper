import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/:compiled_cv_id', (req, res) => {
  const results = db.prepare(
    'SELECT * FROM red_team_results WHERE compiled_cv_id = ? ORDER BY created_at DESC'
  ).all(req.params.compiled_cv_id);
  const enriched = (results as any[]).map(r => ({
    ...r,
    questions: db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(r.id),
  }));
  res.json(enriched);
});

router.post('/', (req, res) => {
  const { compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, questions } = req.body;
  if (!compiled_cv_id) return res.status(400).json({ error: 'compiled_cv_id is required' });

  const result = db.prepare(
    `INSERT INTO red_team_results (compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(compiled_cv_id, phase1_qualified ?? 0, phase2_score ?? 0, phase3_summary ?? '', overall_score ?? 0, full_analysis ?? '');

  const resultId = Number(result.lastInsertRowid);

  if (questions?.length) {
    const insertQ = db.prepare(
      'INSERT INTO questions (red_team_result_id, question, context, skill_tag) VALUES (?, ?, ?, ?)'
    );
    for (const q of questions) {
      insertQ.run(resultId, q.question, q.context ?? null, q.skill_tag ?? null);
    }
  }

  const saved = db.prepare('SELECT * FROM red_team_results WHERE id = ?').get(resultId);
  const savedQuestions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(resultId);
  res.status(201).json({ ...saved, questions: savedQuestions });
});

export default router;
