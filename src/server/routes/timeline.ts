import { Router } from 'express';
import db from '../db.js';
import { getTimeline } from '../services/timeline-store.js';

const router = Router();

// The record every CV paragraph, block and cover letter is checked against. Reading it answers "what does
// the product actually believe about when you worked where", including the verdicts it would refuse on.
router.get('/', (_req, res) => {
  res.json(getTimeline(db));
});

export default router;
