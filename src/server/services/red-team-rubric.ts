// The red-team rubric existed in three places at once: the guide prepare_red_team hands the evaluating
// agent, the two writers that store whatever comes back, and nothing that checked the two agreed. That is
// how a stored analysis ended up with an overall_score one point below the sum of its own dimensions.
// This module is the single source: the guide is built from it, and both save paths validate against it.

export const RED_TEAM_DIMENSIONS = [
  { name: 'technical_skills', weight: 0.25, criteria: 'Required skills coverage, depth indicators, technology stack alignment' },
  { name: 'experience_relevance', weight: 0.2, criteria: 'Years of experience, domain relevance, industry alignment, scale of work' },
  { name: 'achievement_focus', weight: 0.15, criteria: 'Quantified achievements, action-oriented language, impact vs responsibilities' },
  { name: 'seniority_level', weight: 0.1, criteria: 'Years vs job level, leadership indicators, career progression' },
  { name: 'education', weight: 0.05, criteria: 'Required degree, field relevance, certifications' },
  { name: 'location_logistics', weight: 0.05, criteria: 'Remote alignment, time zone, work authorization' },
  { name: 'communication_quality', weight: 0.08, criteria: 'Writing clarity, grammar, formatting, conciseness' },
  { name: 'culture_fit', weight: 0.07, criteria: 'Values alignment, work style, mission fit' },
  { name: 'cv_structure', weight: 0.03, criteria: 'Required sections, formatting, length' },
  { name: 'red_flags', weight: 0.02, criteria: 'Employment gaps, job hopping, inconsistencies (penalty dimension)' },
] as const;

export const DIMENSION_WEIGHTS: Record<string, number> = Object.fromEntries(
  RED_TEAM_DIMENSIONS.map((d) => [d.name, d.weight])
);

export const RECOMMENDATION_THRESHOLDS = {
  strong_yes: 85, yes: 70, maybe: 55, no: 40, strong_no: 0,
} as const;

export const RECOMMENDATIONS = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'] as const;
export const FLAG_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const EPSILON = 1e-9;

export interface RedTeamDimensionInput {
  dimension_name?: unknown;
  score?: unknown;
  weight?: unknown;
}

export interface RedTeamPayloadInput {
  phase1_qualified?: unknown;
  phase2_score?: unknown;
  phase3_summary?: unknown;
  overall_score?: unknown;
  recommendation?: unknown;
  dimensions?: unknown;
  red_flags?: unknown;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The unrounded weighted sum, so a rejection can show what was thrown away by rounding. */
export function weightedSum(dimensions: RedTeamDimensionInput[]): number {
  return dimensions.reduce(
    (sum, d) => sum + (isFiniteNumber(d?.score) ? d.score : 0) * (isFiniteNumber(d?.weight) ? d.weight : 0),
    0
  );
}

/** The score the stored dimensions actually describe. */
export function recomputeOverall(dimensions: RedTeamDimensionInput[]): number {
  return Math.round(weightedSum(dimensions));
}

/**
 * Returns a list of human-readable problems; an empty list means the payload may be stored.
 * Deliberately strict on arithmetic and vocabulary, and deliberately permissive on `recommendation`,
 * which is judgement: an analysis may sit above a threshold and still say maybe, provided it explains why.
 */
export function validateRedTeamPayload(payload: RedTeamPayloadInput): string[] {
  const problems: string[] = [];

  if (payload.phase1_qualified !== 0 && payload.phase1_qualified !== 1 &&
      payload.phase1_qualified !== true && payload.phase1_qualified !== false) {
    problems.push('phase1_qualified must be 0 or 1 (got ' + JSON.stringify(payload.phase1_qualified) + ')');
  }
  if (!isFiniteNumber(payload.phase2_score) || payload.phase2_score < 0 || payload.phase2_score > 100) {
    problems.push('phase2_score must be a number between 0 and 100');
  }
  if (typeof payload.phase3_summary !== 'string' || !payload.phase3_summary.trim()) {
    problems.push('phase3_summary must be a non-empty string');
  }
  if (payload.recommendation != null && !(RECOMMENDATIONS as readonly string[]).includes(String(payload.recommendation))) {
    problems.push('recommendation must be one of ' + RECOMMENDATIONS.join(', ') + ' (got ' + JSON.stringify(payload.recommendation) + ')');
  }

  const dimensions = Array.isArray(payload.dimensions) ? (payload.dimensions as RedTeamDimensionInput[]) : null;
  if (!dimensions || dimensions.length === 0) {
    problems.push('dimensions must be a non-empty array');
    return problems;
  }

  const seen = new Set<string>();
  for (const d of dimensions) {
    const name = String(d?.dimension_name ?? '');
    if (!Object.prototype.hasOwnProperty.call(DIMENSION_WEIGHTS, name)) {
      problems.push('unknown dimension "' + name + '"; the rubric is ' + Object.keys(DIMENSION_WEIGHTS).join(', '));
      continue;
    }
    if (seen.has(name)) problems.push('dimension "' + name + '" appears more than once');
    seen.add(name);
    if (!isFiniteNumber(d.score) || d.score < 0 || d.score > 100) {
      problems.push('dimension "' + name + '" score must be 0-100');
    }
    if (!isFiniteNumber(d.weight) || Math.abs((d.weight as number) - DIMENSION_WEIGHTS[name]) > EPSILON) {
      problems.push('dimension "' + name + '" weight must be ' + DIMENSION_WEIGHTS[name] + ' (got ' + JSON.stringify(d.weight) + ')');
    }
  }

  const weightSum = dimensions.reduce((s, d) => s + (isFiniteNumber(d.weight) ? d.weight : 0), 0);
  if (Math.abs(weightSum - 1) > 1e-6) {
    problems.push('dimension weights sum to ' + weightSum.toFixed(4) + ', expected 1.0000');
  }

  if (isFiniteNumber(payload.overall_score)) {
    const computed = recomputeOverall(dimensions);
    if (payload.overall_score !== computed) {
      problems.push('overall_score is ' + payload.overall_score + ' but the stored dimensions compute ' + weightedSum(dimensions).toFixed(2) + ' -> ' + computed);
    }
  } else {
    problems.push('overall_score must be a number; the server will not default it to 0');
  }

  if (payload.red_flags !== undefined && payload.red_flags !== null) {
    if (!Array.isArray(payload.red_flags)) {
      problems.push('red_flags must be an array');
    } else {
      payload.red_flags.forEach((f: any, i: number) => {
        if (!f || typeof f !== 'object') { problems.push('red_flags[' + i + '] must be an object'); return; }
        if (typeof f.flag_type !== 'string' || !f.flag_type.trim()) problems.push('red_flags[' + i + '] needs a flag_type');
        if (!(FLAG_SEVERITIES as readonly string[]).includes(String(f.severity))) {
          problems.push('red_flags[' + i + '] severity must be one of ' + FLAG_SEVERITIES.join(', ') + ' (got ' + JSON.stringify(f.severity) + ')');
        }
      });
    }
  }

  return problems;
}
