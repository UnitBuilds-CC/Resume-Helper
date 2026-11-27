import { Router } from 'express';
import db from '../db.js';
import { listBlocks, createBlock, updateBlock, deleteBlock, readBlock } from '../services/block-store.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(listBlocks(db, { skill: req.query.skill, search: req.query.search }));
});

router.get('/:id', (req, res) => {
  res.json(readBlock(db, Number(req.params.id)));
});

router.post('/', (req, res) => {
  res.status(201).json(createBlock(db, req.body));
});

router.put('/:id', (req, res) => {
  res.json(updateBlock(db, Number(req.params.id), req.body));
});

router.delete('/:id', (req, res) => {
  res.json(deleteBlock(db, Number(req.params.id)));
});

export default router;
