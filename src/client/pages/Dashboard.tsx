import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { DashboardStats } from '../../shared/types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/dashboard')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!stats) return null;

  const cards = [
    { label: 'Systems', value: stats.systems_count, href: '/systems', icon: '⬡' },
    { label: 'Blocks', value: stats.blocks_count, href: '/blocks', icon: '▤' },
    { label: 'Skills', value: stats.skills_count, href: '/blocks', icon: '✦' },
    { label: 'Job Postings', value: stats.job_postings_count, href: '/jobs', icon: '◆' },
    { label: 'Compiled CVs', value: stats.compiled_cvs_count, href: '/compiled', icon: '❖' },
    { label: 'Pending Questions', value: stats.pending_questions_count, href: '/questions', icon: '◌' },
  ];

  const steps = [
    { num: 1, text: <>Fill your <a href="/systems" className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-200">Systems</a> and <a href="/blocks" className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-200">Blocks</a> with your career details</> },
    { num: 2, text: <>Set up your <a href="/template" className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-200">Template CV</a> with education and employment history</> },
    { num: 3, text: <>Add <a href="/jobs" className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-200">Job Postings</a> you want to apply to</> },
    { num: 4, text: <>Connect an AI client via MCP and call <code className="text-sapphire-700 bg-cream-100 px-1.5 py-0.5 rounded text-xs">prepare_compilation</code></> },
    { num: 5, text: <>Run <code className="text-sapphire-700 bg-cream-100 px-1.5 py-0.5 rounded text-xs">prepare_red_team</code> to evaluate your CV</> },
    { num: 6, text: <>Answer <a href="/questions" className="text-teal-600 hover:text-teal-700 underline underline-offset-2 decoration-teal-200">Questions</a>, iterate until your score hits 90+</> },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="page-title">Welcome back</h2>
        <p className="text-sapphire-500 text-sm mt-1">Here's where your career stands today.</p>
      </div>

      {(() => {
        const milestones = [
          { label: 'Systems', done: stats.systems_count > 0 },
          { label: 'Blocks', done: stats.blocks_count > 0 },
          { label: 'Job Postings', done: stats.job_postings_count > 0 },
          { label: 'Compiled CV', done: stats.compiled_cvs_count > 0 },
        ];
        const completed = milestones.filter(m => m.done).length;
        const pct = Math.round((completed / milestones.length) * 100);
        return (
          <div className="card p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-sapphire-700">Setup progress</span>
              <span className="text-sm text-sapphire-500">{completed}/{milestones.length} steps</span>
            </div>
            <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-3 mt-3">
              {milestones.map(m => (
                <a key={m.label} href={m.label === 'Systems' ? '/systems' : m.label === 'Blocks' ? '/blocks' : m.label === 'Job Postings' ? '/jobs' : '/compiled'} className={`text-xs ${m.done ? 'text-teal-600' : 'text-sapphire-400'}`}>
                  {m.done ? '✓' : '○'} {m.label}
                </a>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {cards.map(card => (
          <a
            key={card.label}
            href={card.href}
            className="card p-4 group hover:border-sapphire-300 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-sapphire-900">{card.value}</p>
                <p className="text-sm text-sapphire-500 mt-0.5">{card.label}</p>
              </div>
              <span className="text-lg text-sapphire-300 group-hover:text-sapphire-400 transition-colors">{card.icon}</span>
            </div>
          </a>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">How it works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {steps.map(step => (
            <div key={step.num} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mint-100 border border-mint-200 flex items-center justify-center text-xs text-mint-700 font-medium">
                {step.num}
              </span>
              <p className="text-sm text-sapphire-600 pt-0.5">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
