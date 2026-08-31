import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { JobMatchResult, MatchDimension, GapSuggestion, Recommendation } from '../../shared/types';

export default function JobMatchPage() {
  const [results, setResults] = useState<JobMatchResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [jobPostings, setJobPostings] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  async function load() {
    const [matchRes, jobsRes] = await Promise.all([
      api('/api/job-match'),
      api('/api/job-postings'),
    ]);
    const matchData = await matchRes.json();
    const jobsData = await jobsRes.json();
    setResults(matchData);
    setJobPostings(jobsData);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function analyzeJob(jobId: number) {
    setAnalyzing(jobId);
    try {
      const res = await api('/api/job-match/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_posting_id: jobId }),
      });
      if (res.ok) {
        const result = await res.json();
        setResults(prev => [result, ...prev]);
        setShowPicker(false);
      }
    } finally {
      setAnalyzing(null);
    }
  }

  async function deleteResult(id: number) {
    await api(`/api/job-match/${id}`, { method: 'DELETE' });
    setResults(prev => prev.filter(r => r.id !== id));
    if (selected === id) setSelected(null);
  }

  function scoreColor(score: number) {
    if (score >= 80) return 'text-mint-600 bg-mint-50 border-mint-300/20';
    if (score >= 60) return 'text-mint-600 bg-teal-50 border-teal-300/20';
    if (score >= 40) return 'text-sapphire-600 bg-earth-600/15 border-sapphire-300/20';
    return 'text-teal-600 bg-teal-100 border-teal-300/20';
  }

  function recommendationBadge(rec: Recommendation) {
    const colors: Record<Recommendation, string> = {
      strong_yes: 'bg-mint-500 text-white',
      yes: 'bg-teal-500 text-white',
      maybe: 'bg-lavender-500 text-white',
      no: 'bg-earth-500 text-white',
      strong_no: 'bg-red-500 text-white',
    };
    const labels: Record<Recommendation, string> = {
      strong_yes: 'STRONG MATCH',
      yes: 'GOOD MATCH',
      maybe: 'MAYBE',
      no: 'WEAK MATCH',
      strong_no: 'POOR MATCH',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[rec]}`}>
        {labels[rec]}
      </span>
    );
  }

  function actionLabel(action: GapSuggestion['action']) {
    switch (action) {
      case 'add_to_block': return 'Link to block';
      case 'add_skill': return 'Add skill';
      case 'add_system': return 'Add system';
      case 'note_for_cover_letter': return 'Cover letter note';
      case 'ignore': return 'Dismiss';
    }
  }

  function actionColor(action: GapSuggestion['action']) {
    switch (action) {
      case 'add_to_block': return 'bg-teal-50 text-teal-700 border-teal-300/30 hover:bg-teal-100';
      case 'add_skill': return 'bg-mint-50 text-mint-700 border-mint-300/30 hover:bg-mint-100';
      case 'add_system': return 'bg-sapphire-50 text-sapphire-700 border-sapphire-300/30 hover:bg-sapphire-100';
      case 'note_for_cover_letter': return 'bg-lavender-50 text-lavender-700 border-lavender-300/30 hover:bg-lavender-100';
      case 'ignore': return 'bg-cream-100 text-sapphire-400 border-cream-300/30 hover:bg-cream-200';
    }
  }

  const analyzedJobIds = new Set(results.map(r => r.job_posting_id));
  const unanalyzedJobs = jobPostings.filter((j: any) => !analyzedJobIds.has(j.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="page-title">Job Match Scorecard</h2>
          <p className="text-sapphire-400 text-sm mt-1">
            See how well you match a job posting, what's missing, and fill gaps from existing experience.
          </p>
        </div>
        <button onClick={() => setShowPicker(!showPicker)} className="btn-primary text-sm">
          {showPicker ? 'Close' : '+ Analyze Job'}
        </button>
      </div>

      {showPicker && (
        <div className="card p-4 mb-4">
          <h3 className="section-title mb-3">Select a job to analyze</h3>
          {unanalyzedJobs.length === 0 ? (
            <p className="text-sm text-sapphire-400">All job postings have been analyzed.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {unanalyzedJobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-cream-50/60 rounded-lg border border-cream-300/30">
                  <div>
                    <p className="text-sm font-medium text-sapphire-800">{job.title}</p>
                    {job.company && <p className="text-xs text-sapphire-400">{job.company}</p>}
                  </div>
                  <button
                    onClick={() => analyzeJob(job.id)}
                    disabled={analyzing === job.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50"
                  >
                    {analyzing === job.id ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {results.length === 0 && !showPicker && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400 mb-3">No match analyses yet.</p>
          <button onClick={() => setShowPicker(true)} className="btn-primary text-sm">
            + Analyze a Job Posting
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(r => (
            <div key={r.id} className="card p-5">
              <div onClick={() => setSelected(selected === r.id ? null : r.id)} className="cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-medium text-sapphire-800 text-lg">{r.job_title ?? `Job #${r.job_posting_id}`}</h3>
                      {recommendationBadge(r.recommendation)}
                    </div>
                    {r.job_company && <p className="text-xs text-sapphire-400">{r.job_company}</p>}
                    <p className="text-xs text-sapphire-400 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className={`px-5 py-2 rounded-full text-lg font-bold border ${scoreColor(r.overall_score)}`}>
                    {r.overall_score}%
                  </div>
                </div>

                <p className="text-sm text-sapphire-600 mb-3">{r.summary}</p>

                <div className="flex gap-4 text-xs">
                  {r.dimensions?.length > 0 && (
                    <span className="text-sapphire-400">{r.dimensions.length} dimensions</span>
                  )}
                  {r.gap_suggestions?.length > 0 && (
                    <span className="text-earth-500">{r.gap_suggestions.length} gap{r.gap_suggestions.length > 1 ? 's' : ''} to review</span>
                  )}
                </div>
              </div>

              {selected === r.id && (
                <div className="mt-5 pt-5 border-t border-cream-300/40 space-y-5">
                  {/* Dimension Scores */}
                  {r.dimensions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-3">Dimension Breakdown</h4>
                      <div className="space-y-3">
                        {r.dimensions.map((dim: MatchDimension, i: number) => (
                          <div key={i} className="p-4 bg-cream-50/40 rounded-lg border border-cream-300/30">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-medium text-sapphire-800">{dim.dimension_name}</h5>
                                <span className="text-xs text-sapphire-400">({Math.round(dim.weight * 100)}%)</span>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${scoreColor(dim.score)}`}>
                                {dim.score}%
                              </div>
                            </div>
                            <p className="text-xs text-sapphire-600 mb-2">{dim.feedback}</p>

                            {dim.strengths?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-mint-600 mb-1">Strengths:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-600 space-y-0.5">
                                  {dim.strengths.map((s, j) => <li key={j}>{s}</li>)}
                                </ul>
                              </div>
                            )}

                            {dim.gaps?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-red-500 mb-1">Gaps:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-600 space-y-0.5">
                                  {dim.gaps.map((g, j) => <li key={j}>{g}</li>)}
                                </ul>
                              </div>
                            )}

                            {dim.evidence?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-sapphire-500 mb-1">Evidence:</p>
                                <ul className="list-disc list-inside text-xs text-sapphire-400 space-y-0.5">
                                  {dim.evidence.map((e, j) => <li key={j}>{e}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gap Suggestions */}
                  {r.gap_suggestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-sapphire-700 mb-3">
                        Gap Suggestions
                        <span className="text-xs text-sapphire-400 ml-2 font-normal">
                          Things you might already have experience with
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {r.gap_suggestions.map((sug: GapSuggestion, i: number) => (
                          <div key={i} className="p-3 bg-cream-50/40 rounded-lg border border-cream-300/30">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm text-sapphire-800 font-medium">{sug.gap}</p>
                                <p className="text-xs text-sapphire-600 mt-1">{sug.suggestion}</p>
                                {sug.related_block_title && (
                                  <p className="text-xs text-teal-600 mt-1">
                                    Related block: <span className="font-medium">{sug.related_block_title}</span>
                                  </p>
                                )}
                                {sug.related_project_name && (
                                  <p className="text-xs text-teal-600 mt-1">
                                    Related project: <span className="font-medium">{sug.related_project_name}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  className={`px-2.5 py-1 text-xs font-medium rounded-md border ${actionColor(sug.action)}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (sug.action === 'add_skill') {
                                      window.location.href = '/blocks';
                                    } else if (sug.action === 'add_to_block' && sug.related_block_id) {
                                      window.location.href = `/blocks`;
                                    }
                                  }}
                                >
                                  {actionLabel(sug.action)}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delete button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteResult(r.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete analysis
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
