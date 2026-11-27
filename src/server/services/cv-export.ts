import type Database from 'better-sqlite3';
import { extractKeywords } from './ats-validator.js';
import { getCompiledCv } from './compiled-cv-store.js';
import { StoreError } from './job-posting-store.js';
import type { PdfData } from './pdf-generator.js';

const safeName = (value: unknown, fallback: string) => String(value ?? fallback).replace(/[^a-zA-Z0-9]/g, '_');

export interface CvExport {
  pdf: PdfData;
  basename: string;
  atsScorePath: string;
}

/**
 * Everything the two exporters need, assembled once. The PDF route used to build this inline and a Word
 * route would have had to guess at the same rules - notably that a tailored CV's own Executive Summary wins
 * over the profile-pad summary, and that the header title comes from the linked posting.
 */
export function buildCvExport(db: Database.Database, compiledCvId: unknown): CvExport {
  const cv = getCompiledCv(db, compiledCvId);
  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
  const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(cv.job_posting_id) as any;
  if (!templateCv) throw new StoreError('the profile pad has not been filled in yet', ['GET /api/template-cv returns null'], 409);

  const contact = [templateCv?.email, templateCv?.phone, templateCv?.location, templateCv?.linkedin, templateCv?.website]
    .filter(Boolean).join(' | ');
  const ownSummary = (cv.content || '').replace(/\r\n/g, '\n').match(/^## Executive Summary\n([\s\S]+?)(?=\n## )/m)?.[1]?.trim();

  const pdf: PdfData = {
    name: templateCv?.full_name || 'Your Name',
    title: jobPosting?.title || templateCv?.professional_title || '',
    contact,
    summary: ownSummary || templateCv?.summary || '',
    content: cv.content,
    jobTitle: jobPosting?.title || '',
    jobCompany: jobPosting?.company || '',
    keywords: extractKeywords(jobPosting),
  };

  const basename = jobPosting
    ? `${safeName(templateCv?.full_name, 'CV')}_${safeName(jobPosting.title, 'CV')}`
    : `cv-${cv.id}`;

  return { pdf, basename, atsScorePath: `/api/compiled-cvs/${cv.id}/validate` };
}
