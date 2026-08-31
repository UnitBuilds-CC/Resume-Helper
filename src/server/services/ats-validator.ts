import type Database from 'better-sqlite3';

interface ValidationResult {
  check: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  detail?: string;
}

interface AtsValidationResult {
  score: number;
  passed: boolean;
  results: ValidationResult[];
  metadata: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    job_title: string;
    job_company: string;
    keywords: string[];
  };
}

function extractText(content: string): string {
  return content
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/[-*]\s+/g, '')
    .replace(/---/g, '')
    .toLowerCase();
}

function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const regex = /^#{1,3}\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    headings.push(match[1].replace(/\*\*/g, '').trim());
  }
  return headings;
}

function checkContactInfo(templateCv: any): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (!templateCv?.full_name?.trim()) {
    results.push({ check: 'Full Name', status: 'fail', message: 'Missing full name' });
  } else {
    results.push({ check: 'Full Name', status: 'pass', message: `Name present: ${templateCv.full_name}` });
  }

  if (!templateCv?.email?.trim()) {
    results.push({ check: 'Email', status: 'fail', message: 'Missing email address', detail: 'ATS systems require email to process your application' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(templateCv.email)) {
    results.push({ check: 'Email', status: 'fail', message: 'Invalid email format', detail: `"${templateCv.email}" is not a valid email address` });
  } else {
    results.push({ check: 'Email', status: 'pass', message: 'Valid email address' });
  }

  if (!templateCv?.phone?.trim()) {
    results.push({ check: 'Phone', status: 'warning', message: 'Missing phone number', detail: 'Some ATS systems require a phone number' });
  } else {
    const digits = templateCv.phone.replace(/\D/g, '');
    if (digits.length < 7) {
      results.push({ check: 'Phone', status: 'warning', message: 'Phone number seems too short', detail: `"${templateCv.phone}" has only ${digits.length} digits` });
    } else {
      results.push({ check: 'Phone', status: 'pass', message: 'Phone number present' });
    }
  }

  if (!templateCv?.location?.trim()) {
    results.push({ check: 'Location', status: 'warning', message: 'Missing location', detail: 'Some ATS systems filter by location' });
  } else {
    results.push({ check: 'Location', status: 'pass', message: `Location: ${templateCv.location}` });
  }

  return results;
}

function checkRequiredSections(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const text = extractText(content);
  const headings = extractHeadings(content).map(h => h.toLowerCase());

  const hasSummary = headings.some(h => h.includes('summary') || h.includes('objective') || h.includes('profile'))
    || text.includes('summary') || text.includes('objective');
  const hasSkills = headings.some(h => h.includes('skill') || h.includes('technologies') || h.includes('stack'))
    || text.includes('languages:') || text.includes('skills:');
  const hasExperience = headings.some(h => h.includes('experience') || h.includes('project') || h.includes('work'))
    || text.includes('experience') || text.includes('project');

  if (!hasSummary) {
    results.push({ check: 'Summary Section', status: 'warning', message: 'No professional summary detected', detail: 'A summary helps ATS match your profile to the role' });
  } else {
    results.push({ check: 'Summary Section', status: 'pass', message: 'Professional summary present' });
  }

  if (!hasSkills) {
    results.push({ check: 'Skills Section', status: 'fail', message: 'No skills section detected', detail: 'ATS systems rely heavily on skills matching — this is critical' });
  } else {
    results.push({ check: 'Skills Section', status: 'pass', message: 'Skills section present' });
  }

  if (!hasExperience) {
    results.push({ check: 'Experience Section', status: 'warning', message: 'No experience or projects section detected', detail: 'Work history is a key ATS filter' });
  } else {
    results.push({ check: 'Experience Section', status: 'pass', message: 'Experience/projects section present' });
  }

  return results;
}

function checkContentQuality(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const text = extractText(content);

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 150) {
    results.push({ check: 'Content Length', status: 'fail', message: `Content too short (${wordCount} words)`, detail: 'ATS systems may reject very short CVs. Aim for at least 300 words.' });
  } else if (wordCount < 300) {
    results.push({ check: 'Content Length', status: 'warning', message: `Content is brief (${wordCount} words)`, detail: 'Consider adding more detail. 400-800 words is ideal.' });
  } else {
    results.push({ check: 'Content Length', status: 'pass', message: `Good content length (${wordCount} words)` });
  }

  const bulletMatches = content.match(/^[-*]\s+/gm);
  const bulletCount = bulletMatches?.length ?? 0;
  if (bulletCount < 3) {
    results.push({ check: 'Bullet Points', status: 'warning', message: `Few bullet points (${bulletCount})`, detail: 'Use bullet points to highlight achievements — ATS parses them well' });
  } else {
    results.push({ check: 'Bullet Points', status: 'pass', message: `${bulletCount} bullet points detected` });
  }

  const numbersInText = (text.match(/\d+/g) ?? []).length;
  if (numbersInText < 3) {
    results.push({ check: 'Quantified Achievements', status: 'warning', message: 'Few numbers/metrics detected', detail: 'Quantified achievements (%, $, counts) score higher in ATS' });
  } else {
    results.push({ check: 'Quantified Achievements', status: 'pass', message: `${numbersInText} numeric references detected` });
  }

  return results;
}

function checkAtsCompatibility(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];

  const hasTables = /\|.*\|.*\|/.test(content) && /---\|/.test(content);
  if (hasTables) {
    results.push({ check: 'Tables', status: 'warning', message: 'Markdown tables detected', detail: 'Some ATS systems cannot parse tables — consider converting to plain text' });
  } else {
    results.push({ check: 'Tables', status: 'pass', message: 'No tables (ATS-safe)' });
  }

  const hasImages = /!\[.*\]\(.*\)/.test(content);
  if (hasImages) {
    results.push({ check: 'Images', status: 'fail', message: 'Image references detected', detail: 'ATS cannot read images — remove all image references' });
  } else {
    results.push({ check: 'Images', status: 'pass', message: 'No images (ATS-safe)' });
  }

  const hasSpecialChars = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{2600}-\u{26FF}]/u.test(content);
  if (hasSpecialChars) {
    results.push({ check: 'Special Characters', status: 'warning', message: 'Emoji or special unicode detected', detail: 'Some ATS systems cannot handle emoji — replace with plain text' });
  } else {
    results.push({ check: 'Special Characters', status: 'pass', message: 'No problematic unicode/emoji' });
  }

  const hasUrls = /https?:\/\/\S+/.test(content);
  if (hasUrls) {
    results.push({ check: 'URLs', status: 'pass', message: 'URLs present (will be clickable in PDF)' });
  }

  return results;
}

function extractKeywords(jobPosting: any): string[] {
  if (!jobPosting) return [];
  const text = `${jobPosting.title || ''} ${jobPosting.description || ''} ${jobPosting.requirements || ''} ${jobPosting.skills || ''}`.toLowerCase();
  const techKeywords = [
    'rust', 'typescript', 'python', 'go', 'java', 'c++', 'c#', '.net', 'node', 'react',
    'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'postgres', 'sql', 'mongodb', 'redis',
    'graphql', 'rest', 'grpc', 'websocket', 'microservices', 'ci/cd', 'git', 'linux',
    'remote', 'distributed', 'api', 'backend', 'frontend', 'full-stack', 'devops',
  ];
  return techKeywords.filter(kw => text.includes(kw));
}

export function validateForAts(db: Database.Database, compiledCvId: number): AtsValidationResult {
  const cv = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(compiledCvId) as any;
  if (!cv) throw new Error('Compiled CV not found');

  const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(cv.job_posting_id) as any;
  const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;

  const results: ValidationResult[] = [
    ...checkContactInfo(templateCv),
    ...checkRequiredSections(cv.content),
    ...checkContentQuality(cv.content),
    ...checkAtsCompatibility(cv.content),
  ];

  const score = Math.round(
    (results.filter(r => r.status === 'pass').length / results.length) * 100
  );

  const hasFailures = results.some(r => r.status === 'fail');

  const keywords = extractKeywords(jobPosting);

  return {
    score,
    passed: !hasFailures,
    results,
    metadata: {
      name: templateCv?.full_name || '',
      title: templateCv?.professional_title || '',
      email: templateCv?.email || '',
      phone: templateCv?.phone || '',
      location: templateCv?.location || '',
      job_title: jobPosting?.title || '',
      job_company: jobPosting?.company || '',
      keywords,
    },
  };
}
