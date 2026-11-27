import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// DATA_DIR is set before db.ts is imported so the suite gets the real schema in a throwaway directory.
// Duplicating the CREATE TABLE statements here would let the tests and the product drift apart, which is
// exactly how the red_team_results columns went missing for three months on existing databases.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'resume-helper-store-'));

type DB = import('better-sqlite3').Database;
let db: DB;

beforeAll(async () => {
  db = (await import('../../db.js')).default as unknown as DB;
});

const stores = () => Promise.all([
  import('../job-posting-store.js'),
  import('../compiled-cv-store.js'),
  import('../red-team-store.js'),
  import('../block-store.js'),
]);

const dimensions = () => ([
  { dimension_name: 'technical_skills', score: 80, weight: 0.25, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'experience_relevance', score: 80, weight: 0.2, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'achievement_focus', score: 80, weight: 0.15, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'seniority_level', score: 80, weight: 0.1, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'education', score: 80, weight: 0.05, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'location_logistics', score: 80, weight: 0.05, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'communication_quality', score: 80, weight: 0.08, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'culture_fit', score: 80, weight: 0.07, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'cv_structure', score: 80, weight: 0.03, feedback: 'f', strengths: [], gaps: [], evidence: [] },
  { dimension_name: 'red_flags', score: 80, weight: 0.02, feedback: 'f', strengths: [], gaps: [], evidence: [] },
]);

describe('job-posting-store', () => {
  it('rejects a status outside the vocabulary on both write paths', async () => {
    const { createJobPosting, updateJobPosting, setApplicationStatus, StoreError } = await stores().then(([j]) => j);
    const posting = createJobPosting(db, { title: 'Engineer', content: 'Builds things.' }) as { id: number };
    expect(() => setApplicationStatus(db, posting.id, { application_status: 'cv_ready' })).toThrow(StoreError);
    expect(() => updateJobPosting(db, posting.id, { application_status: 'red_team_complete' })).toThrow(StoreError);
  });

  it('treats an explicit null as unlink, and an absent key as leave-alone', async () => {
    const { createJobPosting, updateJobPosting, createCompiledCv } = await stores().then(([j, c]) => ({ ...j, ...c }));
    const posting = createJobPosting(db, { title: 'Engineer', content: 'Builds things.' }) as { id: number };
    const cv = createCompiledCv(db, { job_posting_id: posting.id, content: '# CV' }) as { id: number };

    updateJobPosting(db, posting.id, { compiled_cv_id: cv.id });
    expect((db.prepare('SELECT compiled_cv_id FROM job_postings WHERE id = ?').get(posting.id) as any).compiled_cv_id).toBe(cv.id);

    const untouched = updateJobPosting(db, posting.id, { notes: 'only notes changed' }) as any;
    expect(untouched.compiled_cv_id).toBe(cv.id);

    const cleared = updateJobPosting(db, posting.id, { compiled_cv_id: null }) as any;
    expect(cleared.compiled_cv_id).toBeNull();
  });

  it('refuses a link to a row that does not exist', async () => {
    const { createJobPosting, updateJobPosting } = await stores().then(([j]) => j);
    const posting = createJobPosting(db, { title: 'Engineer', content: 'Builds things.' }) as { id: number };
    expect(() => updateJobPosting(db, posting.id, { red_team_result_id: 987654 })).toThrow(/does not exist/);
  });
});

describe('compiled-cv-store', () => {
  it('assigns one version per posting, incrementing', async () => {
    const { createJobPosting, createCompiledCv } = await stores().then(([j, c]) => ({ ...j, ...c }));
    const posting = createJobPosting(db, { title: 'Engineer', content: 'Builds things.' }) as { id: number };
    const first = createCompiledCv(db, { job_posting_id: posting.id, content: '# v1' }) as any;
    const second = createCompiledCv(db, { job_posting_id: posting.id, content: '# v2' }) as any;
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(second.id).not.toBe(first.id);
  });

  it('will not create a CV for a posting that is not there', async () => {
    const { createCompiledCv } = await stores().then(([, c]) => c);
    expect(() => createCompiledCv(db, { job_posting_id: 987654, content: '# x' })).toThrow(/does not exist/);
  });
});

describe('red-team-store', () => {
  const freshCv = async () => {
    const { createJobPosting, createCompiledCv } = await stores().then(([j, c]) => ({ ...j, ...c }));
    const posting = createJobPosting(db, { title: 'Engineer', content: 'Builds things.' }) as { id: number };
    return createCompiledCv(db, { job_posting_id: posting.id, content: '# CV' }) as { id: number };
  };

  it('stores an evaluation whose total matches its dimensions, with dimensions and questions', async () => {
    const { saveRedTeamResult } = await stores().then(([, , r]) => r);
    const cv = await freshCv();
    const saved = saveRedTeamResult(db, {
      compiled_cv_id: cv.id, phase1_qualified: 1, phase2_score: 80, phase3_summary: 'Strong systems engineer.',
      overall_score: 80, full_analysis: 'text', recommendation: 'yes', dimensions: dimensions(),
      red_flags: [{ flag_type: 'education', severity: 'low', description: 'no degree' }],
      questions: [{ question: 'Do you have a transcript?', context: 'education gap', skill_tag: 'education' }],
    }) as any;
    expect(saved.overall_score).toBe(80);
    expect(saved.dimensions).toHaveLength(10);
    expect(saved.questions).toHaveLength(1);
    expect(saved.red_flags[0].severity).toBe('low');
  });

  it('refuses a total that is not the weighted sum, and writes nothing when it does', async () => {
    const { saveRedTeamResult, listRedTeamResults } = await stores().then(([, , r]) => r);
    const cv = await freshCv();
    const payload = {
      compiled_cv_id: cv.id, phase1_qualified: 1, phase2_score: 80, phase3_summary: 'ok',
      overall_score: 61, full_analysis: 'text', recommendation: 'yes', dimensions: dimensions(), red_flags: [],
    };
    expect(() => saveRedTeamResult(db, payload as any)).toThrow(/overall_score is 61/);
    expect(listRedTeamResults(db, cv.id)).toHaveLength(0);
  });

  it('refuses weights that do not sum to one', async () => {
    const { saveRedTeamResult } = await stores().then(([, , r]) => r);
    const cv = await freshCv();
    const dims = dimensions().map((d, i) => (i === 0 ? { ...d, weight: 0.4 } : d));
    expect(() => saveRedTeamResult(db, {
      compiled_cv_id: cv.id, phase1_qualified: 1, phase2_score: 80, phase3_summary: 'ok',
      overall_score: 90, dimensions: dims, recommendation: 'yes', full_analysis: 't', red_flags: [],
    } as any)).toThrow(/weights sum to/);
  });

  it('refuses an evaluation for a CV that does not exist', async () => {
    const { saveRedTeamResult } = await stores().then(([, , r]) => r);
    expect(() => saveRedTeamResult(db, {
      compiled_cv_id: 987654, phase1_qualified: 1, phase2_score: 80, phase3_summary: 'ok',
      overall_score: 80, dimensions: dimensions(), recommendation: 'yes', full_analysis: 't', red_flags: [],
    } as any)).toThrow(/does not exist/);
  });
});

describe('block-store', () => {
  const seeded = async () => {
    const { createBlock } = await stores().then(([, , , b]) => b);
    db.prepare('INSERT INTO systems (name) VALUES (?)').run('Doccit');
    const system = db.prepare('SELECT id FROM systems ORDER BY id DESC LIMIT 1').get() as { id: number };
    db.prepare('INSERT INTO employment (company, title, start_date, end_date) VALUES (?,?,?,?)')
      .run('Fictional Systems CC', 'Engineer', 'January 2024', 'December 2025');
    const employment = db.prepare('SELECT id FROM employment ORDER BY id DESC LIMIT 1').get() as { id: number };
    return { createBlock, system: system.id, employment: employment.id };
  };

  it('returns the link ids the edit form must send back', async () => {
    const { createBlock, system, employment } = await seeded();
    const { listBlocks } = await stores().then(([, , , b]) => b);
    const block = createBlock(db, { title: 'B', content: 'C', skills: ['Rust'], system_ids: [system], employment_ids: [employment] }) as any;
    expect(block.system_ids).toEqual([system]);
    expect(block.employment_ids).toEqual([employment]);
    const listed = listBlocks(db, { id: block.id })[0] as any;
    expect(listed.skills).toEqual(['Rust']);
    expect(listed.system_ids).toEqual([system]);
  });

  it('refuses a link to an unknown row instead of letting SQLite raise', async () => {
    const { createBlock, system } = await seeded();
    expect(() => createBlock(db, { title: 'B', content: 'C', system_ids: [987654] })).toThrow(/unknown id/);
    expect(() => createBlock(db, { title: 'B', content: 'C', system_ids: [system], employment_ids: ['3'] })).toThrow(/integers/);
  });

  it('leaves links alone when the field is absent, and clears them when it is an empty list', async () => {
    const { createBlock, system } = await seeded();
    const { updateBlock } = await stores().then(([, , , b]) => b);
    const block = createBlock(db, { title: 'B', content: 'C', system_ids: [system] }) as any;

    const edited = updateBlock(db, block.id, { content: 'C2' }) as any;
    expect(edited.system_ids).toEqual([system]);

    const cleared = updateBlock(db, block.id, { system_ids: [] }) as any;
    expect(cleared.system_ids).toEqual([]);
  });
});
