import { describe, it, expect } from 'vitest';
import { evaluateRedTeam } from '../red-team-evaluator.js';
import { recomputeOverall, RED_TEAM_DIMENSIONS, validateRedTeamPayload } from '../red-team-rubric.js';

// The wiring contract: the shipped evaluator's own output has to survive the same guard an AI client's does,
// otherwise the product has two arithmetics and the "deterministic baseline" is a second opinion nobody
// checked. Fixtures are invented.

const cv = { id: 1, job_posting_id: 1, content: 'Rust engineer. Built a browser engine. AWS certified.', version: 1, created_at: '', updated_at: '' } as any;
const posting = { id: 1, title: 'Backend Engineer', company: 'Acme', url: null, content: 'Rust, APIs, AWS, Linux, remote-first team, tests before production.', notes: null, status: 'active', application_status: 'not_applied', applied_date: null, compiled_cv_id: null, red_team_result_id: null, created_at: '', updated_at: '' } as any;
const templateCv = { id: 1, full_name: 'Alex Sample', email: 'alex@example.com', phone: '1', location: 'Testville', linkedin: null, website: null, summary: 'Systems engineer.', professional_title: 'Software Engineer', updated_at: '' } as any;
const employment = [
  { id: 1, template_cv_id: 1, company: 'Fictional Systems CC', title: 'Software Engineer', start_date: 'January 2024', end_date: 'December 2025', location: 'Elsewhere', description: 'ERP and WMS.', details: null, sort_order: 0 },
  { id: 2, template_cv_id: 1, company: 'Sample Retail', title: 'Bookkeeper', start_date: 'January 2020', end_date: 'December 2023', location: 'Elsewhere', description: 'Accounts.', details: null, sort_order: 1 },
] as any;

describe('red-team-evaluator agrees with red-team-rubric', () => {
  const result = evaluateRedTeam(cv, posting, templateCv, [], employment, [], []);

  it('declares exactly the rubric dimensions, with the rubric weights', () => {
    expect(result.dimensions.map((d) => d.dimension_name).sort())
      .toEqual(RED_TEAM_DIMENSIONS.map((d) => d.name).sort());
    for (const d of result.dimensions) {
      const expected = RED_TEAM_DIMENSIONS.find((x) => x.name === d.dimension_name)!.weight;
      expect(d.weight).toBeCloseTo(expected, 10);
    }
  });

  it('scores its weighted sum from the same function the save paths validate with', () => {
    expect(result.weighted_score).toBe(recomputeOverall(result.dimensions));
  });

  it('produces a payload the store would accept', () => {
    const problems = validateRedTeamPayload({
      phase1_qualified: result.phase1_qualified ? 1 : 0,
      phase2_score: result.weighted_score,
      phase3_summary: result.job_fit_summary,
      overall_score: result.weighted_score,
      recommendation: result.recommendation,
      dimensions: result.dimensions,
      red_flags: result.red_flags,
    });
    expect(problems).toEqual([]);
  });

  it('gives every flag a severity the validator recognises', () => {
    for (const flag of result.red_flags) expect(['low', 'medium', 'high', 'critical']).toContain(flag.severity);
  });

  it('does not double-count a critical flag, which the old normalised formula did', () => {
    // The red_flags dimension already deducts severity penalties; the total must not deduct them again.
    const dims = result.dimensions.map((d) => ({ dimension_name: d.dimension_name, score: d.score, weight: d.weight, feedback: d.feedback }));
    const redDim = dims.find((d) => d.dimension_name === 'red_flags')!;
    expect(result.weighted_score).toBe(Math.round(dims.reduce((a, d) => a + d.score * d.weight, 0)));
    expect(redDim.score).toBeLessThanOrEqual(100);
  });
});
