import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { Question } from '../../shared/types';

interface QuestionWithJob extends Question {
  job_title?: string;
  job_company?: string;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionWithJob[]>([]);
  const [filter, setFilter] = useState('pending');
  const [answering, setAnswering] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api(`/api/questions${filter ? `?status=${filter}` : ''}`);
    setQuestions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id: number, status: string) {
    await api(`/api/questions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, answer: status === 'answered' ? answer : null }) });
    setAnswering(null);
    setAnswer('');
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const statusColors: Record<string, string> = {
    pending: 'bg-teal-50 text-mint-600 border-teal-300/20',
    answered: 'bg-mint-50 text-mint-600 border-mint-300/20',
    dismissed: 'bg-earth-600/15 text-sapphire-400 border-sapphire-300/20',
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Questions</h2>
          <p className="text-sapphire-400 text-sm mt-1">Gaps the red team found. Answering these might unlock your next block.</p>
        </div>
        <div className="flex gap-1.5">
          {['pending', 'answered', 'dismissed', ''].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg transition-all ${filter === s ? 'bg-teal-100 text-mint-600 border border-teal-300/30' : 'text-sapphire-400 hover:text-sapphire-700 border border-transparent hover:border-cream-300/30'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {questions.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sapphire-400">No {filter || ''} questions. Run a red team evaluation to surface gap-analysis questions.</p>
        </div>
      )}

      <div className="space-y-3">
        {questions.map(q => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[q.status]}`}>{q.status}</span>
                  {q.job_title && <span className="text-xs text-sapphire-400">{q.job_title} @ {q.job_company}</span>}
                  {q.skill_tag && <span className="tag">{q.skill_tag}</span>}
                </div>
                <p className="text-sm text-sapphire-700">{q.question}</p>
                {q.context && <p className="text-xs text-sapphire-400 mt-1.5">{q.context}</p>}
                {q.answer && <p className="text-sm text-mint-600 mt-3 bg-mint-50 p-3 rounded-lg border border-mint-300/15">{q.answer}</p>}

                {answering === q.id && (
                  <div className="mt-3 flex gap-2">
                    <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer..." className="input flex-1" autoFocus />
                    <button onClick={() => updateStatus(q.id, 'answered')} className="btn-primary text-xs">Save</button>
                    <button onClick={() => { setAnswering(null); setAnswer(''); }} className="btn-secondary text-xs">Cancel</button>
                  </div>
                )}
              </div>
              {q.status === 'pending' && answering !== q.id && (
                <div className="flex gap-3 shrink-0 ml-4">
                  <button onClick={() => setAnswering(q.id)} className="text-xs text-teal-600 hover:text-mint-600">Answer</button>
                  <button onClick={() => updateStatus(q.id, 'dismissed')} className="text-xs text-sapphire-400 hover:text-sapphire-600">Dismiss</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
