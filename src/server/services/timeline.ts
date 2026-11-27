import type Database from 'better-sqlite3';
import { StoreError } from './job-posting-store.js';

// Dates were stored as free text, so the same three employment rows held "April 2025", "2020", "End 2024"
// and "Present". Nothing could compare a start with an end, so a CV paragraph could contradict the record it
// describes and no layer would notice. This module is the single definition of what a date is, what it
// renders as, and what it means for prose to disagree with it.

export type DatePrecision = 'year' | 'month' | 'day';

export const PRECISIONS: DatePrecision[] = ['year', 'month', 'day'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2}|\d{4})\b/g;
const YEAR_RE = /(?:^|[^/\w-])(19|20)\d{2}\b/g;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);

/** Canonical value plus the precision the owner actually vouches for. */
export function parseDate(value: unknown, label: string, problems: string[]): { iso: string | null; precision: DatePrecision } {
  if (value == null || value === '') return { iso: null, precision: 'day' };
  if (typeof value !== 'string') { problems.push(label + ' must be a string'); return { iso: null, precision: 'day' }; }
  const s = value.trim();
  if (/^present$/i.test(s)) return { iso: null, precision: 'day' };
  if (!ISO.test(s)) {
    problems.push(label + ' must be ISO YYYY-MM-DD (got ' + JSON.stringify(s) + '); if the record only ' +
      'supports a coarser figure, store the first day of that span and set the matching precision');
    return { iso: null, precision: 'day' };
  }
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) { problems.push(label + ' is not a real calendar date: ' + s); return { iso: null, precision: 'day' }; }
  return { iso: s, precision: 'day' };
}

/** The label a human should see: "2024", "April 2025", or the full day. */
export function renderDate(iso: string | null | undefined, endDate: string | null | undefined, precision: DatePrecision = 'day'): string {
  if (!iso) return 'Present';
  const [y, m] = iso.split('-').map(Number);
  if (precision === 'year') return String(y);
  if (precision === 'month') return MONTH_NAMES[m - 1] + ' ' + y;
  return MONTH_NAMES[m - 1] + ' ' + iso;
}

const YEAR_ONLY = /^(19|20)\d{2}$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;
const MONTH_NAME = /^([A-Z][a-z]+)\s+(\d{4})$/;

/**
 * Reads the forms a person actually types and stores one canonical value plus the precision that was
 * really asserted. "April 2025" is not the same claim as "2025-04-17", and collapsing them silently is how
 * a date becomes a rumour. Anything the owner has to invent a meaning for - "End 2024" - is refused here
 * and handled as a reviewed migration instead, so the ambiguity is resolved by a person once.
 */
export function canonicalizeDate(value: unknown, label: string, problems: string[]): { iso: string | null; precision: DatePrecision } {
  if (value == null || value === '') return { iso: null, precision: 'day' };
  if (typeof value !== 'string') { problems.push(label + ' must be a string'); return { iso: null, precision: 'day' }; }
  const s = value.trim();
  if (/^present$/i.test(s)) return { iso: null, precision: 'day' };
  if (ISO.test(s)) return parseDate(s, label, problems);
  let m = s.match(MONTH_ONLY);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { iso: m[1] + '-' + m[2] + '-01', precision: 'month' };
  if (YEAR_ONLY.test(s)) return { iso: s + '-01-01', precision: 'year' };
  m = s.match(MONTH_NAME);
  if (m && MONTH_NAMES.includes(m[1])) {
    return { iso: m[2] + '-' + String(MONTH_NAMES.indexOf(m[1]) + 1).padStart(2, '0') + '-01', precision: 'month' };
  }
  problems.push(label + ' is not a date this product can store: ' + JSON.stringify(s) +
    '. Accepts 2025-04-17, 2025-04, 2025, "April 2025" or "Present".');
  return { iso: null, precision: 'day' };
}

export function precisionFor(value: unknown, parsed: { iso: string | null; precision: DatePrecision }): DatePrecision {
  if (typeof value === 'string' && PRECISIONS.includes(value as DatePrecision)) return value as DatePrecision;
  return parsed.precision;
}

export interface TimelineRow {
  id: number;
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  start_precision?: string | null;
  end_precision?: string | null;
}

/**
 * A period is invalid when it cannot be ordered, when it ends in the future, or when it stops being an
 * answer. Overlapping periods are reported, never refused: running a company while employed was true here,
 * and a validator that rejects true facts gets switched off.
 */
export function checkTimeline(rows: TimelineRow[], now = today()) {
  const problems: string[] = [];
  const notes: string[] = [];
  const spans: { id: number; company: string; s: string; e: string }[] = [];

  for (const r of rows) {
    // Comparing the stored strings directly was the bug: "December 2025" sorts before "January 2024"
    // alphabetically, so an accurately ordered career read as ending before it started, and a past date
    // read as being in the future. Canonicalise first, then compare dates.
    const local: string[] = [];
    const start = canonicalizeDate(r.start_date, 'start_date', local);
    const end = canonicalizeDate(r.end_date, 'end_date', local);
    for (const message of local) {
      problems.push('employment #' + r.id + ' (' + (r.company || 'no company') + '): ' + message);
    }

    if (!start.iso) problems.push('employment #' + r.id + ' (' + (r.company || 'no company') + ') has no usable start_date');
    if (start.iso && end.iso && end.iso < start.iso) {
      problems.push('employment #' + r.id + ' (' + r.company + ') ends ' + r.end_date + ' before it starts ' + r.start_date);
    }
    if (end.iso && end.iso > now) problems.push('employment #' + r.id + ' (' + r.company + ') ends in the future: ' + r.end_date);
    if (end.iso && (r.end_precision || 'day') === 'year' && !/^\d{4}-12-31$/.test(end.iso)) {
      notes.push('employment #' + r.id + ': year precision on an end date should be stored as ' + end.iso.slice(0, 4) + '-12-31');
    }
    // An open-ended role runs to today, so it can overlap. Requiring an end date meant a current job beside
    // a past one was never compared, which is exactly the case this timeline exists to explain.
    if (start.iso) spans.push({ id: r.id, company: r.company || '', s: start.iso, e: end.iso || now });
  }

  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i], b = spans[j];
      if (a.s <= b.e && b.s <= a.e) {
        notes.push('employment #' + a.id + ' (' + a.company + ') overlaps #' + b.id + ' (' + b.company + ') — allowed, but the CV should say which was primary');
      }
    }
  }
  return { problems, notes };
}

export interface DateClaim { text: string; iso: string; precision: DatePrecision; index: number }

/** Every date a piece of prose asserts, in the form the timeline can be compared against. */
export function extractClaims(text: string): DateClaim[] {
  const claims: DateClaim[] = [];
  for (const m of text.matchAll(MONTH_RE)) {
    const month = MONTH_NAMES.indexOf(m[1]) + 1;
    claims.push({ text: m[0], iso: m[2] + '-' + String(month).padStart(2, '0') + '-01', precision: 'month', index: m.index ?? 0 });
  }
  for (const m of text.matchAll(YEAR_RE)) {
    const iso = (m[1] === '19' ? m[1] : m[0].slice(-4)) + '-01-01';
    const bare = m[0].trim();
    // A month-name phrase already covers "April 2025"; skip the year inside it to avoid double counts.
    if (claims.some((c) => c.precision === 'month' && c.iso.slice(0, 4) === iso.slice(0, 4) && Math.abs(c.index - (m.index ?? 0)) < 20)) continue;
    if (!/^\d{4}$/.test(bare)) continue;
    claims.push({ text: bare, iso, precision: 'year', index: m.index ?? 0 });
  }
  return claims;
}

const overlapsMonth = (iso: string, span: { s: string; e: string }) => {
  const month = iso.slice(0, 7);
  return month >= span.s.slice(0, 7) && month <= span.e.slice(0, 7);
};

/** A record's effective span, canonicalised, with an open end read as "up to now". */
export function anchorOf(row: { start_date?: string | null; end_date?: string | null }, now = today()): { s: string; e: string } | null {
  const silence: string[] = [];
  const start = canonicalizeDate(row.start_date, 'start_date', silence);
  const end = canonicalizeDate(row.end_date, 'end_date', silence);
  if (!start.iso) return null;
  return { s: start.iso, e: end.iso || now };
}

/**
 * The guard against the repeated failure: prose that states a date no record supports.
 * Employment, education and project periods all anchor a date - a 2016 school-leaving year is not an
 * ungrounded claim. `acknowledge='confirmed_change'` is the only way past it, so drifting a date becomes a
 * decision rather than a typo that survives to a recruiter.
 */
export function assertClaimsGrounded(db: Database.Database, text: string, label: string, acknowledge?: unknown) {
  const hasEmployment = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'employment'").get();
  const rows = hasEmployment
    ? (db.prepare('SELECT id, company, title, start_date, end_date, start_precision, end_precision FROM employment').all() as TimelineRow[])
    : [];
  // With no timeline recorded there is nothing to contradict - a fresh database must still be usable.
  if (!rows.length) return { checked: 0, ungrounded: [] as DateClaim[], skipped: 'no employment records' };

  const timeline = checkTimeline(rows);
  if (timeline.problems.length) throw new StoreError('the employment timeline must be corrected first', timeline.problems, 409);

  const anchors: { s: string; e: string }[] = [];
  for (const r of rows) {
    const a = anchorOf(r);
    if (a) anchors.push(a);
  }
  for (const table of ['education', 'projects']) {
    const present = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    if (!present) continue;
    for (const r of db.prepare(`SELECT start_date, end_date FROM ${table}`).all() as { start_date: string | null; end_date: string | null }[]) {
      const a = anchorOf(r);
      if (a) anchors.push(a);
    }
  }

  const claims = extractClaims(text);
  const ungrounded = claims.filter((c) => !anchors.some((a) => overlapsMonth(c.iso, a)));
  if (!ungrounded.length) return { checked: claims.length, ungrounded: [] as DateClaim[] };

  if (acknowledge !== 'confirmed_change') {
    throw new StoreError(
      label + ' asserts dates that no stored record supports',
      [
        ...ungrounded.map((c) => '"' + c.text + '" falls outside every employment, education and project period'),
        'recorded periods: ' + anchors.map((a) => a.s.slice(0, 7) + ' to ' + a.e.slice(0, 7)).join('; '),
        'if these dates are correct, resend with acknowledge="confirmed_change" and then update the records they belong to',
      ],
      409
    );
  }
  return { checked: claims.length, ungrounded, acknowledged: true };
}

export { MONTH_NAMES };
