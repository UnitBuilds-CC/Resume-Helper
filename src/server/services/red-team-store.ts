import type Database from 'better-sqlite3';
import { StoreError } from './job-posting-store.js';
import { validateRedTeamPayload } from './red-team-rubric.js';

export interface RedTeamDimensionInput {
  dimension_name: string;
  score: number;
  weight: number;
  feedback?: string;
  strengths?: string[];
  gaps?: string[];
  evidence?: string[];
}

export interface RedTeamInput {
  compiled_cv_id: number;
  phase1_qualified: number | boolean;
  phase2_score: number;
  phase3_summary: string;
  overall_score: number;
  full_analysis?: string;
  recommendation?: string | null;
  job_fit_summary?: string | null;
  dimensions: RedTeamDimensionInput[];
  red_flags?: unknown[];
  questions?: { question: string; context?: string | null; skill_tag?: string | null }[];
}

const parseJson = (value: unknown, fallback: unknown) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

/**
 * The single write path for an evaluation. It validates before touching the database, because both callers
 * used to persist whatever they were handed - including a total that disagreed with the dimensions beside it.
 */
export function saveRedTeamResult(db: Database.Database, input: RedTeamInput) {
  if (!input.compiled_cv_id) throw new StoreError('compiled_cv_id is required');
  const cv = db.prepare('SELECT id FROM compiled_cvs WHERE id = ?').get(input.compiled_cv_id);
  if (!cv) throw new StoreError('compiled CV ' + input.compiled_cv_id + ' does not exist', [], 404);

  const problems = validateRedTeamPayload(input);
  if (problems.length) throw new StoreError('red team result rejected', problems);

  const phase1 = input.phase1_qualified === true || input.phase1_qualified === 1 ? 1 : 0;

  const write = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO red_team_results
        (compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis,
         recommendation, red_flags, job_fit_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(input.compiled_cv_id, phase1, input.phase2_score, input.phase3_summary, input.overall_score,
          input.full_analysis ?? '', input.recommendation ?? null, JSON.stringify(input.red_flags ?? []),
          input.job_fit_summary ?? null);

    const resultId = Number(result.lastInsertRowid);
    const insertDimension = db.prepare(
      `INSERT INTO red_team_dimensions
        (red_team_result_id, dimension_name, score, weight, feedback, strengths, gaps, evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of input.dimensions) {
      insertDimension.run(resultId, d.dimension_name, d.score, d.weight, d.feedback ?? '',
        JSON.stringify(d.strengths ?? []), JSON.stringify(d.gaps ?? []), JSON.stringify(d.evidence ?? []));
    }

    const insertQuestion = db.prepare(
      'INSERT INTO questions (red_team_result_id, question, context, skill_tag) VALUES (?, ?, ?, ?)'
    );
    for (const q of input.questions ?? []) {
      insertQuestion.run(resultId, q.question, q.context ?? null, q.skill_tag ?? null);
    }
    return resultId;
  });

  const resultId = write();
  const saved = listRedTeamResults(db, input.compiled_cv_id).find((r) => r.id === resultId);
  if (!saved) throw new StoreError('evaluation was written but cannot be read back', [], 500);
  return saved;
}

/** Shared read used by the REST route, the UI and the MCP bundle, so JSON columns are parsed in one place. */
export function listRedTeamResults(db: Database.Database, compiledCvId: unknown) {
  const rows = db.prepare(
    'SELECT * FROM red_team_results WHERE compiled_cv_id = ? ORDER BY created_at DESC'
  ).all(Number(compiledCvId)) as any[];

  const dimensions = db.prepare('SELECT * FROM red_team_dimensions WHERE red_team_result_id = ? ORDER BY id ASC');
  const questions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ? ORDER BY id ASC');

  return rows.map((r) => ({
    ...r,
    red_flags: parseJson(r.red_flags, []) as unknown[],
    dimensions: (dimensions.all(r.id) as any[]).map((d) => ({
      ...d,
      strengths: parseJson(d.strengths, []) as string[],
      gaps: parseJson(d.gaps, []) as string[],
      evidence: parseJson(d.evidence, []) as string[],
    })),
    questions: questions.all(r.id) as unknown[],
  }));
}
