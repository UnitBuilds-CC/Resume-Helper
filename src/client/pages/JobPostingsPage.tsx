import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import type { JobPosting } from '../../shared/types';

export default function JobPostingsPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [form, setForm] = useState({ title: '', company: '', url: '', content: '', notes: '' });
  const [importText, setImportText] = useState<string | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api('/api/job-postings');
    setPostings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing({ id: 0, title: '', company: null, url: null, content: '', notes: null, status: 'active', created_at: '', updated_at: '' } as JobPosting);
    setForm({ title: '', company: '', url: '', content: '', notes: '' });
    setImportText(null);
  }

  function startEdit(posting: JobPosting) {
    setEditing(posting);
    setForm({ title: posting.title, company: posting.company ?? '', url: posting.url ?? '', content: posting.content, notes: posting.notes ?? '' });
    setImportText(null);
  }

  async function save() {
    const method = editing && editing.id ? 'PUT' : 'POST';
    const url = editing?.id ? `/api/job-postings/${editing.id}` : '/api/job-postings';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(null);
    setImportText(null);
    load();
  }

  async function remove(id: number) {
    await api(`/api/job-postings/${id}`, { method: 'DELETE' });
    load();
  }

  async function updateStatus(id: number, status: string) {
    await api(`/api/job-postings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  function handleImportedText(text: string, filename: string) {
    setImportText(text);
    setImportFilename(filename);
    setForm(f => ({ ...f, content: text }));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const statusColors: Record<string, string> = {
    active: 'bg-teal-50 text-mint-600 border-teal-300/20',
    applied: 'bg-mint-50 text-mint-600 border-mint-300/20',
    rejected: 'bg-teal-100 text-teal-600 border-teal-300/20',
    withdrawn: 'bg-earth-600/15 text-sapphire-400 border-sapphire-300/20',
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Job Postings</h2>
          <p className="text-sapphire-400 text-sm mt-1">Your targets. Each one gets a CV tailored to fit like Cinderella's slipper.</p>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add Posting</button>
      </div>

      {editing && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <input placeholder="Job title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full" />
            <input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="input w-full" />
            <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="input w-full" />
          </div>
          <div className="mb-4">
            <FileUpload onTextExtracted={handleImportedText} />
            {importText && <p className="text-xs text-mint-600 mt-2">Imported from {importFilename}</p>}
          </div>
          <textarea placeholder="Job posting content *" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={8} className="input w-full mb-4 resize-none font-mono text-sm" />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input w-full mb-4 resize-none" />
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => { setEditing(null); setImportText(null); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {postings.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sapphire-400">No job postings yet. Add one to start tailoring your CV.</p>
          </div>
        )}
        {postings.map(posting => (
          <div key={posting.id} className="card p-5 group">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sapphire-800">{posting.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[posting.status] ?? ''}`}>{posting.status}</span>
                </div>
                {posting.company && <p className="text-sm text-sapphire-400 mt-0.5">{posting.company}</p>}
                {posting.url && <p className="text-xs text-teal-600/60 truncate mt-0.5">{posting.url}</p>}
                <p className="text-sm text-sapphire-400 mt-2 line-clamp-2">{posting.content.substring(0, 200)}...</p>
              </div>
              <div className="flex gap-3 shrink-0 ml-4 items-start opacity-0 group-hover:opacity-100 transition-opacity">
                <select value={posting.status} onChange={e => updateStatus(posting.id, e.target.value)} className="text-xs bg-white/50 border border-cream-300/40 rounded-lg px-2 py-1 text-sapphire-600">
                  <option value="active">Active</option>
                  <option value="applied">Applied</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
                <button onClick={() => startEdit(posting)} className="text-xs text-sapphire-400 hover:text-mint-600">Edit</button>
                <button onClick={() => remove(posting.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
