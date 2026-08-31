import { Router } from 'express';
import db from '../db.js';
import { analyzeJobMatch } from '../services/job-match-analyzer.js';

const router = Router();

router.get('/', (_req, res) => {
  const results = db.prepare(
    `SELECT r.*, j.title as job_title, j.company as job_company
     FROM job_match_results r
     JOIN job_postings j ON j.id = r.job_posting_id
     ORDER BY r.created_at DESC`
  ).all() as any[];

  const enriched = results.map(r => {
    const dimensions = db.prepare(
      'SELECT * FROM job_match_dimensions WHERE job_match_result_id = ?'
    ).all(r.id) as any[];

    return {
      ...r,
      gap_suggestions: r.gap_suggestions ? JSON.parse(r.gap_suggestions) : [],
      dimensions: dimensions.map(d => ({
        ...d,
        strengths: d.strengths ? JSON.parse(d.strengths) : [],
        gaps: d.gaps ? JSON.parse(d.gaps) : [],
        evidence: d.evidence ? JSON.parse(d.evidence) : [],
      })),
    };
  });

  res.json(enriched);
});

router.get('/:jobId', (req, res) => {
  const results = db.prepare(
    `SELECT r.*, j.title as job_title, j.company as job_company
     FROM job_match_results r
     JOIN job_postings j ON j.id = r.job_posting_id
     WHERE r.job_posting_id = ?
     ORDER BY r.created_at DESC`
  ).all(req.params.jobId) as any[];

  const enriched = results.map(r => {
    const dimensions = db.prepare(
      'SELECT * FROM job_match_dimensions WHERE job_match_result_id = ?'
    ).all(r.id) as any[];

    return {
      ...r,
      gap_suggestions: r.gap_suggestions ? JSON.parse(r.gap_suggestions) : [],
      dimensions: dimensions.map(d => ({
        ...d,
        strengths: d.strengths ? JSON.parse(d.strengths) : [],
        gaps: d.gaps ? JSON.parse(d.gaps) : [],
        evidence: d.evidence ? JSON.parse(d.evidence) : [],
      })),
    };
  });

  res.json(enriched);
});

router.post('/analyze', (req, res) => {
  const { job_posting_id } = req.body;
  if (!job_posting_id) return res.status(400).json({ error: 'job_posting_id is required' });

  const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
  if (!jobPosting) return res.status(404).json({ error: 'Job posting not found' });

  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order').all() as any[];
  const education = db.prepare('SELECT * FROM education ORDER BY sort_order').all() as any[];
  const systems = db.prepare('SELECT * FROM systems').all() as any[];
  const blocks = db.prepare(
    `SELECT b.*, GROUP_CONCAT(s.name) as skill_names
     FROM blocks b
     LEFT JOIN block_skills bs ON bs.block_id = b.id
     LEFT JOIN skills s ON s.id = bs.skill_id
     GROUP BY b.id`
  ).all() as any[];
  const projects = db.prepare('SELECT * FROM projects').all() as any[];
  const allSkills = db.prepare('SELECT name FROM skills').all() as any[];

  const blocksWithSkills = blocks.map(b => ({
    ...b,
    skills: b.skill_names ? b.skill_names.split(',') : [],
  }));

  const result = analyzeJobMatch(jobPosting, {
    templateCv,
    employment,
    education,
    systems,
    blocks: blocksWithSkills,
    projects,
    allSkills: allSkills.map(s => s.name),
  });

  const insertResult = db.prepare(
    `INSERT INTO job_match_results (job_posting_id, overall_score, recommendation, summary, gap_suggestions)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    job_posting_id,
    result.overall_score,
    result.recommendation,
    result.summary,
    JSON.stringify(result.gap_suggestions)
  );

  const resultId = Number(insertResult.lastInsertRowid);

  const insertDim = db.prepare(
    `INSERT INTO job_match_dimensions (job_match_result_id, dimension_name, score, weight, feedback, strengths, gaps, evidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const dim of result.dimensions) {
    insertDim.run(
      resultId,
      dim.dimension_name,
      dim.score,
      dim.weight,
      dim.feedback,
      JSON.stringify(dim.strengths),
      JSON.stringify(dim.gaps),
      JSON.stringify(dim.evidence)
    );
  }

  const saved = db.prepare(
    `SELECT r.*, j.title as job_title, j.company as job_company
     FROM job_match_results r
     JOIN job_postings j ON j.id = r.job_posting_id
     WHERE r.id = ?`
  ).get(resultId) as any;

  const savedDimensions = db.prepare(
    'SELECT * FROM job_match_dimensions WHERE job_match_result_id = ?'
  ).all(resultId) as any[];

  res.status(201).json({
    ...saved,
    gap_suggestions: saved.gap_suggestions ? JSON.parse(saved.gap_suggestions) : [],
    dimensions: savedDimensions.map(d => ({
      ...d,
      strengths: d.strengths ? JSON.parse(d.strengths) : [],
      gaps: d.gaps ? JSON.parse(d.gaps) : [],
      evidence: d.evidence ? JSON.parse(d.evidence) : [],
    })),
  });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM job_match_results WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

export default router;
