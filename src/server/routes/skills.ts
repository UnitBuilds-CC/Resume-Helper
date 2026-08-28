import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM skills ORDER BY name ASC').all();
  res.json(rows);
});

export default router;
