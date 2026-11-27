import type Database from 'better-sqlite3';
import { evaluateRedTeam } from './red-team-evaluator.js';
import { listBlocks } from './block-store.js';
import { getCompiledCv } from './compiled-cv-store.js';
import { saveRedTeamResult } from './red-team-store.js';
import { recomputeOverall, RED_TEAM_DIMENSIONS } from './red-team-rubric.js';
import { StoreError } from './job-posting-store.js';

const term = (score: number, weight: number) => (score * weight).toFixed(2);

/** Generated from the dimensions themselves, so the analysis text can never disagree with the score. */
function buildAnalysis(result: ReturnType<typeof evaluateRedTeam>): string {
  const weightedSum = result.dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  const lines = [
    'PHASE 1 - KNOCKOUTS: ' + (result.phase1_qualified ? 'PASS' : 'FAIL'),
    '',
    'PHASE 2 - DETERMINISTIC EVALUATION (red-team-evaluator.ts, no AI in the loop)',
    ...RED_TEAM_DIMENSIONS.map((d) => {
      const dim = result.dimensions.find((x) => x.dimension_name === d.name)!;
      return '- ' + d.name + ': ' + dim.score + ' x ' + d.weight + ' = ' + term(dim.score, dim.weight) +
        (dim.gaps.length ? '  | gap: ' + dim.gaps[0] : '') +
        (dim.strengths.length ? '  | strength: ' + dim.strengths[0] : '');
    }),
    '',
    'Arithmetic: ' + result.dimensions.map((d) => term(d.score, d.weight)).join(' + ') +
      ' = ' + weightedSum.toFixed(2) + ' -> ' + Math.round(weightedSum) + '.',
    '',
    'PHASE 3 - WHAT MAKES THIS CANDIDATE STAND OUT',
    result.job_fit_summary,
    '',
    'RECOMMENDATION: ' + result.recommendation +
      (result.red_flags.length
        ? '; flags: ' + result.red_flags.map((f) => f.severity + '/' + f.flag_type).join(', ')
        : '; no flags detected'),
  ];
  return lines.join('\n');
}

/**
 * Runs the shipped evaluator against a stored CV and writes the result through the same guarded path an AI
 * client uses. The point is that a human with only the desktop app can complete the loop, and that both
 * producers are held to the same arithmetic.
 */
export function evaluateAndSave(db: Database.Database, compiledCvId: number) {
  const cv = getCompiledCv(db, compiledCvId);
  const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(cv.job_posting_id) as any;
  if (!job) throw new StoreError('compiled CV ' + compiledCvId + ' has no linked job posting to evaluate against');

  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all() as any[];
  const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all() as any[];
  const systems = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all() as any[];
  const blocks = listBlocks(db) as any[];

  const result = evaluateRedTeam(cv as any, job, templateCv, education, employment, systems, blocks);
  const overall = recomputeOverall(result.dimensions);

  return saveRedTeamResult(db, {
    compiled_cv_id: cv.id,
    phase1_qualified: result.phase1_qualified ? 1 : 0,
    phase2_score: overall,
    phase3_summary: result.job_fit_summary,
    overall_score: overall,
    full_analysis: buildAnalysis(result),
    recommendation: result.recommendation,
    job_fit_summary: result.job_fit_summary,
    dimensions: result.dimensions,
    red_flags: result.red_flags,
    questions: [],
  });
}
