import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'resume-helper-timeline-'));

type DB = import('better-sqlite3').Database;
let db: DB;

beforeAll(async () => {
  db = (await import('../../db.js')).default as unknown as DB;
});

const timeline = () => import('../timeline.js');
const store = () => import('../timeline-store.js');

describe('canonicalizeDate', () => {
  it('accepts the forms a person actually has, and records the precision each asserts', async () => {
    const { canonicalizeDate } = await timeline();
    const problems: string[] = [];
    expect(canonicalizeDate('2025-04-17', 'x', problems)).toEqual({ iso: '2025-04-17', precision: 'day' });
    expect(canonicalizeDate('2025-04', 'x', problems)).toEqual({ iso: '2025-04-01', precision: 'month' });
    expect(canonicalizeDate('2020', 'x', problems)).toEqual({ iso: '2020-01-01', precision: 'year' });
    expect(canonicalizeDate('April 2025', 'x', problems)).toEqual({ iso: '2025-04-01', precision: 'month' });
    expect(canonicalizeDate('Present', 'x', problems)).toEqual({ iso: null, precision: 'day' });
    expect(canonicalizeDate(null, 'x', problems)).toEqual({ iso: null, precision: 'day' });
    expect(problems).toEqual([]);
  });

  it('refuses an ambiguous value instead of inventing a meaning for it', async () => {
    const { canonicalizeDate } = await timeline();
    const problems: string[] = [];
    const result = canonicalizeDate('End 2024', 'end_date', problems);
    expect(result.iso).toBeNull();
    expect(problems[0]).toMatch(/end_date is not a date this product can store/);

    const bad: string[] = [];
    expect(canonicalizeDate('2025-13-01', 'x', bad).iso).toBeNull();
    expect(bad.join(' ')).toMatch(/not a real calendar date/);

    const junk: string[] = [];
    expect(canonicalizeDate('sometime in the spring', 'x', junk).iso).toBeNull();
  });
});

describe('renderDate', () => {
  it('renders according to the precision the owner vouched for', async () => {
    const { renderDate } = await timeline();
    expect(renderDate('2024-12-31', null, 'year')).toBe('2024');
    expect(renderDate('2025-04-01', null, 'month')).toBe('April 2025');
    expect(renderDate('2025-04-17', null, 'day')).toBe('April 2025-04-17');
    expect(renderDate(null, null, 'month')).toBe('Present');
  });
});

describe('extractClaims', () => {
  it('finds the dates a paragraph asserts, without double counting a month-name year', async () => {
    const { extractClaims } = await timeline();
    const claims = extractClaims('At CoLab, April 2025 to September 2026, remote since 2020.');
    const texts = claims.map((c) => c.text);
    expect(texts).toContain('April 2025');
    expect(texts).toContain('September 2026');
    expect(texts).toContain('2020');
    expect(claims.filter((c) => c.text === '2025').length).toBe(0);
    expect(claims.filter((c) => c.text === '2026').length).toBe(0);
  });
});

describe('checkTimeline', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 1, company: 'Acme', title: 'Engineer', start_date: '2024-01-01', end_date: '2025-01-01',
    start_precision: 'day', end_precision: 'day', ...over,
  });

  it('does not compare legacy strings alphabetically', async () => {
    const { checkTimeline } = await timeline();
    // "December 2025" sorts before "January 2024" as text, which once reported a correctly ordered career as
    // ending before it began, and a past date as being in the future.
    const rows = [
      { id: 1, company: 'Fictional Systems CC', title: 'Engineer', start_date: 'January 2024', end_date: 'December 2025' },
    ];
    expect(checkTimeline(rows, '2026-11-27').problems).toEqual([]);
  });

  it('names the row whose date cannot be read at all', async () => {
    const { checkTimeline } = await timeline();
    const result = checkTimeline(
      [{ id: 7, company: 'Acme', title: 'x', start_date: 'End 2024', end_date: null }],
      '2026-11-27'
    );
    expect(result.problems.join(' ')).toMatch(/employment #7 \(Acme\): start_date is not a date/);
  });

  it('refuses an impossible order and a future end', async () => {
    const { checkTimeline } = await timeline();
    expect(checkTimeline([row({ start_date: '2025-06-01', end_date: '2025-01-01' })], '2026-11-27').problems.join(' '))
      .toMatch(/ends 2025-01-01 before it starts 2025-06-01/);
    expect(checkTimeline([row({ end_date: '2030-01-01' })], '2026-11-27').problems.join(' ')).toMatch(/ends in the future/);
  });

  it('reports overlap as a note, including a role that is still open', async () => {
    const { checkTimeline } = await timeline();
    const rows = [
      row({ id: 1, company: 'CoLab', start_date: '2025-04-01', end_date: '2026-09-01' }),
      row({ id: 2, company: 'Own CC', start_date: '2026-05-01', end_date: null }),
    ];
    const result = checkTimeline(rows, '2026-11-27');
    expect(result.problems).toEqual([]);
    expect(result.notes.join(' ')).toMatch(/CoLab\) overlaps #2 \(Own CC/);
  });

  it('flags a year-precision end that is not stored as the year end', async () => {
    const { checkTimeline } = await timeline();
    const result = checkTimeline([row({ end_date: '2024-06-30', end_precision: 'year' })], '2026-11-27');
    expect(result.notes.join(' ')).toMatch(/should be stored as 2024-12-31/);
  });
});

describe('writeEmployment', () => {
  it('stores canonical dates from the human form and refuses nonsense', async () => {
    const { writeEmployment } = await store();
    const created = writeEmployment(db, null, {
      company: 'Acme Analytics', title: 'Engineer', start_date: 'March 2023', end_date: 'August 2024',
    }) as any;
    expect(created.start_date).toBe('2023-03-01');
    expect(created.start_precision).toBe('month');
    expect(created.start_label).toBe('March 2023');
    expect(created.end_label).toBe('August 2024');
    expect(created.commitment).toBe('full_time');

    expect(() => writeEmployment(db, null, { company: 'X', start_date: 'End 2024' })).toThrow(/not a date this product can store/);
    expect(() => writeEmployment(db, null, { company: 'X', start_date: '2024-06-01', end_date: '2024-01-01' })).toThrow(/before it starts/);
    expect(() => writeEmployment(db, null, { company: 'X', start_date: '2024-01-01', end_date: '2099-01-01' })).toThrow(/future/);
    expect(() => writeEmployment(db, null, { company: 'X', start_date: '2024-01-01', commitment: 'casual' })).toThrow(/commitment/);
    expect(() => writeEmployment(db, null, { start_date: '2024-01-01' })).toThrow(/company is required/);
  });

  it('leaves a field alone when the key is absent, and clears an end date when it is null', async () => {
    const { writeEmployment } = await store();
    const created = writeEmployment(db, null, {
      company: 'Globex', title: 'Analyst', start_date: '2020', end_date: '2022',
    }) as any;
    expect(created.start_precision).toBe('year');
    expect(created.start_label).toBe('2020');

    const untouched = writeEmployment(db, created.id, { description: 'only notes' }) as any;
    expect(untouched.start_date).toBe('2020-01-01');
    expect(untouched.start_precision).toBe('year');

    const openEnded = writeEmployment(db, created.id, { end_date: 'Present' }) as any;
    expect(openEnded.end_date).toBeNull();
    expect(openEnded.end_label).toBe('Present');
  });
});

describe('assertClaimsGrounded', () => {
  it('refuses prose whose dates no record supports, and passes once acknowledged', async () => {
    const { writeEmployment } = await store();
    const { assertClaimsGrounded } = await timeline();
    writeEmployment(db, null, { company: 'Initech', title: 'Engineer', start_date: 'January 2021', end_date: 'March 2023' });

    expect(assertClaimsGrounded(db, 'Employed January 2021 to March 2023.', 'cv').checked).toBeGreaterThan(0);

    let caught: unknown;
    try {
      assertClaimsGrounded(db, 'Employed June 2019 to March 2023.', 'cv');
    } catch (err) { caught = err; }
    expect((caught as Error).message).toMatch(/June 2019/);
    expect((caught as { status?: number }).status).toBe(409);
    expect((caught as { problems?: string[] }).problems?.join(' ')).toMatch(/acknowledge="confirmed_change"/);

    const acknowledged = assertClaimsGrounded(db, 'Employed June 2019 to March 2023.', 'cv', 'confirmed_change');
    expect(acknowledged).toMatchObject({ acknowledged: true });
  });

  it('anchors a date that belongs to education rather than employment', async () => {
    const { assertClaimsGrounded } = await timeline();
    db.prepare(`INSERT INTO education (institution, degree, field, start_date, end_date, start_precision, end_precision, sort_order)
                VALUES ('Swakopmund Senior', 'AS Level', 'General', '2016-01-01', '2016-12-31', 'year', 'year', 9)`).run();
    expect(() => assertClaimsGrounded(db, 'Completed AS Level in 2016.', 'cv')).not.toThrow();
  });
});
