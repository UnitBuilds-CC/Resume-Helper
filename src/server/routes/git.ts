import { Router } from 'express';
import db from '../db.js';
import { syncRepo } from '../services/git-sync.js';
import { existsSync } from 'fs';

const router = Router();

// GET /api/git/repos - List all watched repos
router.get('/repos', (_req, res) => {
  const repos = db.prepare(`
    SELECT gr.*, 
           (SELECT COUNT(*) FROM git_systems WHERE repo_id = gr.id AND status = 'pending') as pending_systems,
           (SELECT COUNT(*) FROM git_blocks WHERE repo_id = gr.id AND status = 'pending') as pending_blocks
    FROM git_repos gr 
    ORDER BY gr.created_at DESC
  `).all();
  res.json(repos);
});

// POST /api/git/repos - Add a repo to watch
router.post('/repos', (req, res) => {
  const { path, remote_url, branch } = req.body;
  if (!path) return res.status(400).json({ error: 'path is required' });
  
  // Check if path exists
  if (!existsSync(path)) {
    return res.status(400).json({ error: 'path does not exist' });
  }
  
  try {
    const result = db.prepare(
      'INSERT INTO git_repos (path, remote_url, branch) VALUES (?, ?, ?)'
    ).run(path, remote_url || null, branch || 'main');
    
    const repo = db.prepare('SELECT * FROM git_repos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(repo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'repository already exists' });
    }
    throw error;
  }
});

// POST /api/git/sync/:id - Trigger sync for a repo
router.post('/sync/:id', async (req, res) => {
  const repoId = Number(req.params.id);
  const repo = db.prepare('SELECT * FROM git_repos WHERE id = ?').get(repoId);
  
  if (!repo) {
    return res.status(404).json({ error: 'repository not found' });
  }
  
  try {
    const result = await syncRepo(repoId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Sync failed' });
  }
});

// GET /api/git/changes/:id - Get pending extractions for a repo
router.get('/changes/:id', (req, res) => {
  const repoId = Number(req.params.id);
  
  const systems = db.prepare(
    "SELECT * FROM git_systems WHERE repo_id = ? AND status = 'pending' ORDER BY created_at DESC"
  ).all(repoId);
  
  const blocks = db.prepare(
    "SELECT * FROM git_blocks WHERE repo_id = ? AND status = 'pending' ORDER BY created_at DESC"
  ).all(repoId);
  
  res.json({ systems, blocks });
});

// POST /api/git/approve - Approve extractions and move to main tables
router.post('/approve', (req, res) => {
  const { type, ids } = req.body; // type: 'system' | 'block', ids: number[]
  
  if (!type || !ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'type and ids array are required' });
  }
  
  const approved: number[] = [];
  
  if (type === 'system') {
    for (const id of ids) {
      const gitSystem = db.prepare('SELECT * FROM git_systems WHERE id = ?').get(id) as any;
      if (!gitSystem) continue;
      
      // Insert into main systems table
      const result = db.prepare(
        'INSERT INTO systems (name, description, industry, notes) VALUES (?, ?, ?, ?)'
      ).run(gitSystem.name, gitSystem.description, gitSystem.industry, gitSystem.notes);
      
      // Mark as approved
      db.prepare("UPDATE git_systems SET status = 'approved' WHERE id = ?").run(id);
      approved.push(Number(result.lastInsertRowid));
    }
  } else if (type === 'block') {
    for (const id of ids) {
      const gitBlock = db.prepare('SELECT * FROM git_blocks WHERE id = ?').get(id) as any;
      if (!gitBlock) continue;
      
      // Insert into main blocks table
      const result = db.prepare(
        'INSERT INTO blocks (title, content) VALUES (?, ?)'
      ).run(gitBlock.title, gitBlock.content);
      
      // Mark as approved
      db.prepare("UPDATE git_blocks SET status = 'approved' WHERE id = ?").run(id);
      approved.push(Number(result.lastInsertRowid));
    }
  } else {
    return res.status(400).json({ error: 'type must be "system" or "block"' });
  }
  
  res.json({ approved: approved.length, ids: approved });
});

// POST /api/git/reject - Reject extractions
router.post('/reject', (req, res) => {
  const { type, ids } = req.body;
  
  if (!type || !ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'type and ids array are required' });
  }
  
  const table = type === 'system' ? 'git_systems' : type === 'block' ? 'git_blocks' : null;
  if (!table) {
    return res.status(400).json({ error: 'type must be "system" or "block"' });
  }
  
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(
    `UPDATE ${table} SET status = 'rejected' WHERE id IN (${placeholders})`
  ).run(...ids);
  
  res.json({ rejected: result.changes });
});

// DELETE /api/git/repos/:id - Remove a repo
router.delete('/repos/:id', (req, res) => {
  const result = db.prepare('DELETE FROM git_repos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

// GET /api/git/sync-log/:id - Get sync history for a repo
router.get('/sync-log/:id', (req, res) => {
  const repoId = Number(req.params.id);
  const logs = db.prepare(
    'SELECT * FROM git_sync_log WHERE repo_id = ? ORDER BY sync_started_at DESC LIMIT 20'
  ).all(repoId);
  res.json(logs);
});

export default router;
