import { api, API_BASE } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { CompiledCV } from '../../shared/types';

interface ValidationResult {
  check: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  detail?: string;
}

interface AtsValidationResult {
  score: number;
  passed: boolean;
  results: ValidationResult[];
  metadata: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    job_title: string;
    job_company: string;
    keywords: string[];
  };
}

export default function CompiledCVsPage() {
  const { toast } = useToast();
  const [cvs, setCvs] = useState<(CompiledCV & { job_title?: string; job_company?: string })[]>([]);
  const [selected, setSelected] = useState<CompiledCV | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [validationResult, setValidationResult] = useState<AtsValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingDownloadId, setPendingDownloadId] = useState<number | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assemblyJobs, setAssemblyJobs] = useState<any[]>([]);
  const [assemblyBlocks, setAssemblyBlocks] = useState<any[]>([]);
  const [assemblySystems, setAssemblySystems] = useState<any[]>([]);
  const [pickedJob, setPickedJob] = useState<string>('');
  const [pickedBlocks, setPickedBlocks] = useState<number[]>([]);
  const [pickedSystems, setPickedSystems] = useState<number[]>([]);

  async function load() {
    try {
      const res = await api('/api/compiled-cvs');
      if (!res.ok) throw new Error(String(res.status));
      setCvs(await res.json());
    } catch (err) {
      toast('Could not load compiled CVs: ' + (err instanceof Error ? err.message : 'API unreachable'), 'error');
    } finally {
      setLoading(false);
    }
  }

  /**
   * The compiler lived only behind the MCP tool, so opening the app cold left this page with nothing to do.
   * The panel pulls the same lists the scratch pads show and posts to the route that shares the tool's code.
   */
  async function openAssembly() {
    setAssembling(true);
    try {
      const [jobs, blocks, systems] = await Promise.all([
        api('/api/job-postings').then((r) => r.json()),
        api('/api/blocks').then((r) => r.json()),
        api('/api/systems').then((r) => r.json()),
      ]);
      setAssemblyJobs(jobs);
      setAssemblyBlocks(blocks);
      setAssemblySystems(systems);
    } catch (err) {
      toast('Could not load the material to compile from', 'error');
      setAssembling(false);
    }
  }

  async function runAssembly() {
    if (!pickedJob || pickedBlocks.length === 0) {
      toast('Pick a job posting and at least one achievement block', 'error');
      return;
    }
    try {
      const res = await api('/api/compiled-cvs/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_posting_id: Number(pickedJob),
          block_ids: pickedBlocks,
          system_ids: pickedSystems,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || body?.problems?.join('; ') || String(res.status));
      toast(`CV #${body.id} assembled as version ${body.version} from ${body.blocks_used} block(s)`, 'success');
      setAssembling(false);
      setPickedBlocks([]);
      setPickedSystems([]);
      await load();
    } catch (err) {
      toast('Assembly failed: ' + (err instanceof Error ? err.message : 'unknown'), 'error');
    }
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

  async function validateAndDownload(id: number) {
    try {
      const res = await api(`/api/compiled-cvs/${id}/validate`);
      const result: AtsValidationResult = await res.json();
      setValidationResult(result);
      setPendingDownloadId(id);
      setShowValidationModal(true);
    } catch (err) {
      toast('Validation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function download(id: number | null, format: 'pdf' | 'docx') {
    if (!id) return;
    window.open(`${API_BASE}/api/compiled-cvs/${id}/${format}`, '_blank');
  }

  function proceedWithDownload(format: 'pdf' | 'docx' = 'pdf') {
    download(pendingDownloadId, format);
    setShowValidationModal(false);
    setPendingDownloadId(null);
    setValidationResult(null);
  }

  function copyToClipboard() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content);
    toast('Copied to clipboard');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Compiled CVs</h2>
          <p className="text-sapphire-400 text-sm mt-1">Tailored CVs assembled from your own blocks and systems.</p>
        </div>
        <button onClick={assembling ? () => setAssembling(false) : openAssembly} className="btn-primary text-sm">
          {assembling ? 'Close' : 'Assemble from blocks'}
        </button>
      </div>

      {assembling && (
        <div className="card p-5 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sapphire-700 mb-2">Job posting</label>
            <select
              value={pickedJob}
              onChange={(e) => setPickedJob(e.target.value)}
              className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Choose a posting…</option>
              {assemblyJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title} — {j.company} (#{j.id})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-sapphire-700 mb-2">Achievement blocks ({pickedBlocks.length} selected)</p>
              <div className="max-h-64 overflow-y-auto space-y-1 border border-cream-200 rounded-lg p-3">
                {assemblyBlocks.map((b) => (
                  <label key={b.id} className="flex items-start gap-2 text-sm text-sapphire-600">
                    <input
                      type="checkbox"
                      checked={pickedBlocks.includes(b.id)}
                      onChange={(e) => setPickedBlocks(e.target.checked ? [...pickedBlocks, b.id] : pickedBlocks.filter((x) => x !== b.id))}
                      className="mt-1"
                    />
                    <span>{b.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-sapphire-700 mb-2">Systems ({pickedSystems.length} selected)</p>
              <div className="max-h-64 overflow-y-auto space-y-1 border border-cream-200 rounded-lg p-3">
                {assemblySystems.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 text-sm text-sapphire-600">
                    <input
                      type="checkbox"
                      checked={pickedSystems.includes(s.id)}
                      onChange={(e) => setPickedSystems(e.target.checked ? [...pickedSystems, s.id] : pickedSystems.filter((x) => x !== s.id))}
                      className="mt-1"
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-sapphire-400">
            Order matters: the CV is assembled in the sequence you tick. Education and employment are included
            by default; the ATS check runs on the result before you download it.
          </p>
          <button onClick={runAssembly} className="btn-primary text-sm">Compile as a new version</button>
        </div>
      )}

      {cvs.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">
            No compiled CVs yet. Use “Assemble from blocks” above, or an AI client through MCP for a tailored
            rewrite of your own words.
          </p>
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
                      <button onClick={() => validateAndDownload(selected.id)} className="btn-secondary text-xs">ATS check &amp; download</button>
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

      {showValidationModal && validationResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-cream-300/40">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-sapphire-800">ATS Compatibility Check</h3>
                <button onClick={() => setShowValidationModal(false)} className="text-sapphire-400 hover:text-sapphire-600 text-xl">×</button>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className={`text-4xl font-bold ${validationResult.score >= 80 ? 'text-mint-600' : validationResult.score >= 60 ? 'text-sapphire-600' : 'text-teal-600'}`}>
                  {validationResult.score}%
                </div>
                <div>
                  <div className={`text-sm font-medium ${validationResult.passed ? 'text-mint-600' : 'text-teal-600'}`}>
                    {validationResult.passed ? '✓ Ready to download' : '✗ Issues found'}
                  </div>
                  <div className="text-xs text-sapphire-400 mt-1">
                    {validationResult.results.filter(r => r.status === 'pass').length} passed, {validationResult.results.filter(r => r.status === 'warning').length} warnings, {validationResult.results.filter(r => r.status === 'fail').length} failures
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {validationResult.results.map((result, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-cream-50/40">
                  <div className="flex-shrink-0 mt-0.5">
                    {result.status === 'pass' && <span className="text-mint-600 text-lg">✓</span>}
                    {result.status === 'warning' && <span className="text-sapphire-600 text-lg">⚠</span>}
                    {result.status === 'fail' && <span className="text-teal-600 text-lg">✗</span>}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-sapphire-800">{result.check}</div>
                    <div className="text-sm text-sapphire-600 mt-0.5">{result.message}</div>
                    {result.detail && <div className="text-xs text-sapphire-400 mt-1">{result.detail}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-cream-300/40 flex gap-3 justify-end">
              <button onClick={() => setShowValidationModal(false)} className="btn-secondary text-sm">Cancel</button>
              {validationResult.passed ? (
                <>
                  <button onClick={() => proceedWithDownload('pdf')} className="btn-primary text-sm">Download PDF</button>
                  <button onClick={() => proceedWithDownload('docx')} className="btn-primary text-sm">Download Word</button>
                </>
              ) : (
                <>
                  <button onClick={() => proceedWithDownload('pdf')} className="btn-secondary text-sm">Download PDF anyway</button>
                  <button onClick={() => proceedWithDownload('docx')} className="btn-secondary text-sm">Download Word anyway</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
