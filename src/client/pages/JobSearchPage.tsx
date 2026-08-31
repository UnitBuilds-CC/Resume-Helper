import { api } from '../hooks/api';
import { useState } from 'react';

interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  posted_date?: string;
  tags?: string[];
}

export default function JobSearchPage() {
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState({ remoteok: true, weworkremotely: true, rustjobs: true, hnwhohiring: true, letsgerrusty: true });
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<number>>(new Set());

  async function doSearch() {
    setLoading(true);
    setSearched(true);
    setImported(new Set());
    const activeSources = Object.entries(sources).filter(([, v]) => v).map(([k]) => k).join(',');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (activeSources) params.set('sources', activeSources);
      const res = await api(`/api/job-search/search?${params}`);
      const data = await res.json();
      setResults(data.jobs || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  async function importJob(job: JobResult, index: number) {
    setImporting(prev => new Set(prev).add(index));
    try {
      const res = await api('/api/job-search/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          url: job.url,
          content: job.description,
        }),
      });
      if (res.ok) {
        setImported(prev => new Set(prev).add(index));
      }
    } catch {}
    setImporting(prev => { const n = new Set(prev); n.delete(index); return n; });
  }

  async function importSelected(selected: number[]) {
    const jobs = selected.map(i => results[i]).filter(j => j.title && j.description);
    if (jobs.length === 0) return;
    setLoading(true);
    try {
      const res = await api('/api/job-search/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs }),
      });
      if (res.ok) {
        const data = await res.json();
        const newImported = new Set(imported);
        selected.forEach(i => newImported.add(i));
        setImported(newImported);
      }
    } catch {}
    setLoading(false);
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleSelect(index: number) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(index)) n.delete(index); else n.add(index);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Job Search</h2>
        <p className="text-sapphire-400 text-sm mt-1">Find jobs from remote boards and import them to your pipeline.</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            placeholder="Search terms (e.g. Rust engineer, frontend developer)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="input flex-1 min-w-[200px]"
          />
          <button onClick={doSearch} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
            <input type="checkbox" checked={sources.remoteok} onChange={e => setSources({ ...sources, remoteok: e.target.checked })} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
            Remote OK
          </label>
          <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
            <input type="checkbox" checked={sources.weworkremotely} onChange={e => setSources({ ...sources, weworkremotely: e.target.checked })} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
            We Work Remotely
          </label>
          <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
            <input type="checkbox" checked={sources.rustjobs} onChange={e => setSources({ ...sources, rustjobs: e.target.checked })} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
            RustJobs
          </label>
          <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
            <input type="checkbox" checked={sources.hnwhohiring} onChange={e => setSources({ ...sources, hnwhohiring: e.target.checked })} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
            HN Who is Hiring
          </label>
          <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
            <input type="checkbox" checked={sources.letsgerrusty} onChange={e => setSources({ ...sources, letsgerrusty: e.target.checked })} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
            Let's Get Rusty
          </label>
        </div>
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">No jobs found. Try different search terms or sources.</p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-sapphire-600 cursor-pointer">
                <input type="checkbox" checked={selected.size === results.length && results.length > 0} onChange={toggleSelectAll} className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" />
                Select all
              </label>
              <span className="text-sm text-sapphire-400">{results.length} jobs found</span>
            </div>
            {selected.size > 0 && (
              <button onClick={() => importSelected(Array.from(selected))} className="btn-primary text-sm">
                Import {selected.size} selected
              </button>
            )}
          </div>

          <div className="space-y-3">
            {results.map((job, i) => (
              <div key={i} className={`card p-5 group ${imported.has(i) ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    className="mt-1 rounded border-cream-300 text-teal-500 focus:ring-teal-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sapphire-800">{job.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-300/20">{job.source}</span>
                      {imported.has(i) && <span className="text-xs px-2 py-0.5 rounded-full bg-mint-50 text-mint-600 border border-mint-300/20">Imported</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-sapphire-400 mt-0.5">
                      <span>{job.company}</span>
                      {job.location && <span className="text-sapphire-300">|</span>}
                      {job.location && <span>{job.location}</span>}
                      {job.posted_date && <span className="text-sapphire-300">|</span>}
                      {job.posted_date && <span>{new Date(job.posted_date).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-sm text-sapphire-400 mt-2 line-clamp-3">{stripHtml(job.description).substring(0, 300)}</p>
                    {job.tags && job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.tags.slice(0, 6).map((tag, j) => (
                          <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-cream-100 text-sapphire-500">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-700 px-2 py-1">View</a>
                    )}
                    {!imported.has(i) && (
                      <button
                        onClick={() => importJob(job, i)}
                        disabled={importing.has(i)}
                        className="text-xs btn-secondary px-2 py-1 disabled:opacity-50"
                      >
                        {importing.has(i) ? '...' : 'Import'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
