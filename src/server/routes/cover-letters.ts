import { Router } from 'express';
import db from '../db.js';
import { generateCoverLetter } from '../services/cover-letter-generator.js';
import { generatePdf } from '../services/pdf-generator.js';
import { generateDocx } from '../services/docx-generator.js';

const router = Router();

// GET /api/cover-letters - List all cover letters with job info
router.get('/', (_req, res) => {
  const coverLetters = db.prepare(`
    SELECT cl.*, jp.title as job_title, jp.company as job_company
    FROM cover_letters cl
    JOIN job_postings jp ON jp.id = cl.job_posting_id
    ORDER BY cl.updated_at DESC
  `).all();
  res.json(coverLetters);
});

// GET /api/cover-letters/:job_posting_id - Get latest cover letter for a job
router.get('/:job_posting_id', (req, res, next) => {
  const jobPostingId = Number(req.params.job_posting_id);
  if (isNaN(jobPostingId)) {
    return next();
  }
  const coverLetter = db.prepare(`
    SELECT cl.*, jp.title as job_title, jp.company as job_company
    FROM cover_letters cl
    JOIN job_postings jp ON jp.id = cl.job_posting_id
    WHERE cl.job_posting_id = ?
    ORDER BY cl.version DESC
    LIMIT 1
  `).get(jobPostingId);
  
  if (!coverLetter) {
    return res.status(404).json({ error: 'Cover letter not found' });
  }
  res.json(coverLetter);
});

// GET /api/cover-letters/download/:id - Export as PDF
router.get('/download/:id', async (req, res) => {
  const coverLetter = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(req.params.id) as any;
  if (!coverLetter) {
    return res.status(404).json({ error: 'Cover letter not found' });
  }
  
  try {
    const pdf = await generatePdf({
      name: '',
      title: '',
      contact: '',
      summary: '',
      content: coverLetter.content,
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cover-letter-${coverLetter.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

// Word, because a cover letter is something people edit before sending. Same empty header contract as the
// PDF route: a letter carries no name band, so nothing is invented for it.
router.get('/download/:id/docx', async (req, res) => {
  const coverLetter = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(req.params.id) as any;
  if (!coverLetter) {
    return res.status(404).json({ error: 'Cover letter not found' });
  }

  try {
    const bytes = await generateDocx({
      name: '',
      title: '',
      contact: '',
      summary: '',
      content: coverLetter.content,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="cover-letter-${coverLetter.id}.docx"`);
    res.send(Buffer.from(bytes));
  } catch (error) {
    res.status(500).json({ error: 'Word generation failed' });
  }
});

// GET /api/cover-letters/:job_posting_id/:version - Get specific version
router.get('/:job_posting_id/:version', (req, res, next) => {
  const jobPostingId = Number(req.params.job_posting_id);
  const version = Number(req.params.version);
  
  if (isNaN(jobPostingId) || isNaN(version)) {
    return next();
  }
  const coverLetter = db.prepare(`
    SELECT cl.*, jp.title as job_title, jp.company as job_company
    FROM cover_letters cl
    JOIN job_postings jp ON jp.id = cl.job_posting_id
    WHERE cl.job_posting_id = ? AND cl.version = ?
  `).get(jobPostingId, version);
  
  if (!coverLetter) {
    return res.status(404).json({ error: 'Cover letter version not found' });
  }
  res.json(coverLetter);
});

// POST /api/cover-letters/:job_posting_id - Generate new cover letter
router.post('/:job_posting_id', (req, res) => {
  const jobPostingId = Number(req.params.job_posting_id);
  
  // Get job posting
  const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(jobPostingId) as any;
  if (!jobPosting) {
    return res.status(404).json({ error: 'Job posting not found' });
  }
  
  // Get template CV
  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  
  // Get systems and blocks
  const systemRows = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all() as any[];
  const systems = systemRows.map(s => ({
    id: s.id,
    title: s.name,
    name: s.name,
    description: s.description,
    industry: s.industry,
    notes: s.notes,
  }));
  const blockRows = db.prepare(`
    SELECT b.*, GROUP_CONCAT(s.name) as skill_names
    FROM blocks b
    LEFT JOIN block_skills bs ON bs.block_id = b.id
    LEFT JOIN skills s ON s.id = bs.skill_id
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `).all() as any[];
  const blocks = blockRows.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    skills: r.skill_names ? r.skill_names.split(',') : [],
    is_generic: r.is_generic === 1,
    target_companies: r.target_companies || '',
  }));
  
  // Get employment
  const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all() as any[];
  
  // Generate cover letter
  const content = generateCoverLetter(jobPosting, templateCv, systems, blocks, employment);
  
  // Get next version number
  const maxVersion = db.prepare(
    'SELECT MAX(version) as max_version FROM cover_letters WHERE job_posting_id = ?'
  ).get(jobPostingId) as any;
  const version = (maxVersion?.max_version ?? 0) + 1;
  
  // Insert cover letter
  const result = db.prepare(
    'INSERT INTO cover_letters (job_posting_id, content, version) VALUES (?, ?, ?)'
  ).run(jobPostingId, content, version);
  
  const coverLetter = db.prepare(`
    SELECT cl.*, jp.title as job_title, jp.company as job_company
    FROM cover_letters cl
    JOIN job_postings jp ON jp.id = cl.job_posting_id
    WHERE cl.id = ?
  `).get(result.lastInsertRowid);
  
  res.status(201).json(coverLetter);
});

// PUT /api/cover-letters/:id - Update cover letter content
router.put('/:id', (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }
  
  db.prepare(
    "UPDATE cover_letters SET content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(content, req.params.id);
  
  const coverLetter = db.prepare(`
    SELECT cl.*, jp.title as job_title, jp.company as job_company
    FROM cover_letters cl
    JOIN job_postings jp ON jp.id = cl.job_posting_id
    WHERE cl.id = ?
  `).get(req.params.id);
  
  res.json(coverLetter);
});

// DELETE /api/cover-letters/:id - Delete cover letter
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM cover_letters WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Cover letter not found' });
  }
  res.json({ deleted: true });
});

export default router;
