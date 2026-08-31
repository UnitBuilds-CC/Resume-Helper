import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/:compiled_cv_id', (req, res) => {
  const results = db.prepare(
    'SELECT * FROM red_team_results WHERE compiled_cv_id = ? ORDER BY created_at DESC'
  ).all(req.params.compiled_cv_id) as any[];
  
  const enriched = results.map(r => {
    const dimensions = db.prepare('SELECT * FROM red_team_dimensions WHERE red_team_result_id = ?').all(r.id) as any[];
    const questions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(r.id);
    
    const dimensionsWithParsed = dimensions.map(d => ({
      ...d,
      strengths: d.strengths ? JSON.parse(d.strengths) : [],
      gaps: d.gaps ? JSON.parse(d.gaps) : [],
      evidence: d.evidence ? JSON.parse(d.evidence) : [],
    }));
    
    return {
      ...r,
      red_flags: r.red_flags ? JSON.parse(r.red_flags) : [],
      dimensions: dimensionsWithParsed,
      questions,
    };
  });
  
  res.json(enriched);
});

router.post('/', (req, res) => {
  const { compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, dimensions, red_flags, recommendation, job_fit_summary, questions } = req.body;
  if (!compiled_cv_id) return res.status(400).json({ error: 'compiled_cv_id is required' });

  const result = db.prepare(
    `INSERT INTO red_team_results (compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, recommendation, red_flags, job_fit_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    compiled_cv_id, 
    phase1_qualified ?? 0, 
    phase2_score ?? 0, 
    phase3_summary ?? '', 
    overall_score ?? 0, 
    full_analysis ?? '',
    recommendation ?? null,
    JSON.stringify(red_flags ?? []),
    job_fit_summary ?? null
  );

  const resultId = Number(result.lastInsertRowid);

  if (dimensions?.length) {
    const insertDim = db.prepare(
      'INSERT INTO red_team_dimensions (red_team_result_id, dimension_name, score, weight, feedback, strengths, gaps, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const dim of dimensions) {
      insertDim.run(
        resultId,
        dim.dimension_name,
        dim.score,
        dim.weight,
        dim.feedback,
        JSON.stringify(dim.strengths ?? []),
        JSON.stringify(dim.gaps ?? []),
        JSON.stringify(dim.evidence ?? [])
      );
    }
  }

  if (questions?.length) {
    const insertQ = db.prepare(
      'INSERT INTO questions (red_team_result_id, question, context, skill_tag) VALUES (?, ?, ?, ?)'
    );
    for (const q of questions) {
      insertQ.run(resultId, q.question, q.context ?? null, q.skill_tag ?? null);
    }
  }

  const saved = db.prepare('SELECT * FROM red_team_results WHERE id = ?').get(resultId) as any;
  const savedDimensions = db.prepare('SELECT * FROM red_team_dimensions WHERE red_team_result_id = ?').all(resultId) as any[];
  const savedQuestions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(resultId);
  
  const dimensionsWithParsed = savedDimensions.map(d => ({
    ...d,
    strengths: d.strengths ? JSON.parse(d.strengths) : [],
    gaps: d.gaps ? JSON.parse(d.gaps) : [],
    evidence: d.evidence ? JSON.parse(d.evidence) : [],
  }));
  
  res.status(201).json({ 
    ...saved, 
    red_flags: saved.red_flags ? JSON.parse(saved.red_flags) : [],
    dimensions: dimensionsWithParsed,
    questions: savedQuestions 
  });
});

export default router;
