import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { CompiledCV } from '../../shared/types';

export default function CompiledCVsPage() {
  const { toast } = useToast();
  const [cvs, setCvs] = useState<(CompiledCV & { job_title?: string; job_company?: string })[]>([]);
  const [selected, setSelected] = useState<CompiledCV | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api('/api/compiled-cvs');
    setCvs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function selectCv(cv: CompiledCV) {
    setSelected(cv);
    setEditContent(cv.content);
    setEditMode(false);
  }

  async function saveEdit() {
    if (!selected) return;
    await api(`/api/compiled-cvs/${selected.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent }) });
    setEditMode(false);
    setSelected({ ...selected, content: editContent });
    load();
  }

  async function remove(id: number) {
    await api(`/api/compiled-cvs/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  }

  function downloadPdf(id: number) {
    const base = window.location.port === '3000' ? '' : 'http://localhost:3000';
    window.open(`${base}/api/compiled-cvs/${id}/pdf`, '_blank');
  }

  function copyToClipboard() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content);
    toast('Copied to clipboard');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Compiled CVs</h2>
        <p className="text-sapphire-400 text-sm mt-1">Your tailored CVs, compiled by AI from your own words.</p>
      </div>

      {cvs.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">No compiled CVs yet. Use an AI client via MCP to compile a CV for a job posting.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {cvs.map(cv => (
            <div
              key={cv.id}
              onClick={() => selectCv(cv)}
              className={`card p-4 cursor-pointer transition-all ${
                selected?.id === cv.id ? 'border-teal-300/50 bg-teal-600/5' : 'hover:border-sapphire-300/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-sapphire-800">{cv.job_title}</h3>
                  {cv.job_company && <p className="text-xs text-sapphire-400 mt-0.5">{cv.job_company}</p>}
                </div>
                <div className="text-right">
                  <span className="tag text-xs">v{cv.version}</span>
                  <button onClick={e => { e.stopPropagation(); remove(cv.id); }} className="block text-xs text-sapphire-400 hover:text-teal-600 mt-1.5">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sapphire-800">{(selected as any).job_title ?? `CV #${selected.id}`}</h3>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button onClick={saveEdit} className="btn-primary text-xs">Save</button>
                      <button onClick={() => { setEditMode(false); setEditContent(selected.content); }} className="btn-secondary text-xs">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={copyToClipboard} className="btn-secondary text-xs">Copy</button>
                      <button onClick={() => downloadPdf(selected.id)} className="btn-secondary text-xs">Download PDF</button>
                      <button onClick={() => setEditMode(true)} className="btn-secondary text-xs">Edit</button>
                    </>
                  )}
                </div>
              </div>
              {editMode ? (
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="input w-full h-96 resize-none font-mono text-sm" />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-sapphire-600 font-mono bg-cream-50/40 p-4 rounded-lg max-h-96 overflow-auto">{selected.content}</pre>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <p className="text-sapphire-400">Select a compiled CV to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
