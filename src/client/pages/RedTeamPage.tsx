import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { RedTeamResult, RedTeamDimension, RedFlag, Recommendation } from '../../shared/types';

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

  function recommendationBadge(rec: Recommendation | null) {
    if (!rec) return null;
    const colors: Record<Recommendation, string> = {
      strong_yes: 'bg-mint-500 text-white',
      yes: 'bg-teal-500 text-white',
      maybe: 'bg-lavender-500 text-white',
      no: 'bg-earth-500 text-white',
      strong_no: 'bg-red-500 text-white',
    };
    const labels: Record<Recommendation, string> = {
      strong_yes: 'STRONG YES',
      yes: 'YES',
      maybe: 'MAYBE',
      no: 'NO',
      strong_no: 'STRONG NO',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[rec]}`}>
        {labels[rec]}
      </span>
    );
  }

  function severityColor(severity: string) {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-red-400 text-white';
      case 'medium': return 'bg-earth-500 text-white';
      case 'low': return 'bg-lavender-500 text-white';
      default: return 'bg-sapphire-400 text-white';
    }
  }

  function formatDimensionName(name: string) {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Red Team</h2>
        <p className="text-sapphire-400 text-sm mt-1">Multi-dimensional evaluation across 10 criteria. Click to expand details.</p>
      </div>

      {results.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">No evaluations yet. Use an AI client via MCP to run a red team test on a compiled CV.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(r => (
            <div key={r.id} className="card p-5">
              <div onClick={() => setSelected(selected === r.id ? null : r.id)} className="cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-sapphire-800 text-lg">{r.job_title ?? `CV #${r.compiled_cv_id}`}</h3>
                      {recommendationBadge(r.recommendation)}
                    </div>
                    <p className="text-xs text-sapphire-400">{new Date(r.created_at).toLocaleString()}</p>
                    {r.job_company && <p className="text-xs text-sapphire-400 mt-0.5">{r.job_company}</p>}
                  </div>
                  <div className={`px-5 py-2 rounded-full text-lg font-bold border ${scoreColor(r.overall_score)}`}>
                    {r.overall_score}
                  </div>
                </div>

                {r.job_fit_summary && (
                  <p className="text-sm text-sapphire-600 mb-4 italic">{r.job_fit_summary}</p>
                )}

                <div className="flex gap-4 text-xs">
                  <div className={`flex items-center gap-1.5 ${r.phase1_qualified ? 'text-mint-600' : 'text-teal-600'}`}>
                    <span>{r.phase1_qualified ? '✓' : '✗'}</span>
                    <span>Qualified</span>
                  </div>
                  {r.dimensions?.length > 0 && (
                    <span className="text-sapphire-400">{r.dimensions.length} dimensions</span>
                  )}
                  {r.red_flags?.length > 0 && (
                    <span className="text-red-500">{r.red_flags.length} red flag{r.red_flags.length > 1 ? 's' : ''}</span>
                  )}
                  {r.questions?.length > 0 && (
                    <span className="text-sapphire-400">{r.questions.length} question{r.questions.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>

              {selected === r.id && (
                <div className="mt-5 pt-5 border-t border-cream-300/40 space-y-5">
                  {r.dimensions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-3">Dimension Scores</h4>
                      <div className="space-y-3">
                        {r.dimensions.map((dim: RedTeamDimension) => (
                          <div key={dim.id} className="p-4 bg-cream-50/40 rounded-lg border border-cream-300/30">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-medium text-sapphire-800">{formatDimensionName(dim.dimension_name)}</h5>
                                <span className="text-xs text-sapphire-400">({Math.round(dim.weight * 100)}%)</span>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${scoreColor(dim.score)}`}>
                                {dim.score}
                              </div>
                            </div>
                            <p className="text-xs text-sapphire-600 mb-2">{dim.feedback}</p>
                            
                            {dim.strengths && dim.strengths.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-mint-600 mb-1">Strengths:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-600 space-y-0.5">
                                  {dim.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            
                            {dim.gaps && dim.gaps.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-red-500 mb-1">Gaps:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-600 space-y-0.5">
                                  {dim.gaps.map((g, i) => <li key={i}>{g}</li>)}
                                </ul>
                              </div>
                            )}
                            
                            {dim.evidence && dim.evidence.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-sapphire-500 mb-1">Evidence:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-400 space-y-0.5">
                                  {dim.evidence.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.red_flags && r.red_flags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-3">Red Flags</h4>
                      <div className="space-y-2">
                        {r.red_flags.map((flag: RedFlag, i: number) => (
                          <div key={i} className="p-3 bg-red-50/50 rounded-lg border border-red-300/30">
                            <div className="flex items-start gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${severityColor(flag.severity)}`}>
                                {flag.severity.toUpperCase()}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm text-sapphire-800 font-medium">{flag.description}</p>
                                {flag.evidence && <p className="text-xs text-sapphire-500 mt-1">Evidence: {flag.evidence}</p>}
                                {flag.recommendation && <p className="text-xs text-sapphire-600 mt-1 italic">Recommendation: {flag.recommendation}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.phase3_summary && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-2">What Makes You Special</h4>
                      <p className="text-sm text-sapphire-600 leading-relaxed">{r.phase3_summary}</p>
                    </div>
                  )}

                  {r.full_analysis && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-2">Full Analysis</h4>
                      <pre className="text-sm text-sapphire-400 whitespace-pre-wrap bg-cream-50/40 p-4 rounded-lg leading-relaxed">{r.full_analysis}</pre>
                    </div>
                  )}

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
