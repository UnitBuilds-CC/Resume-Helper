import { Router } from 'express';
import multer from 'multer';
import { extractText } from '../services/file-reader.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const text = await extractText(req.file.buffer, req.file.originalname);
    res.json({
      text,
      filename: req.file.originalname,
      format: req.file.originalname.split('.').pop()?.toLowerCase(),
      size: req.file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract text';
    res.status(400).json({ error: message });
  }
});

export default router;
