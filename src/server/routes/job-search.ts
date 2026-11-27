import { Router } from 'express';
import { findJobs } from '../services/job-scraper.js';
import db from '../db.js';
import { createJobPosting } from '../services/job-posting-store.js';

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
  res.status(201).json(createJobPosting(db, req.body));
});

// Batch import multiple jobs
router.post('/import-batch', (req, res) => {
  const { jobs } = req.body;
  
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'jobs array is required' });
  }
  
  const imported: number[] = [];
  const importAll = db.transaction(() => {
    for (const job of jobs) {
      if (!job?.title || !job?.description) continue;
      const row = createJobPosting(db, {
        title: job.title,
        company: job.company ?? null,
        url: job.url ?? null,
        content: job.description,
      }) as { id: number };
      imported.push(row.id);
    }
  });
  importAll();

  // An empty result set used to build `IN ()`, which SQLite rejects, so a batch with nothing importable 500ed.
  const jobs_list = imported.length
    ? db.prepare(`SELECT * FROM job_postings WHERE id IN (${imported.map(() => '?').join(',')})`).all(...imported)
    : [];
  
  res.status(201).json({ 
    imported: imported.length, 
    jobs: jobs_list 
  });
});

export default router;
