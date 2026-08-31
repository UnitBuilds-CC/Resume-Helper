import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { JobPosting } from '../../shared/types';

interface QuestionWithAnswer {
  id: number;
  job_posting_id: number;
  question: string;
  question_type: string;
  sort_order: number;
  answer: string | null;
  is_auto_generated: number;
}

export default function QuestionnairePage() {
  const [searchParams] = useSearchParams();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [editingAnswers, setEditingAnswers] = useState<Map<number, string>>(new Map());

  async function loadPostings() {
    const res = await api('/api/job-postings');
    const data = await res.json();
    setPostings(data);
    setLoading(false);
    
    const jobId = searchParams.get('job');
    if (jobId) {
      const id = parseInt(jobId, 10);
      if (data.some((p: JobPosting) => p.id === id)) {
        setSelectedJobId(id);
        loadQuestions(id);
      }
    }
  }

  async function loadQuestions(jobId: number) {
    setQuestionsLoading(true);
    setSelectedJobId(jobId);
    try {
      const res = await api(`/api/questionnaires/all/${jobId}`);
      const data = await res.json();
      setQuestions(data);
      setEditingAnswers(new Map());
    } catch {
      setQuestions([]);
    }
    setQuestionsLoading(false);
  }

  useEffect(() => { loadPostings(); }, []);

  async function addQuestion() {
    if (!selectedJobId || !newQuestion.trim()) return;
    await api('/api/questionnaires/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_posting_id: selectedJobId,
        question: newQuestion.trim(),
        question_type: 'text',
      }),
    });
    setNewQuestion('');
    loadQuestions(selectedJobId);
  }

  async function saveAnswer(questionId: number, answer: string) {
    if (!selectedJobId) return;
    await api('/api/questionnaires/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_posting_id: selectedJobId,
        question_id: questionId,
        answer,
        is_auto_generated: false,
      }),
    });
    const newEditing = new Map(editingAnswers);
    newEditing.delete(questionId);
    setEditingAnswers(newEditing);
    loadQuestions(selectedJobId);
  }

  async function deleteQuestion(questionId: number) {
    if (!selectedJobId) return;
    await api(`/api/questionnaires/questions/${questionId}`, { method: 'DELETE' });
    loadQuestions(selectedJobId);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Application Questionnaires</h2>
        <p className="text-sapphire-400 text-sm mt-1">Manage application-specific questions and answers for each job.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-sapphire-700 mb-3">Job Postings</h3>
            {postings.length === 0 ? (
              <p className="text-sm text-sapphire-400">No job postings yet.</p>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {postings.map(job => (
                  <button
                    key={job.id}
                    onClick={() => loadQuestions(job.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedJobId === job.id
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'hover:bg-cream-50 text-sapphire-600'
                    }`}
                  >
                    <div className="font-medium truncate">{job.title}</div>
                    <div className="text-xs text-sapphire-400 truncate">{job.company}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selectedJobId ? (
            <div className="card p-8 text-center">
              <p className="text-sapphire-400">Select a job posting to view its questionnaire.</p>
            </div>
          ) : questionsLoading ? (
            <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-sapphire-800">
                  {postings.find(p => p.id === selectedJobId)?.title}
                </h3>
                <span className="text-sm text-sapphire-400">{questions.length} questions</span>
              </div>

              <div className="space-y-4 mb-6">
                {questions.length === 0 ? (
                  <p className="text-sm text-sapphire-400 text-center py-4">No questions yet. Add one below.</p>
                ) : (
                  questions.map(q => (
                    <div key={q.id} className="border border-cream-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-sapphire-700">{q.question}</span>
                            {q.is_auto_generated === 1 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-mint-50 text-mint-600 border border-mint-200">Auto</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          className="text-xs text-sapphire-400 hover:text-teal-600 shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-2">
                        {editingAnswers.has(q.id) ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingAnswers.get(q.id) || ''}
                              onChange={e => {
                                const newMap = new Map(editingAnswers);
                                newMap.set(q.id, e.target.value);
                                setEditingAnswers(newMap);
                              }}
                              className="input w-full resize-none text-sm"
                              rows={3}
                              placeholder="Your answer..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveAnswer(q.id, editingAnswers.get(q.id) || '')}
                                className="text-xs btn-primary px-3 py-1"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  const newMap = new Map(editingAnswers);
                                  newMap.delete(q.id);
                                  setEditingAnswers(newMap);
                                }}
                                className="text-xs btn-secondary px-3 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {q.answer ? (
                              <div
                                onClick={() => setEditingAnswers(new Map(editingAnswers).set(q.id, q.answer || ''))}
                                className="text-sm text-sapphire-600 bg-cream-50 rounded p-2 cursor-pointer hover:bg-cream-100 transition-colors"
                              >
                                {q.answer}
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingAnswers(new Map(editingAnswers).set(q.id, ''))}
                                className="text-xs text-teal-600 hover:text-teal-700"
                              >
                                + Add answer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-cream-200 pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addQuestion()}
                    placeholder="Add a new question..."
                    className="input flex-1"
                  />
                  <button onClick={addQuestion} className="btn-primary">Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
