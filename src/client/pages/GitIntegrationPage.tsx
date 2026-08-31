import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { GitRepo, GitSystem, GitBlock } from '../../shared/types';

export default function GitIntegrationPage() {
  const { toast } = useToast();
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<number | null>(null);
  const [changes, setChanges] = useState<{ systems: GitSystem[]; blocks: GitBlock[] }>({ systems: [], blocks: [] });
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState<Set<number>>(new Set());
  const [newRepo, setNewRepo] = useState({ path: '', remote_url: '', branch: 'main' });
  const [loading, setLoading] = useState(true);

  async function loadRepos() {
    const res = await api('/api/git/repos');
    setRepos(await res.json());
    setLoading(false);
  }

  async function loadChanges(repoId: number) {
    const res = await api(`/api/git/changes/${repoId}`);
    setChanges(await res.json());
  }

  useEffect(() => { loadRepos(); }, []);
  useEffect(() => { if (selectedRepo) loadChanges(selectedRepo); }, [selectedRepo]);

  async function addRepo() {
    if (!newRepo.path) {
      toast('Path is required', 'error');
      return;
    }
    const res = await api('/api/git/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRepo),
    });
    if (res.ok) {
      toast('Repository added');
      setShowAddForm(false);
      setNewRepo({ path: '', remote_url: '', branch: 'main' });
      loadRepos();
    } else {
      const err = await res.json();
      toast(err.error || 'Failed to add repository', 'error');
    }
  }

  async function syncRepo(repoId: number) {
    setSyncing(prev => new Set(prev).add(repoId));
    const res = await api(`/api/git/sync/${repoId}`, { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      toast(`Synced: ${result.commits_processed} commits, ${result.systems_extracted} systems, ${result.blocks_extracted} blocks`);
      loadRepos();
      if (selectedRepo === repoId) loadChanges(repoId);
    } else {
      const err = await res.json();
      toast(err.error || 'Sync failed', 'error');
    }
    setSyncing(prev => { const s = new Set(prev); s.delete(repoId); return s; });
  }

  async function approveChanges(type: 'system' | 'block', ids: number[]) {
    const res = await api('/api/git/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ids }),
    });
    if (res.ok) {
      const result = await res.json();
      toast(`Approved ${type === 'system' ? result.approved_systems : result.approved_blocks} ${type}(s)`);
      if (selectedRepo) loadChanges(selectedRepo);
    }
  }

  async function rejectChanges(type: 'system' | 'block', ids: number[]) {
    const res = await api('/api/git/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ids }),
    });
    if (res.ok) {
      toast(`Rejected ${items.length} ${type}(s)`);
      if (selectedRepo) loadChanges(selectedRepo);
    }
  }

  async function deleteRepo(repoId: number) {
    if (!confirm('Remove this repository from watch list?')) return;
    const res = await api(`/api/git/repos/${repoId}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Repository removed');
      if (selectedRepo === repoId) setSelectedRepo(null);
      loadRepos();
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Git Integration</h2>
          <p className="text-sapphire-400 text-sm mt-1">Sync your repositories to extract systems and blocks from commits.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">+ Add Repository</button>
      </div>

      {showAddForm && (
        <div className="card p-5 mb-6">
          <h3 className="section-title mb-4">Add Repository</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input placeholder="Local path (required)" value={newRepo.path} onChange={e => setNewRepo({ ...newRepo, path: e.target.value })} className="input w-full" />
            <input placeholder="Remote URL (optional)" value={newRepo.remote_url} onChange={e => setNewRepo({ ...newRepo, remote_url: e.target.value })} className="input w-full" />
            <input placeholder="Branch" value={newRepo.branch} onChange={e => setNewRepo({ ...newRepo, branch: e.target.value })} className="input w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={addRepo} className="btn-primary">Add</button>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {repos.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sapphire-400">No repositories added yet. Add a repository to start syncing.</p>
          </div>
        )}
        {repos.map(repo => (
          <div key={repo.id} className={`card p-5 ${selectedRepo === repo.id ? 'ring-2 ring-teal-500' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-sapphire-800">{repo.path}</h3>
                <p className="text-sm text-sapphire-400 mt-1">Branch: {repo.branch} | Remote: {repo.remote_url || 'local'}</p>
                <p className="text-xs text-sapphire-400 mt-1">
                  Last synced: {repo.last_synced_at ? new Date(repo.last_synced_at).toLocaleString() : 'never'}
                  {repo.last_synced_commit && ` (${repo.last_synced_commit.substring(0, 7)})`}
                </p>
                {(repo.pending_systems > 0 || repo.pending_blocks > 0) && (
                  <p className="text-xs text-teal-600 mt-1">
                    Pending: {repo.pending_systems} systems, {repo.pending_blocks} blocks
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button onClick={() => syncRepo(repo.id)} disabled={syncing.has(repo.id)} className="btn-secondary text-xs disabled:opacity-50">
                  {syncing.has(repo.id) ? 'Syncing...' : 'Sync'}
                </button>
                <button onClick={() => setSelectedRepo(selectedRepo === repo.id ? null : repo.id)} className="btn-secondary text-xs">
                  {selectedRepo === repo.id ? 'Close' : 'Review'}
                </button>
                <button onClick={() => deleteRepo(repo.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedRepo && (
        <div className="card p-5">
          <h3 className="section-title mb-4">Review Changes</h3>
          {changes.systems.length === 0 && changes.blocks.length === 0 ? (
            <p className="text-sapphire-400">No pending changes. Sync the repository to extract new systems and blocks.</p>
          ) : (
            <>
              {changes.systems.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sapphire-700">Systems ({changes.systems.length})</h4>
                    <button onClick={() => approveChanges('system', changes.systems.map(s => s.id))} className="btn-primary text-xs">Approve All</button>
                  </div>
                  <div className="space-y-2">
                    {changes.systems.map(system => (
                      <div key={system.id} className="p-3 bg-cream-50/40 rounded-lg border border-cream-300/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-sapphire-800">{system.name}</h5>
                            {system.industry && <p className="text-xs text-sapphire-400">{system.industry}</p>}
                            <p className="text-sm text-sapphire-600 mt-1">{system.description}</p>
                            {system.file_path && <p className="text-xs text-sapphire-400 mt-1">File: {system.file_path}</p>}
                          </div>
                          <div className="flex gap-2 shrink-0 ml-4">
                            <button onClick={() => approveChanges('system', [system.id])} className="text-xs text-teal-600 hover:text-teal-700">Approve</button>
                            <button onClick={() => rejectChanges('system', [system.id])} className="text-xs text-sapphire-400 hover:text-teal-600">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {changes.blocks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sapphire-700">Blocks ({changes.blocks.length})</h4>
                    <button onClick={() => approveChanges('block', changes.blocks.map(b => b.id))} className="btn-primary text-xs">Approve All</button>
                  </div>
                  <div className="space-y-2">
                    {changes.blocks.map(block => (
                      <div key={block.id} className="p-3 bg-cream-50/40 rounded-lg border border-cream-300/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-sapphire-800">{block.title}</h5>
                            <p className="text-sm text-sapphire-600 mt-1 whitespace-pre-wrap">{block.content}</p>
                            {block.file_path && <p className="text-xs text-sapphire-400 mt-1">File: {block.file_path}</p>}
                          </div>
                          <div className="flex gap-2 shrink-0 ml-4">
                            <button onClick={() => approveChanges('block', [block.id])} className="text-xs text-teal-600 hover:text-teal-700">Approve</button>
                            <button onClick={() => rejectChanges('block', [block.id])} className="text-xs text-sapphire-400 hover:text-teal-600">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
