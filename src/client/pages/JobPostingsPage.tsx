import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import type { JobPosting, ApplicationStatus } from '../../shared/types';

const APPLICATION_STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: 'not_applied', label: 'Found' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready_to_apply', label: 'Ready' },
  { status: 'applied', label: 'Applied' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
];

const STATUS_COLORS: Record<string, string> = {
  not_applied: 'bg-cream-100 text-sapphire-500 border-cream-300/30',
  preparing: 'bg-lavender-50 text-lavender-600 border-lavender-300/20',
  ready_to_apply: 'bg-teal-50 text-teal-600 border-teal-300/20',
  applied: 'bg-mint-50 text-mint-600 border-mint-300/20',
  interview: 'bg-sapphire-50 text-sapphire-600 border-sapphire-300/20',
  offer: 'bg-teal-100 text-teal-700 border-teal-300/30',
  rejected: 'bg-earth-600/10 text-sapphire-400 border-sapphire-300/20',
  withdrawn: 'bg-earth-600/15 text-sapphire-400 border-sapphire-300/20',
};

export default function JobPostingsPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [form, setForm] = useState({ title: '', company: '', url: '', content: '', notes: '' });
  const [importText, setImportText] = useState<string | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  async function load() {
    const params = filter !== 'all' ? `?application_status=${filter}` : '';
    const res = await api(`/api/job-postings${params}`);
    setPostings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  function startCreate() {
    setEditing({ id: 0, title: '', company: null, url: null, content: '', notes: null, status: 'active', application_status: 'not_applied', applied_date: null, compiled_cv_id: null, red_team_result_id: null, created_at: '', updated_at: '' } as JobPosting);
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

  async function updateApplicationStatus(id: number, application_status: ApplicationStatus) {
    await api(`/api/job-postings/${id}/application-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_status }),
    });
    load();
  }

  function handleImportedText(text: string, filename: string) {
    setImportText(text);
    setImportFilename(filename);
    setForm(f => ({ ...f, content: text }));
  }

  function getStepIndex(status: ApplicationStatus): number {
    return APPLICATION_STEPS.findIndex(s => s.status === status);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const filterOptions = ['all', ...APPLICATION_STEPS.map(s => s.status), 'rejected', 'withdrawn'];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Job Postings</h2>
          <p className="text-sapphire-400 text-sm mt-1">Track your applications from discovery to offer.</p>
        </div>
        <div className="flex gap-2">
          <a href="/job-search" className="btn-secondary">Search Jobs</a>
          <button onClick={startCreate} className="btn-primary">+ Add Posting</button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {filterOptions.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filter === f
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-white text-sapphire-500 border-cream-200 hover:border-cream-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'not_applied' ? 'Found' : f === 'ready_to_apply' ? 'Ready' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
          </button>
        ))}
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
            <p className="text-sapphire-400">No job postings. <a href="/job-search" className="text-teal-600 hover:text-teal-700 underline">Search for jobs</a> or add one manually.</p>
          </div>
        )}
        {postings.map(posting => {
          const stepIndex = getStepIndex(posting.application_status || 'not_applied');
          return (
            <div key={posting.id} className="card p-5 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sapphire-800">{posting.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[posting.application_status || 'not_applied'] ?? ''}`}>
                      {posting.application_status === 'not_applied' ? 'Found' : posting.application_status === 'ready_to_apply' ? 'Ready' : (posting.application_status || 'not_applied').charAt(0).toUpperCase() + (posting.application_status || 'not_applied').slice(1).replace('_', ' ')}
                    </span>
                  </div>
                  {posting.company && <p className="text-sm text-sapphire-400 mt-0.5">{posting.company}</p>}
                  {posting.url && <p className="text-xs text-teal-600/60 truncate mt-0.5">{posting.url}</p>}

                  <div className="flex items-center gap-1 mt-3">
                    {APPLICATION_STEPS.map((step, i) => (
                      <div key={step.status} className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${i <= stepIndex ? 'bg-teal-500' : 'bg-cream-200'}`} title={step.label} />
                        {i < APPLICATION_STEPS.length - 1 && (
                          <div className={`w-4 h-0.5 ${i < stepIndex ? 'bg-teal-500' : 'bg-cream-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    {posting.compiled_cv_id && (
                      <a href="/compiled" className="text-xs text-teal-600 hover:text-teal-700">CV compiled</a>
                    )}
                    <a href={`/questionnaire?job=${posting.id}`} className="text-xs text-sapphire-400 hover:text-sapphire-600">Questionnaire</a>
                    {posting.applied_date && (
                      <span className="text-xs text-sapphire-400">Applied {new Date(posting.applied_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4 items-start opacity-0 group-hover:opacity-100 transition-opacity flex-wrap justify-end max-w-[200px]">
                  <select
                    value={posting.application_status || 'not_applied'}
                    onChange={e => updateApplicationStatus(posting.id, e.target.value as ApplicationStatus)}
                    className="text-xs bg-white/50 border border-cream-300/40 rounded-lg px-2 py-1 text-sapphire-600"
                  >
                    {APPLICATION_STEPS.map(s => (
                      <option key={s.status} value={s.status}>{s.label}</option>
                    ))}
                    <option value="rejected">Rejected</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                  <button onClick={() => startEdit(posting)} className="text-xs text-sapphire-400 hover:text-mint-600">Edit</button>
                  <button onClick={() => remove(posting.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
