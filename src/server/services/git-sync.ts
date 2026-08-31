import simpleGit, { SimpleGit } from 'simple-git';
import db from '../db.js';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../../data');
const REPOS_DIR = join(DATA_DIR, 'git-repos');

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface ExtractedSystem {
  name: string;
  description: string;
  industry: string | null;
  notes: string | null;
  file_path: string;
}

interface ExtractedBlock {
  title: string;
  content: string;
  file_path: string;
}

interface SyncResult {
  commits_processed: number;
  systems_extracted: number;
  blocks_extracted: number;
}

// Ensure repos directory exists
if (!existsSync(REPOS_DIR)) {
  mkdirSync(REPOS_DIR, { recursive: true });
}

export async function cloneOrOpenRepo(repoPath: string, remoteUrl?: string, branch: string = 'main'): Promise<SimpleGit> {
  const git = simpleGit(repoPath);
  
  // Check if it's already a git repo
  const isRepo = await git.checkIsRepo();
  
  if (!isRepo && remoteUrl) {
    // Clone the repo
    await simpleGit().clone(remoteUrl, repoPath);
    const clonedGit = simpleGit(repoPath);
    await clonedGit.checkout(branch);
    return clonedGit;
  }
  
  if (!isRepo) {
    throw new Error(`Path ${repoPath} is not a git repository and no remote URL provided`);
  }
  
  return git;
}

export async function pullRepo(repoPath: string, branch: string = 'main'): Promise<void> {
  const git = simpleGit(repoPath);
  await git.checkout(branch);
  await git.pull('origin', branch);
}

export async function getCommitsSince(repoPath: string, sinceCommit: string | null): Promise<CommitInfo[]> {
  const git = simpleGit(repoPath);
  
  const logOptions: any = {
    '--max-count': 100, // Limit to prevent processing too many commits
  };
  
  if (sinceCommit) {
    logOptions.from = sinceCommit;
    logOptions.to = 'HEAD';
  }
  
  const log = await git.log(logOptions);
  
  const commits: CommitInfo[] = [];
  for (const commit of log.all) {
    // Get files changed in this commit
    const diff = await git.show([commit.hash, '--name-only', '--pretty=format:']);
    const files = diff.split('\n').filter(f => f.trim().length > 0);
    
    commits.push({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: commit.date,
      files,
    });
  }
  
  return commits;
}

export async function analyzeCommit(repoPath: string, commit: CommitInfo): Promise<{ systems: ExtractedSystem[]; blocks: ExtractedBlock[] }> {
  const systems: ExtractedSystem[] = [];
  const blocks: ExtractedBlock[] = [];
  
  const git = simpleGit(repoPath);
  const messageLower = commit.message.toLowerCase();
  
  // Check commit message for system indicators
  const systemKeywords = ['add system', 'new project', 'implement system', 'create system', 'setup project', 'init repo', 'new service'];
  const isSystemCommit = systemKeywords.some(kw => messageLower.includes(kw));
  
  // Check commit message for block indicators
  const blockKeywords = ['achieved', 'built', 'completed', 'shipped', 'delivered', 'launched', 'milestone', 'released', 'implemented'];
  const isBlockCommit = blockKeywords.some(kw => messageLower.includes(kw));
  
  // Analyze files
  for (const filePath of commit.files) {
    // Skip binary files
    if (filePath.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|exe|dll|so|dylib)$/i)) {
      continue;
    }
    
    try {
      // Get file content at this commit
      const content = await git.show([`${commit.hash}:${filePath}`]);
      
      // README.md -> extract as system
      if (filePath.toLowerCase() === 'readme.md' || filePath.toLowerCase().endsWith('/readme.md')) {
        const lines = content.split('\n');
        const title = lines.find(l => l.startsWith('# '))?.replace('# ', '') || 'Unknown System';
        const description = lines.filter(l => !l.startsWith('#') && l.trim().length > 0).slice(0, 5).join('\n');
        
        systems.push({
          name: title,
          description: description.substring(0, 500),
          industry: null,
          notes: `Extracted from commit ${commit.hash.substring(0, 7)}`,
          file_path: filePath,
        });
      }
      // package.json / Cargo.toml / go.mod -> extract as system
      else if (filePath.match(/(package\.json|Cargo\.toml|go\.mod)$/)) {
        try {
          const pkg = JSON.parse(content);
          const name = pkg.name || pkg.package || 'Unknown Project';
          const description = pkg.description || '';
          
          systems.push({
            name,
            description: description.substring(0, 500),
            industry: null,
            notes: `Extracted from commit ${commit.hash.substring(0, 7)}`,
            file_path: filePath,
          });
        } catch {
          // Not valid JSON, skip
        }
      }
      // Code files with significant changes -> extract as block
      else if (filePath.match(/\.(ts|js|rs|go|py|java|cs)$/)) {
        const linesAdded = content.split('\n').length;
        if (linesAdded > 50 || isBlockCommit) {
          const fileName = filePath.split('/').pop() || filePath;
          const firstComment = content.split('\n').find(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('/*')) || '';
          
          blocks.push({
            title: `${commit.message.substring(0, 50)} - ${fileName}`,
            content: `${commit.message}\n\nFile: ${filePath}\n\n${firstComment.substring(0, 200)}`,
            file_path: filePath,
          });
        }
      }
    } catch {
      // File doesn't exist at this commit or other error, skip
    }
  }
  
  // If commit message indicates a system but no README/package found, create from message
  if (isSystemCommit && systems.length === 0) {
    systems.push({
      name: commit.message.substring(0, 100),
      description: commit.message,
      industry: null,
      notes: `Extracted from commit ${commit.hash.substring(0, 7)}`,
      file_path: '',
    });
  }
  
  return { systems, blocks };
}

export async function syncRepo(repoId: number): Promise<SyncResult> {
  const repo = db.prepare('SELECT * FROM git_repos WHERE id = ?').get(repoId) as any;
  if (!repo) {
    throw new Error('Repository not found');
  }
  
  // Check if already syncing
  const inProgress = db.prepare(
    "SELECT * FROM git_sync_log WHERE repo_id = ? AND status = 'in_progress'"
  ).get(repoId);
  
  if (inProgress) {
    throw new Error('Repository is already syncing');
  }
  
  // Create sync log entry
  const syncLog = db.prepare(
    'INSERT INTO git_sync_log (repo_id, sync_started_at, status) VALUES (?, datetime("now"), "in_progress")'
  ).run(repoId);
  const syncLogId = syncLog.lastInsertRowid;
  
  try {
    const git = await cloneOrOpenRepo(repo.path, repo.remote_url, repo.branch);
    await pullRepo(repo.path, repo.branch);
    
    const commits = await getCommitsSince(repo.path, repo.last_synced_commit);
    
    let systemsExtracted = 0;
    let blocksExtracted = 0;
    
    for (const commit of commits) {
      const { systems, blocks } = await analyzeCommit(repo.path, commit);
      
      // Insert extracted systems
      for (const system of systems) {
        db.prepare(
          `INSERT INTO git_systems (repo_id, commit_hash, file_path, name, description, industry, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).run(repoId, commit.hash, system.file_path, system.name, system.description, system.industry, system.notes);
        systemsExtracted++;
      }
      
      // Insert extracted blocks
      for (const block of blocks) {
        db.prepare(
          `INSERT INTO git_blocks (repo_id, commit_hash, file_path, title, content, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`
        ).run(repoId, commit.hash, block.file_path, block.title, block.content);
        blocksExtracted++;
      }
    }
    
    // Update repo with last synced commit
    const lastCommit = commits.length > 0 ? commits[0].hash : repo.last_synced_commit;
    db.prepare(
      'UPDATE git_repos SET last_synced_commit = ?, last_synced_at = datetime("now") WHERE id = ?'
    ).run(lastCommit, repoId);
    
    // Update sync log
    db.prepare(
      `UPDATE git_sync_log SET sync_completed_at = datetime("now"), status = 'completed',
       commits_processed = ?, systems_extracted = ?, blocks_extracted = ? WHERE id = ?`
    ).run(commits.length, systemsExtracted, blocksExtracted, syncLogId);
    
    return { commits_processed: commits.length, systems_extracted: systemsExtracted, blocks_extracted: blocksExtracted };
  } catch (error) {
    // Update sync log with error
    db.prepare(
      `UPDATE git_sync_log SET sync_completed_at = datetime("now"), status = 'failed', error_message = ? WHERE id = ?`
    ).run(error instanceof Error ? error.message : 'Unknown error', syncLogId);
    
    throw error;
  }
}
