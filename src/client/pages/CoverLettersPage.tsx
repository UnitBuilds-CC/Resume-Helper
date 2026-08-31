import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { JobPosting, CoverLetter } from '../../shared/types';

export default function CoverLettersPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadJobs() {
    const res = await api('/api/job-postings');
    setJobs(await res.json());
    setLoading(false);
  }

  async function loadCoverLetters(jobId: number) {
    const res = await api(`/api/cover-letters/${jobId}`);
    if (res.ok) {
      const coverLetter = await res.json();
      setCoverLetters([coverLetter]);
      setSelectedVersion(coverLetter.version);
      setEditContent(coverLetter.content);
    } else {
      setCoverLetters([]);
      setEditContent('');
    }
  }

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (selectedJob) loadCoverLetters(selectedJob); }, [selectedJob]);

  async function generateCoverLetter() {
    if (!selectedJob) return;
    const res = await api(`/api/cover-letters/${selectedJob}`, { method: 'POST' });
    if (res.ok) {
      const coverLetter = await res.json();
      setCoverLetters([coverLetter]);
      setSelectedVersion(coverLetter.version);
      setEditContent(coverLetter.content);
      toast('Cover letter generated');
    } else {
      toast('Failed to generate cover letter', 'error');
    }
  }

  async function saveCoverLetter() {
    if (!coverLetters[0]) return;
    const res = await api(`/api/cover-letters/${coverLetters[0].id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      toast('Cover letter saved');
      setEditing(false);
      loadCoverLetters(selectedJob!);
    } else {
      toast('Failed to save cover letter', 'error');
    }
  }

  async function exportPdf() {
    if (!coverLetters[0]) return;
    window.open(`/api/cover-letters/${coverLetters[0].id}/pdf`, '_blank');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Cover Letters</h2>
        <p className="text-sapphire-400 text-sm mt-1">Generate and manage tailored cover letters for your job applications.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job list */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-sapphire-700 mb-3">Job Postings</h3>
            {jobs.length === 0 ? (
              <p className="text-sm text-sapphire-400">No job postings yet.</p>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedJob === job.id
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

        {/* Cover letter viewer/editor */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <div className="card p-8 text-center">
              <p className="text-sapphire-400">Select a job posting to view or generate a cover letter.</p>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-sapphire-800">
                    {jobs.find(j => j.id === selectedJob)?.title}
                  </h3>
                  <p className="text-sm text-sapphire-400">
                    {jobs.find(j => j.id === selectedJob)?.company}
                  </p>
                </div>
                <div className="flex gap-2">
                  {coverLetters.length > 0 && (
                    <>
                      <button
                        onClick={() => setEditing(!editing)}
                        className="btn-secondary text-sm"
                      >
                        {editing ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={exportPdf}
                        className="btn-secondary text-sm"
                      >
                        Export PDF
                      </button>
                    </>
                  )}
                  <button
                    onClick={generateCoverLetter}
                    className="btn-primary text-sm"
                  >
                    {coverLetters.length > 0 ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              </div>

              {coverLetters.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sapphire-400 mb-4">No cover letter generated yet.</p>
                  <button
                    onClick={generateCoverLetter}
                    className="btn-primary"
                  >
                    Generate Cover Letter
                  </button>
                </div>
              ) : editing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="input w-full h-96 resize-none font-mono text-sm"
                />
              ) : (
                <div className="bg-cream-50 p-6 rounded-lg border border-cream-200 whitespace-pre-wrap text-sm text-sapphire-700">
                  {coverLetters[0]?.content}
                </div>
              )}

              {editing && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveCoverLetter}
                    className="btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
