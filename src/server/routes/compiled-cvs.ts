import { Router } from 'express';
import db from '../db.js';
import { generatePdf } from '../services/pdf-generator.js';
import { validateForAts } from '../services/ats-validator.js';

const router = Router();

router.get('/', (req, res) => {
  const { job_posting_id } = req.query;
  let query = `
    SELECT cc.*, jp.title as job_title, jp.company as job_company
    FROM compiled_cvs cc
    JOIN job_postings jp ON jp.id = cc.job_posting_id
  `;
  const params: unknown[] = [];
  if (job_posting_id) {
    query += ' WHERE cc.job_posting_id = ?';
    params.push(job_posting_id);
  }
  query += ' ORDER BY cc.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { job_posting_id, content } = req.body;
  if (!job_posting_id || !content) return res.status(400).json({ error: 'job_posting_id and content are required' });
  const existing = db.prepare('SELECT MAX(version) as max_version FROM compiled_cvs WHERE job_posting_id = ?').get(job_posting_id) as any;
  const version = (existing?.max_version ?? 0) + 1;
  const result = db.prepare('INSERT INTO compiled_cvs (job_posting_id, content, version) VALUES (?, ?, ?)').run(job_posting_id, content, version);
  res.status(201).json(db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const { content } = req.body;
  db.prepare("UPDATE compiled_cvs SET content = COALESCE(?, content), updated_at = datetime('now') WHERE id = ?").run(content ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM compiled_cvs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

router.get('/:id/pdf', async (req, res) => {
  const cv = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(req.params.id) as any;
  if (!cv) return res.status(404).json({ error: 'not found' });

  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(cv.job_posting_id) as any;
  const contact = [templateCv?.email, templateCv?.phone, templateCv?.location, templateCv?.linkedin, templateCv?.website].filter(Boolean).join(' | ');

  const keywords: string[] = [];
  if (jobPosting) {
    const text = `${jobPosting.title || ''} ${jobPosting.description || ''} ${jobPosting.requirements || ''}`.toLowerCase();
    const techKeywords = [
      'rust', 'typescript', 'python', 'go', 'docker', 'kubernetes', 'aws', 'gcp',
      'postgres', 'react', 'node', 'api', 'backend', 'remote', 'microservices',
    ];
    keywords.push(...techKeywords.filter(kw => text.includes(kw)));
  }

  try {
    const pdf = await generatePdf({
      name: templateCv?.full_name || 'Your Name',
      title: templateCv?.professional_title || '',
      contact,
      summary: templateCv?.summary || '',
      content: cv.content,
      jobTitle: jobPosting?.title || '',
      jobCompany: jobPosting?.company || '',
      keywords,
    });
    res.setHeader('Content-Type', 'application/pdf');
    const filename = jobPosting
      ? `${templateCv?.full_name?.replace(/\s+/g, '_') || 'CV'}_${jobPosting.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'CV'}.pdf`
      : `cv-${cv.id}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/validate', (req, res) => {
  try {
    const result = validateForAts(db, Number(req.params.id));
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    res.status(400).json({ error: message });
  }
});

export default router;
