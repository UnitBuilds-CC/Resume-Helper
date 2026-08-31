import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getFullTemplate() {
  const cv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
  const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all();
  return { ...cv, education, employment };
}

router.get('/', (_req, res) => {
  res.json(getFullTemplate());
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
  const { institution, degree, field, start_date, end_date, details, sort_order } = req.body;
  db.prepare(
    'INSERT INTO education (institution, degree, field, start_date, end_date, details, sort_order) VALUES (?,?,?,?,?,?,?)'
  ).run(institution ?? null, degree ?? null, field ?? null,
        start_date ?? null, end_date ?? null, details ?? null, sort_order ?? 0);
  res.status(201).json(getFullTemplate());
});

router.put('/education/:id', (req, res) => {
  const { institution, degree, field, start_date, end_date, details, sort_order } = req.body;
  db.prepare(
    `UPDATE education SET institution = COALESCE(?, institution), degree = COALESCE(?, degree),
     field = COALESCE(?, field), start_date = COALESCE(?, start_date),
     end_date = COALESCE(?, end_date), details = COALESCE(?, details),
     sort_order = COALESCE(?, sort_order) WHERE id = ?`
  ).run(institution ?? null, degree ?? null, field ?? null,
        start_date ?? null, end_date ?? null, details ?? null,
        sort_order ?? 0, req.params.id);
  res.json(getFullTemplate());
});

router.delete('/education/:id', (req, res) => {
  const result = db.prepare('DELETE FROM education WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(getFullTemplate());
});

router.post('/employment', (req, res) => {
  const { company, title, start_date, end_date, location, description, sort_order } = req.body;
  db.prepare(
    'INSERT INTO employment (company, title, start_date, end_date, location, description, sort_order) VALUES (?,?,?,?,?,?,?)'
  ).run(company ?? null, title ?? null, start_date ?? null, end_date ?? null,
        location ?? null, description ?? null, sort_order ?? 0);
  res.status(201).json(getFullTemplate());
});

router.put('/employment/:id', (req, res) => {
  const { company, title, start_date, end_date, location, description, sort_order } = req.body;
  db.prepare(
    `UPDATE employment SET company = COALESCE(?, company), title = COALESCE(?, title),
     start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
     location = COALESCE(?, location), description = COALESCE(?, description),
     sort_order = COALESCE(?, sort_order) WHERE id = ?`
  ).run(company ?? null, title ?? null, start_date ?? null, end_date ?? null,
        location ?? null, description ?? null, sort_order ?? 0, req.params.id);
  res.json(getFullTemplate());
});

router.delete('/employment/:id', (req, res) => {
  const result = db.prepare('DELETE FROM employment WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(getFullTemplate());
});

export default router;
