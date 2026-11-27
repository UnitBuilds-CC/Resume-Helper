import { describe, it, expect } from 'vitest';
import {
  RED_TEAM_DIMENSIONS, DIMENSION_WEIGHTS, recomputeOverall, validateRedTeamPayload,
} from '../red-team-rubric.js';

// This validator exists because a real analysis was stored with overall_score 81 while its own dimensions
// summed to 82.04: one term had been left behind after a dimension was re-scored, and nothing compared the
// two. The first test below is that exact payload.

type Dim = { dimension_name: string; score: number; weight: number; feedback: string };

const SCORES: Record<string, number> = {
  technical_skills: 82, experience_relevance: 85, achievement_focus: 80, seniority_level: 78,
  education: 65, location_logistics: 85, communication_quality: 90, culture_fit: 90, cv_structure: 78,
  red_flags: 70,
};

const validDimensions: Dim[] = RED_TEAM_DIMENSIONS.map((d) => ({
  dimension_name: d.name,
  weight: d.weight,
  score: SCORES[d.name],
  feedback: 'ok',
}));

const basePayload = () => ({
  phase1_qualified: 1,
  phase2_score: 82,
  phase3_summary: 'Built the renderer this product depends on.',
  overall_score: recomputeOverall(validDimensions),
  full_analysis: 'text',
  recommendation: 'maybe',
  dimensions: validDimensions,
  red_flags: [{ flag_type: 'stack_tenure_gap', severity: 'high', description: 'Rails is contribution-level' }],
});

describe('recomputeOverall', () => {
  it('is the rounded weighted sum of the dimensions it is given', () => {
    expect(recomputeOverall(validDimensions)).toBe(82);
  });

  it('ignores nothing when a weight is missing rather than treating it as full score', () => {
    expect(recomputeOverall([{ dimension_name: 'technical_skills', score: 100 }])).toBe(0);
  });
});

describe('validateRedTeamPayload', () => {
  it('accepts a payload whose total matches its dimensions', () => {
    expect(validateRedTeamPayload(basePayload())).toEqual([]);
  });

  it('rejects the stored defect: total one below the sum of its own dimensions', () => {
    const p = { ...basePayload(), overall_score: 81 };
    const problems = validateRedTeamPayload(p);
    expect(problems.join(' ')).toMatch(/overall_score is 81 but the stored dimensions compute 82\.04 -> 82/);
  });

  it('rejects a weight that does not match the rubric', () => {
    const dims = validDimensions.map((d) => ({ ...d }));
    dims[0].weight = 0.5;
    const problems = validateRedTeamPayload({ ...basePayload(), dimensions: dims, overall_score: recomputeOverall(dims) });
    expect(problems.join(' ')).toMatch(/technical_skills" weight must be 0\.25/);
    expect(problems.join(' ')).toMatch(/weights sum to 1\.2500/);
  });

  it('rejects an invented dimension name', () => {
    const dims = validDimensions.slice(0, 9).concat([{ dimension_name: 'vibes', weight: 0.02, score: 50, feedback: '' }]);
    const problems = validateRedTeamPayload({ ...basePayload(), dimensions: dims, overall_score: recomputeOverall(dims) });
    expect(problems.join(' ')).toMatch(/unknown dimension "vibes"/);
  });

  it('rejects a duplicated dimension, which would double-count its weight', () => {
    const dims = validDimensions.concat([{ ...validDimensions[0] }]);
    const problems = validateRedTeamPayload({ ...basePayload(), dimensions: dims, overall_score: recomputeOverall(dims) });
    expect(problems.join(' ')).toMatch(/appears more than once/);
  });

  it('rejects a missing phase3_summary instead of storing an empty paragraph', () => {
    expect(validateRedTeamPayload({ ...basePayload(), phase3_summary: '   ' })).toContain(
      'phase3_summary must be a non-empty string'
    );
  });

  it('rejects a recommendation outside the declared vocabulary but allows a justified deviation', () => {
    expect(validateRedTeamPayload({ ...basePayload(), recommendation: 'definitely' }).join(' ')).toMatch(/recommendation must be one of/);
    // 82 sits above the yes threshold; a lower label is the analyst speaking, not a malformed row.
    expect(validateRedTeamPayload({ ...basePayload(), recommendation: 'maybe' })).toEqual([]);
  });

  it('rejects a red flag with no severity, which used to crash the page that renders it', () => {
    const problems = validateRedTeamPayload({
      ...basePayload(),
      red_flags: [{ flag_type: 'unmeasured_scale', description: 'no traffic figures' }],
    });
    expect(problems.join(' ')).toMatch(/red_flags\[0\] severity must be one of/);
  });

  it('accepts an omitted red_flags array - the column is allowed to be empty', () => {
    const p = basePayload() as Record<string, unknown>;
    delete p.red_flags;
    expect(validateRedTeamPayload(p)).toEqual([]);
  });

  it('refuses a payload with no dimensions at all', () => {
    expect(validateRedTeamPayload({ ...basePayload(), dimensions: [] }).join(' ')).toMatch(/non-empty array/);
  });
});

describe('the rubric itself', () => {
  it('has weights that sum to exactly 1', () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('declares ten dimensions, matching what prepare_red_team advertises', () => {
    expect(RED_TEAM_DIMENSIONS).toHaveLength(10);
  });
});
