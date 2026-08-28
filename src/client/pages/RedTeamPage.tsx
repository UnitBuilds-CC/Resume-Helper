import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { RedTeamResult } from '../../shared/types';

export default function RedTeamPage() {
  const [results, setResults] = useState<(RedTeamResult & { job_title?: string; job_company?: string })[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const cvsRes = await api('/api/compiled-cvs');
    const cvs = await cvsRes.json();
    const allResults: any[] = [];
    for (const cv of cvs) {
      const res = await api(`/api/red-team/${cv.id}`);
      const data = await res.json();
      for (const r of data) allResults.push({ ...r, job_title: cv.job_title, job_company: cv.job_company });
    }
    setResults(allResults.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  function scoreColor(score: number) {
    if (score >= 90) return 'text-mint-600 bg-mint-50 border-mint-300/20';
    if (score >= 70) return 'text-mint-600 bg-teal-50 border-teal-300/20';
    if (score >= 50) return 'text-sapphire-600 bg-earth-600/15 border-sapphire-300/20';
    return 'text-teal-600 bg-teal-100 border-teal-300/20';
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Red Team</h2>
        <p className="text-sapphire-400 text-sm mt-1">How would a reviewer see you? Three phases, one verdict.</p>
      </div>

      {results.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">No evaluations yet. Use an AI client via MCP to run a red team test on a compiled CV.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(r => (
            <div key={r.id} onClick={() => setSelected(selected === r.id ? null : r.id)} className="card p-5 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-sapphire-800">{r.job_title ?? `CV #${r.compiled_cv_id}`}</h3>
                  <p className="text-xs text-sapphire-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${scoreColor(r.overall_score)}`}>
                  {r.overall_score}/100
                </div>
              </div>

              <div className="flex gap-4">
                <div className={`flex items-center gap-1.5 text-xs ${r.phase1_qualified ? 'text-mint-600' : 'text-teal-600'}`}>
                  <span>{r.phase1_qualified ? '✓' : '✗'}</span>
                  <span>Phase 1: {r.phase1_qualified ? 'Qualified' : 'Not qualified'}</span>
                </div>
                <span className="text-xs text-sapphire-400">Phase 2: {r.phase2_score}/100</span>
                {r.questions?.length > 0 && <span className="text-xs text-sapphire-400">{r.questions.length} question{r.questions.length > 1 ? 's' : ''}</span>}
              </div>

              {selected === r.id && (
                <div className="mt-5 pt-5 border-t border-cream-300/40 space-y-5">
                  <div>
                    <h4 className="text-sm font-medium text-sapphire-700 mb-2">Phase 3 — What makes you special</h4>
                    <p className="text-sm text-sapphire-600 leading-relaxed">{r.phase3_summary}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-sapphire-700 mb-2">Full Analysis</h4>
                    <pre className="text-sm text-sapphire-400 whitespace-pre-wrap bg-cream-50/40 p-4 rounded-lg leading-relaxed">{r.full_analysis}</pre>
                  </div>
                  {r.questions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-3">Gap Questions</h4>
                      <div className="space-y-2">
                        {r.questions.map((q: any) => (
                          <div key={q.id} className="p-3 bg-cream-50/40 rounded-lg border border-cream-300/30">
                            <p className="text-sm text-sapphire-700">{q.question}</p>
                            {q.context && <p className="text-xs text-sapphire-400 mt-1">{q.context}</p>}
                            {q.skill_tag && <span className="tag mt-2">{q.skill_tag}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
