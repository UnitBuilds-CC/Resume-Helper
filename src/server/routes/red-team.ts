import { Router } from 'express';
import db from '../db.js';
import { listRedTeamResults, saveRedTeamResult } from '../services/red-team-store.js';
import { evaluateAndSave } from '../services/red-team-runner.js';

const router = Router();

router.get('/:compiled_cv_id', (req, res) => {
  res.json(listRedTeamResults(db, req.params.compiled_cv_id));
});

// The deterministic evaluation the desktop product was designed around. An AI client may still write a
// richer narrative through POST /, but neither path is trusted to get the arithmetic right on its own.
router.post('/evaluate', (req, res) => {
  const { compiled_cv_id } = req.body;
  res.status(201).json(evaluateAndSave(db, Number(compiled_cv_id)));
});

router.post('/', (req, res) => {
  res.status(201).json(saveRedTeamResult(db, req.body));
});

export default router;
