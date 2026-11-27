import type Database from 'better-sqlite3';
import { StoreError } from './job-posting-store.js';
import { canonicalizeDate, checkTimeline, precisionFor, renderDate, type DatePrecision } from './timeline.js';
export interface EmploymentWrite {
  company?: unknown; title?: unknown; start_date?: unknown; end_date?: unknown;
  location?: unknown; description?: unknown; sort_order?: unknown;
  start_precision?: unknown; end_precision?: unknown; commitment?: unknown;
}

/**
 * Employment is the timeline the rest of the product is checked against, so it is the one place where a
 * malformed date is refused outright. Values are stored canonically and the asserted precision is kept,
 * because "2024" and "2024-12-31" are different claims and the owner is the only one who knows which.
 */
export function writeEmployment(db: Database.Database, id: number | null, body: EmploymentWrite) {
  const problems: string[] = [];
  const start = canonicalizeDate(body.start_date, 'start_date', problems);
  const end = canonicalizeDate(body.end_date, 'end_date', problems);
  const startPrecision = precisionFor(body.start_precision, start) as DatePrecision;
  const endPrecision = precisionFor(body.end_precision, end) as DatePrecision;

  if (body.commitment != null && !['full_time', 'part_time', 'contract'].includes(String(body.commitment))) {
    problems.push('commitment must be full_time, part_time or contract');
  }

  // Ordering and future-dating are decided in one place - checkTimeline - so the write path and the read
  // path cannot disagree about whether the same record is valid.
  const existing = id == null ? null : db.prepare('SELECT * FROM employment WHERE id = ?').get(id) as any;
  if (id != null && !existing) throw new StoreError('employment ' + id + ' does not exist', [], 404);
  const candidate = {
    id: existing?.id ?? 0,
    company: String(body.company ?? existing?.company ?? ''),
    title: existing?.title ?? null,
    start_date: body.start_date === undefined ? existing?.start_date : start.iso,
    end_date: body.end_date === undefined ? existing?.end_date : end.iso,
    start_precision: body.start_date === undefined ? existing?.start_precision : startPrecision,
    end_precision: body.end_date === undefined ? existing?.end_precision : endPrecision,
  };
  const labelled = checkTimeline([candidate]).problems
    .map((p) => (candidate.id === 0 ? p.replace('employment #0', 'the new employment row') : p));
  problems.push(...labelled);
  if (problems.length) throw new StoreError('employment rejected', [...new Set(problems)]);

  if (id == null) {
    if (typeof body.company !== 'string' || !body.company.trim()) throw new StoreError('employment rejected', ['company is required']);
    if (!start.iso) throw new StoreError('employment rejected', ['start_date is required']);
    const inserted = db.prepare(
      `INSERT INTO employment (company, title, start_date, end_date, location, description, sort_order,
        start_precision, end_precision, commitment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(body.company, body.title ?? null, start.iso, end.iso, body.location ?? null, body.description ?? null,
          body.sort_order ?? 0, startPrecision, endPrecision, String(body.commitment ?? 'full_time'));
    return readEmployment(db, Number(inserted.lastInsertRowid));
  }

  db.prepare(
    `UPDATE employment SET company = COALESCE(?, company), title = COALESCE(?, title),
     start_date = ?, end_date = ?, location = COALESCE(?, location), description = COALESCE(?, description),
     sort_order = COALESCE(?, sort_order), start_precision = ?, end_precision = ?, commitment = COALESCE(?, commitment)
     WHERE id = ?`
  ).run(body.company ?? null, body.title ?? null,
        body.start_date === undefined ? existing.start_date : start.iso,
        body.end_date === undefined ? existing.end_date : end.iso,
        body.location ?? null, body.description ?? null, body.sort_order ?? null,
        body.start_date === undefined ? existing.start_precision : startPrecision,
        body.end_date === undefined ? existing.end_precision : endPrecision,
        body.commitment ?? null, id);
  return readEmployment(db, id);
}

export function readEmployment(db: Database.Database, id: number) {
  const row = db.prepare('SELECT * FROM employment WHERE id = ?').get(id) as any;
  if (!row) throw new StoreError('employment ' + id + ' does not exist', [], 404);
  return labeled([row])[0];
}

/** Education anchors school-leaving and graduation years, so it is canonicalised on the same terms. */
export function writeEducation(db: Database.Database, id: number | null, body: Record<string, unknown>) {
  const problems: string[] = [];
  const start = canonicalizeDate(body.start_date, 'start_date', problems);
  const end = canonicalizeDate(body.end_date, 'end_date', problems);
  if (start.iso && end.iso && end.iso < start.iso) problems.push('end_date ' + end.iso + ' precedes start_date ' + start.iso);
  if (problems.length) throw new StoreError('education rejected', problems);

  if (id == null) {
    if (typeof body.institution !== 'string' || !body.institution.trim()) throw new StoreError('education rejected', ['institution is required']);
    const inserted = db.prepare(
      `INSERT INTO education (institution, degree, field, start_date, end_date, details, sort_order, start_precision, end_precision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(body.institution, body.degree ?? null, body.field ?? null, start.iso, end.iso, body.details ?? null,
          body.sort_order ?? 0, precisionFor(body.start_precision, start), precisionFor(body.end_precision, end));
    return Number(inserted.lastInsertRowid);
  }

  const existing = db.prepare('SELECT * FROM education WHERE id = ?').get(id) as any;
  if (!existing) throw new StoreError('education ' + id + ' does not exist', [], 404);
  db.prepare(
    `UPDATE education SET institution = COALESCE(?, institution), degree = COALESCE(?, degree),
     field = COALESCE(?, field), start_date = ?, end_date = ?, details = COALESCE(?, details),
     sort_order = COALESCE(?, sort_order), start_precision = ?, end_precision = ? WHERE id = ?`
  ).run(body.institution ?? null, body.degree ?? null, body.field ?? null,
        body.start_date === undefined ? existing.start_date : start.iso,
        body.end_date === undefined ? existing.end_date : end.iso,
        body.details ?? null, body.sort_order ?? null,
        body.start_date === undefined ? existing.start_precision : precisionFor(body.start_precision, start),
        body.end_date === undefined ? existing.end_precision : precisionFor(body.end_precision, end),
        id);
  return id;
}

export function labeled(rows: any[]) {
  // Labels are rendered from the canonical value, so a row that predates migration still reads correctly.
  const silence: string[] = [];
  return rows.map((r) => {
    const start = canonicalizeDate(r.start_date, 'start_date', silence);
    const end = canonicalizeDate(r.end_date, 'end_date', silence);
    return {
      ...r,
      start_label: start.iso
        ? renderDate(start.iso, null, (r.start_precision || 'month') as DatePrecision)
        : (r.start_label ?? ''),
      end_label: end.iso
        ? renderDate(end.iso, null, (r.end_precision || 'month') as DatePrecision)
        : 'Present',
    };
  });
}

/**
 * The whole timeline with its verdicts, so a caller can see the rendered labels, the ordering problems and
 * the permitted overlaps in one place instead of inferring them from prose.
 */
export function getTimeline(db: Database.Database) {
  const employment = db.prepare('SELECT * FROM employment ORDER BY start_date ASC, id ASC').all() as any[];
  const check = checkTimeline(employment);
  return {
    employment: labeled(employment),
    problems: check.problems,
    notes: check.notes,
    grounded: check.problems.length === 0,
  };
}
