import { Router } from 'express';
import db from '../db.js';
import { labeled, writeEducation, writeEmployment } from '../services/timeline-store.js';

const router = Router();

function getFullTemplate() {
  const cv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const education = labeled(db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all());
  const employment = labeled(db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all());
  return { ...cv, education, employment };
}

// Labels come from timeline-store, the same function the desktop app and GET /api/timeline use. A second
// renderer here would be a second opinion about what "April 2025" means.

router.get('/', (_req, res) => {
  res.json(getFullTemplate());
});

// BlocksPage and ProfilePage fetch these two collections directly; only the combined GET / existed, so the
// client's JSON parse threw on the SPA fallback and both pages never finished loading.
router.get('/education', (_req, res) => {
  res.json(labeled(db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all()));
});

router.get('/employment', (_req, res) => {
  res.json(labeled(db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all()));
});

router.put('/', (req, res) => {
  const { full_name, email, phone, location, linkedin, website, summary, professional_title } = req.body;
  
  // Build dynamic update query
  const updates: string[] = [];
  const params: unknown[] = [];
  
  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (location !== undefined) { updates.push('location = ?'); params.push(location); }
  if (linkedin !== undefined) { updates.push('linkedin = ?'); params.push(linkedin); }
  if (website !== undefined) { updates.push('website = ?'); params.push(website); }
  if (summary !== undefined) { updates.push('summary = ?'); params.push(summary); }
  if (professional_title !== undefined) { updates.push('professional_title = ?'); params.push(professional_title); }
  
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE template_cv SET ${updates.join(', ')} WHERE id = 1`).run(...params);
  }
  
  res.json(getFullTemplate());
});

router.post('/education', (req, res) => {
  writeEducation(db, null, req.body);
  res.status(201).json(getFullTemplate());
});

router.put('/education/:id', (req, res) => {
  writeEducation(db, Number(req.params.id), req.body);
  res.json(getFullTemplate());
});

router.delete('/education/:id', (req, res) => {
  const result = db.prepare('DELETE FROM education WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(getFullTemplate());
});

router.post('/employment', (req, res) => {
  writeEmployment(db, null, req.body);
  res.status(201).json(getFullTemplate());
});

router.put('/employment/:id', (req, res) => {
  writeEmployment(db, Number(req.params.id), req.body);
  res.json(getFullTemplate());
});

router.delete('/employment/:id', (req, res) => {
  const result = db.prepare('DELETE FROM employment WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(getFullTemplate());
});

export default router;
