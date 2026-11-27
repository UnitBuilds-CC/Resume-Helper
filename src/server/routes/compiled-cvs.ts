import { Router } from 'express';
import db from '../db.js';
import { generatePdf } from '../services/pdf-generator.js';
import { generateDocx } from '../services/docx-generator.js';
import { buildCvExport } from '../services/cv-export.js';
import { assembleCv } from '../services/cv-assembly.js';
import { validateForAts } from '../services/ats-validator.js';
import {
  createCompiledCv, deleteCompiledCv, getCompiledCv, listCompiledCvs, updateCompiledCv,
} from '../services/compiled-cv-store.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(listCompiledCvs(db, req.query.job_posting_id));
});

router.post('/', (req, res) => {
  res.status(201).json(createCompiledCv(db, req.body));
});

// The human path to the same assembly the MCP tool performs.
router.post('/assemble', (req, res) => {
  res.status(201).json(assembleCv(db, req.body));
});

router.get('/:id', (req, res) => {
  res.json(getCompiledCv(db, req.params.id));
});

router.put('/:id', (req, res) => {
  res.json(updateCompiledCv(db, req.params.id, req.body.content, req.body.acknowledge));
});

router.delete('/:id', (req, res) => {
  res.json(deleteCompiledCv(db, req.params.id));
});

router.delete('/:id', (req, res) => {
  res.json(deleteCompiledCv(db, req.params.id));
});

router.get('/:id/pdf', async (req, res) => {
  const { pdf, basename } = buildCvExport(db, req.params.id);
  try {
    const bytes = await generatePdf(pdf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/docx', async (req, res) => {
  const { pdf, basename } = buildCvExport(db, req.params.id);
  try {
    const bytes = await generateDocx(pdf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.docx"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Word generation failed';
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
