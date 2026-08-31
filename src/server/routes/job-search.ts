import { Router } from 'express';
import { findJobs } from '../services/job-scraper.js';
import db from '../db.js';

const router = Router();

// Search for jobs on job boards
router.get('/search', async (req, res) => {
  const { search, sources } = req.query;
  
  const sourcesList = sources 
    ? (sources as string).split(',') 
    : ['remoteok', 'weworkremotely', 'rustjobs', 'hnwhohiring', 'letsgerrusty'];
  
  const jobs = await findJobs(search as string | undefined, sourcesList);
  
  res.json({ 
    count: jobs.length, 
    jobs,
    search: search || null,
    sources: sourcesList
  });
});

// Import a job from job board to database
router.post('/import', (req, res) => {
  const { title, company, content, url } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  
  const result = db.prepare(
    'INSERT INTO job_postings (title, company, url, content, status, application_status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, company || null, url || null, content, 'active', 'not_applied');
  
  const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(job);
});

// Batch import multiple jobs
router.post('/import-batch', (req, res) => {
  const { jobs } = req.body;
  
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'jobs array is required' });
  }
  
  const insertStmt = db.prepare(
    'INSERT INTO job_postings (title, company, url, content, status, application_status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  
  const imported = [];
  for (const job of jobs) {
    if (job.title && job.description) {
      const result = insertStmt.run(
        job.title,
        job.company || null,
        job.url || null,
        job.description,
        'active',
        'not_applied'
      );
      imported.push(result.lastInsertRowid);
    }
  }
  
  const jobs_list = db.prepare(
    `SELECT * FROM job_postings WHERE id IN (${imported.map(() => '?').join(',')})`
  ).all(...imported);
  
  res.status(201).json({ 
    imported: imported.length, 
    jobs: jobs_list 
  });
});

export default router;
