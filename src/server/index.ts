import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import db from './db.js';
import systemsRouter from './routes/systems.js';
import blocksRouter from './routes/blocks.js';
import skillsRouter from './routes/skills.js';
import templateCvRouter from './routes/template-cv.js';
import jobPostingsRouter from './routes/job-postings.js';
import importRouter from './routes/import.js';
import compiledCvsRouter from './routes/compiled-cvs.js';
import redTeamRouter from './routes/red-team.js';
import questionsRouter from './routes/questions.js';
import questionnairesRouter from './routes/questionnaires.js';
import jobSearchRouter from './routes/job-search.js';
import gitRouter from './routes/git.js';
import coverLettersRouter from './routes/cover-letters.js';
import projectsRouter from './routes/projects.js';
import jobMatchRouter from './routes/job-match.js';

const __dirname = typeof import.meta.url === 'string'
  ? dirname(fileURLToPath(import.meta.url))
  : dirname(__filename);
const app = express();
const PORT = 3000;

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/systems', systemsRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/template-cv', templateCvRouter);
app.use('/api/job-postings', jobPostingsRouter);
app.use('/api/import', importRouter);
app.use('/api/compiled-cvs', compiledCvsRouter);
app.use('/api/red-team', redTeamRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/questionnaires', questionnairesRouter);
app.use('/api/job-search', jobSearchRouter);
app.use('/api/git', gitRouter);
app.use('/api/cover-letters', coverLettersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/job-match', jobMatchRouter);

app.get('/api/dashboard', (_req, res) => {
  const systems_count = (db.prepare('SELECT COUNT(*) as c FROM systems').get() as any).c;
  const blocks_count = (db.prepare('SELECT COUNT(*) as c FROM blocks').get() as any).c;
  const skills_count = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any).c;
  const job_postings_count = (db.prepare('SELECT COUNT(*) as c FROM job_postings').get() as any).c;
  const compiled_cvs_count = (db.prepare('SELECT COUNT(*) as c FROM compiled_cvs').get() as any).c;
  const pending_questions_count = (db.prepare("SELECT COUNT(*) as c FROM questions WHERE status = 'pending'").get() as any).c;
  res.json({ systems_count, blocks_count, skills_count, job_postings_count, compiled_cvs_count, pending_questions_count });
});

const clientDist = join(__dirname, '../../dist/client');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*path', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
