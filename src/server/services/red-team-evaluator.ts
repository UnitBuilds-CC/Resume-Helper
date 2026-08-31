import type { CompiledCV, JobPosting, TemplateCV, System, Block, Education, Employment, Recommendation, RedFlag } from '../../shared/types.js';

interface DimensionEvaluation {
  dimension_name: string;
  score: number;
  weight: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
  evidence: string[];
}

interface RedTeamEvaluationResult {
  dimensions: DimensionEvaluation[];
  weighted_score: number;
  red_flags: RedFlag[];
  recommendation: Recommendation;
  job_fit_summary: string;
  phase1_qualified: boolean;
}

const DIMENSION_WEIGHTS = {
  technical_skills: 0.25,
  experience_relevance: 0.20,
  achievement_focus: 0.15,
  seniority_level: 0.10,
  education: 0.05,
  location_logistics: 0.05,
  communication_quality: 0.08,
  culture_fit: 0.07,
  cv_structure: 0.03,
  red_flags: 0.02
};

export function evaluateRedTeam(
  compiledCv: CompiledCV,
  jobPosting: JobPosting,
  templateCv: TemplateCV,
  education: Education[],
  employment: Employment[],
  systems: System[],
  blocks: Block[]
): RedTeamEvaluationResult {
  const jobKeywords = extractKeywords(jobPosting.content);
  
  const dimensions: DimensionEvaluation[] = [
    scoreTechnicalSkills(compiledCv, jobKeywords, blocks),
    scoreExperienceRelevance(employment, jobKeywords),
    scoreAchievementFocus(employment, blocks),
    scoreSeniorityLevel(employment, jobKeywords),
    scoreEducation(education, jobKeywords),
    scoreLocationLogistics(templateCv, jobPosting),
    scoreCommunicationQuality(compiledCv),
    scoreCultureFit(compiledCv, jobPosting),
    scoreCvStructure(compiledCv),
    scoreRedFlagsDimension(employment)
  ];

  const redFlags = detectRedFlags(employment);
  const weightedScore = calculateWeightedScore(dimensions, redFlags);
  const recommendation = generateRecommendation(weightedScore, redFlags);
  const jobFitSummary = generateJobFitSummary(dimensions, recommendation);
  const phase1Qualified = weightedScore >= 60 && redFlags.filter(f => f.severity === 'critical').length === 0;

  return {
    dimensions,
    weighted_score: weightedScore,
    red_flags: redFlags,
    recommendation,
    job_fit_summary: jobFitSummary,
    phase1_qualified: phase1Qualified
  };
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'as', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
  
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const frequency: Record<string, number> = {};
  
  for (const word of words) {
    if (!stopWords.has(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  }
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

function scoreTechnicalSkills(compiledCv: CompiledCV, jobKeywords: string[], blocks: Block[]): DimensionEvaluation {
  const cvText = compiledCv.content.toLowerCase();
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const blockSkills = blocks.flatMap(b => b.skills || []);
  const allSkills = [...new Set(blockSkills)].map(s => s.toLowerCase());
  
  let matchCount = 0;
  const matchedSkills: string[] = [];
  
  for (const keyword of jobKeywords.slice(0, 20)) {
    if (cvText.includes(keyword) || allSkills.some(s => s.includes(keyword))) {
      matchCount++;
      matchedSkills.push(keyword);
    }
  }
  
  const score = Math.min(100, Math.round((matchCount / Math.min(20, jobKeywords.length)) * 100));
  
  if (matchedSkills.length > 0) {
    strengths.push(`Matches ${matchedSkills.length} key requirements`);
    evidence.push(...matchedSkills.slice(0, 5).map(s => `Found: ${s}`));
  }
  
  const missingKeywords = jobKeywords.slice(0, 10).filter(k => !cvText.includes(k));
  if (missingKeywords.length > 0) {
    gaps.push(`Missing keywords: ${missingKeywords.slice(0, 3).join(', ')}`);
  }
  
  return {
    dimension_name: 'technical_skills',
    score,
    weight: DIMENSION_WEIGHTS.technical_skills,
    feedback: score >= 70 ? 'Strong technical alignment with job requirements' : score >= 50 ? 'Moderate technical fit with some gaps' : 'Significant technical gaps identified',
    strengths,
    gaps,
    evidence
  };
}

function scoreExperienceRelevance(employment: Employment[], jobKeywords: string[]): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  let totalScore = 0;
  let matchCount = 0;
  
  for (const emp of employment) {
    const empText = `${emp.title || ''} ${emp.description || ''}`.toLowerCase();
    let empMatches = 0;
    
    for (const keyword of jobKeywords.slice(0, 15)) {
      if (empText.includes(keyword)) {
        empMatches++;
      }
    }
    
    if (empMatches > 0) {
      totalScore += empMatches;
      matchCount++;
      evidence.push(`${emp.title} at ${emp.company}: ${empMatches} keyword matches`);
    }
  }
  
  const score = employment.length > 0 ? Math.min(100, Math.round((totalScore / (employment.length * 5)) * 100)) : 0;
  
  if (matchCount > 0) {
    strengths.push(`${matchCount} relevant positions found`);
  } else {
    gaps.push('Limited experience relevance to job requirements');
  }
  
  return {
    dimension_name: 'experience_relevance',
    score,
    weight: DIMENSION_WEIGHTS.experience_relevance,
    feedback: score >= 70 ? 'Highly relevant experience across multiple roles' : score >= 50 ? 'Some relevant experience' : 'Experience may not align well with requirements',
    strengths,
    gaps,
    evidence
  };
}

function scoreAchievementFocus(employment: Employment[], blocks: Block[]): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const achievementIndicators = ['built', 'developed', 'implemented', 'created', 'designed', 'led', 'managed', 'improved', 'increased', 'reduced', 'optimized', 'delivered', 'shipped', 'launched', 'achieved', 'accomplished'];
  const metricPatterns = /\d+[%$x]|\d+\+|\d+ users|\d+ customers|\d+ projects|\d+ team/i;
  
  let achievementCount = 0;
  let metricCount = 0;
  
  const allContent = [
    ...employment.map(e => e.description || ''),
    ...blocks.map(b => b.content)
  ].join(' ').toLowerCase();
  
  for (const indicator of achievementIndicators) {
    const matches = allContent.match(new RegExp(`\\b${indicator}\\b`, 'g'));
    if (matches) achievementCount += matches.length;
  }
  
  const metricMatches = allContent.match(metricPatterns);
  if (metricMatches) metricCount = metricMatches.length;
  
  const score = Math.min(100, Math.round((achievementCount / 10) * 50 + (metricCount / 5) * 50));
  
  if (achievementCount > 10) {
    strengths.push(`Strong achievement-oriented language (${achievementCount} action verbs)`);
  } else {
    gaps.push('Could use more achievement-focused language');
  }
  
  if (metricCount > 0) {
    strengths.push(`${metricCount} quantified achievements`);
    evidence.push(`Metrics found in content`);
  } else {
    gaps.push('No quantified metrics found');
  }
  
  return {
    dimension_name: 'achievement_focus',
    score,
    weight: DIMENSION_WEIGHTS.achievement_focus,
    feedback: score >= 70 ? 'Excellent achievement and impact focus' : score >= 50 ? 'Good mix of achievements and responsibilities' : 'Focuses more on duties than achievements',
    strengths,
    gaps,
    evidence
  };
}

function scoreSeniorityLevel(employment: Employment[], jobKeywords: string[]): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const seniorityKeywords = {
    senior: ['senior', 'lead', 'principal', 'staff', 'architect', 'manager', 'director'],
    mid: ['mid-level', 'intermediate', 'experienced'],
    junior: ['junior', 'entry-level', 'associate', 'graduate']
  };
  
  const jobText = jobKeywords.join(' ').toLowerCase();
  const employmentText = employment.map(e => `${e.title || ''} ${e.description || ''}`).join(' ').toLowerCase();
  
  let requiredLevel = 'mid';
  let candidateLevel = 'mid';
  
  if (seniorityKeywords.senior.some(k => jobText.includes(k))) {
    requiredLevel = 'senior';
  } else if (seniorityKeywords.junior.some(k => jobText.includes(k))) {
    requiredLevel = 'junior';
  }
  
  if (seniorityKeywords.senior.some(k => employmentText.includes(k))) {
    candidateLevel = 'senior';
  } else if (seniorityKeywords.junior.some(k => employmentText.includes(k))) {
    candidateLevel = 'junior';
  }
  
  const levelMap = { junior: 1, mid: 2, senior: 3 };
  const required = levelMap[requiredLevel as keyof typeof levelMap];
  const candidate = levelMap[candidateLevel as keyof typeof levelMap];
  
  let score = 100;
  if (candidate >= required) {
    strengths.push(`Meets seniority requirement (${candidateLevel} level)`);
  } else {
    score -= (required - candidate) * 30;
    gaps.push(`Below required seniority: ${candidateLevel} vs ${requiredLevel}`);
  }
  
  evidence.push(`Required: ${requiredLevel}, Candidate: ${candidateLevel}`);
  
  return {
    dimension_name: 'seniority_level',
    score: Math.max(0, score),
    weight: DIMENSION_WEIGHTS.seniority_level,
    feedback: score >= 70 ? 'Seniority level matches well' : score >= 50 ? 'Some seniority mismatch' : 'Significant seniority gap',
    strengths,
    gaps,
    evidence
  };
}

function scoreEducation(education: Education[], jobKeywords: string[]): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  if (education.length === 0) {
    return {
      dimension_name: 'education',
      score: 50,
      weight: DIMENSION_WEIGHTS.education,
      feedback: 'No education information provided',
      strengths: [],
      gaps: ['Missing education section'],
      evidence: []
    };
  }
  
  const eduText = education.map(e => `${e.degree || ''} ${e.field || ''} ${e.details || ''}`).join(' ').toLowerCase();
  
  let score = 60;
  
  if (eduText.includes('bachelor') || eduText.includes('bs') || eduText.includes('ba')) {
    score += 20;
    strengths.push('Bachelor\'s degree present');
  }
  
  if (eduText.includes('master') || eduText.includes('ms') || eduText.includes('ma')) {
    score += 15;
    strengths.push('Master\'s degree present');
  }
  
  const techFields = ['computer', 'software', 'engineering', 'science', 'math', 'information'];
  if (techFields.some(f => eduText.includes(f))) {
    score += 10;
    strengths.push('Relevant technical field');
  }
  
  evidence.push(...education.map(e => `${e.degree} in ${e.field} from ${e.institution}`));
  
  return {
    dimension_name: 'education',
    score: Math.min(100, score),
    weight: DIMENSION_WEIGHTS.education,
    feedback: score >= 70 ? 'Strong educational background' : score >= 50 ? 'Adequate education' : 'Education may not align with requirements',
    strengths,
    gaps,
    evidence
  };
}

function scoreLocationLogistics(templateCv: TemplateCV, jobPosting: JobPosting): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const jobText = jobPosting.content.toLowerCase();
  let score = 80;
  
  if (jobText.includes('remote') || jobText.includes('anywhere') || jobText.includes('worldwide')) {
    score = 100;
    strengths.push('Position is remote-friendly');
  } else {
    gaps.push('Position may require specific location');
  }
  
  if (templateCv.location) {
    evidence.push(`Candidate location: ${templateCv.location}`);
  }
  
  return {
    dimension_name: 'location_logistics',
    score,
    weight: DIMENSION_WEIGHTS.location_logistics,
    feedback: score >= 80 ? 'Good location fit' : score >= 60 ? 'Some location concerns' : 'Location may be an issue',
    strengths,
    gaps,
    evidence
  };
}

function scoreCommunicationQuality(compiledCv: CompiledCV): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const content = compiledCv.content;
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = content.split(/[.!?]+/).length;
  const avgSentenceLength = wordCount / sentenceCount;
  
  let score = 70;
  
  if (avgSentenceLength < 25) {
    score += 15;
    strengths.push('Clear, concise sentences');
  } else if (avgSentenceLength > 35) {
    score -= 10;
    gaps.push('Sentences may be too long');
  }
  
  if (wordCount > 200 && wordCount < 800) {
    score += 10;
    strengths.push('Good content length');
  } else if (wordCount < 100) {
    score -= 15;
    gaps.push('Content may be too brief');
  }
  
  const hasBullets = content.includes('•') || content.includes('-') || content.includes('*');
  if (hasBullets) {
    score += 5;
    strengths.push('Uses bullet points for readability');
  }
  
  evidence.push(`Word count: ${wordCount}, Avg sentence length: ${avgSentenceLength.toFixed(1)}`);
  
  return {
    dimension_name: 'communication_quality',
    score: Math.max(0, Math.min(100, score)),
    weight: DIMENSION_WEIGHTS.communication_quality,
    feedback: score >= 75 ? 'Excellent communication quality' : score >= 60 ? 'Good communication' : 'Communication could be improved',
    strengths,
    gaps,
    evidence
  };
}

function scoreCultureFit(compiledCv: CompiledCV, jobPosting: JobPosting): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const cultureKeywords = ['team', 'collaborative', 'innovation', 'agile', 'fast-paced', 'startup', 'enterprise', 'mission', 'values', 'culture'];
  
  const jobText = jobPosting.content.toLowerCase();
  const cvText = compiledCv.content.toLowerCase();
  
  let score = 60;
  let matchCount = 0;
  
  for (const keyword of cultureKeywords) {
    if (jobText.includes(keyword) && cvText.includes(keyword)) {
      matchCount++;
    }
  }
  
  score += matchCount * 5;
  
  if (matchCount > 3) {
    strengths.push('Strong culture alignment signals');
  } else if (matchCount === 0) {
    gaps.push('Limited culture fit indicators');
  }
  
  return {
    dimension_name: 'culture_fit',
    score: Math.min(100, score),
    weight: DIMENSION_WEIGHTS.culture_fit,
    feedback: score >= 70 ? 'Good culture alignment' : score >= 50 ? 'Neutral culture fit' : 'Culture fit unclear',
    strengths,
    gaps,
    evidence
  };
}

function scoreCvStructure(compiledCv: CompiledCV): DimensionEvaluation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  
  const content = compiledCv.content;
  let score = 50;
  
  const sections = ['experience', 'education', 'skills', 'summary', 'contact'];
  const foundSections = sections.filter(s => content.toLowerCase().includes(s));
  
  score += foundSections.length * 10;
  
  if (foundSections.length >= 4) {
    strengths.push(`Well-structured with ${foundSections.length} key sections`);
  } else {
    gaps.push(`Missing sections: ${sections.filter(s => !foundSections.includes(s)).join(', ')}`);
  }
  
  evidence.push(`Found sections: ${foundSections.join(', ')}`);
  
  return {
    dimension_name: 'cv_structure',
    score: Math.min(100, score),
    weight: DIMENSION_WEIGHTS.cv_structure,
    feedback: score >= 80 ? 'Excellent CV structure' : score >= 60 ? 'Good structure' : 'Structure needs improvement',
    strengths,
    gaps,
    evidence
  };
}

function scoreRedFlagsDimension(employment: Employment[]): DimensionEvaluation {
  const redFlags = detectRedFlags(employment);
  
  let score = 100;
  const strengths: string[] = [];
  const gaps: string[] = [];
  
  if (redFlags.length === 0) {
    strengths.push('No significant red flags detected');
  } else {
    for (const flag of redFlags) {
      const penalty = { low: 5, medium: 15, high: 30, critical: 50 }[flag.severity];
      score -= penalty;
      gaps.push(`${flag.severity.toUpperCase()}: ${flag.description}`);
    }
  }
  
  return {
    dimension_name: 'red_flags',
    score: Math.max(0, score),
    weight: DIMENSION_WEIGHTS.red_flags,
    feedback: score >= 90 ? 'No concerns identified' : score >= 70 ? 'Minor concerns' : 'Significant concerns present',
    strengths: redFlags.length === 0 ? strengths : [],
    gaps,
    evidence: []
  };
}

function detectRedFlags(employment: Employment[]): RedFlag[] {
  const flags: RedFlag[] = [];
  
  const sortedEmployment = [...employment].sort((a, b) => {
    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return aStart - bStart;
  });
  
  for (let i = 0; i < sortedEmployment.length - 1; i++) {
    const current = sortedEmployment[i];
    const next = sortedEmployment[i + 1];
    
    if (current.end_date && next.start_date) {
      const endDate = new Date(current.end_date);
      const nextStartDate = new Date(next.start_date);
      const gapMonths = (nextStartDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      if (gapMonths > 6) {
        flags.push({
          flag_type: 'employment_gap',
          severity: gapMonths > 12 ? 'high' : 'medium',
          description: `Employment gap of ${Math.round(gapMonths)} months between ${current.company} and ${next.company}`,
          evidence: `${current.end_date} to ${next.start_date}`,
          recommendation: 'Be prepared to explain this gap and what you did during that time'
        });
      }
    }
    
    if (current.start_date && current.end_date) {
      const startDate = new Date(current.start_date);
      const endDate = new Date(current.end_date);
      const durationMonths = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      if (durationMonths < 12 && durationMonths > 0) {
        flags.push({
          flag_type: 'short_tenure',
          severity: 'low',
          description: `Short tenure (${Math.round(durationMonths)} months) at ${current.company}`,
          evidence: `${current.start_date} to ${current.end_date}`,
          recommendation: 'Be ready to explain the short duration'
        });
      }
    }
  }
  
  return flags;
}

function calculateWeightedScore(dimensions: DimensionEvaluation[], redFlags: RedFlag[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const dim of dimensions) {
    if (dim.dimension_name === 'red_flags') {
      const penalty = (100 - dim.score) * dim.weight;
      weightedSum -= penalty;
    } else {
      weightedSum += dim.score * dim.weight;
      totalWeight += dim.weight;
    }
  }
  
  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  const criticalFlags = redFlags.filter(f => f.severity === 'critical');
  const criticalPenalty = criticalFlags.length * 10;
  
  return Math.max(0, Math.min(100, Math.round(normalizedScore - criticalPenalty)));
}

function generateRecommendation(score: number, redFlags: RedFlag[]): Recommendation {
  const criticalFlags = redFlags.filter(f => f.severity === 'critical');
  
  if (criticalFlags.length > 0) {
    return 'strong_no';
  }
  
  if (score >= 85) {
    return 'strong_yes';
  } else if (score >= 70) {
    return 'yes';
  } else if (score >= 55) {
    return 'maybe';
  } else if (score >= 40) {
    return 'no';
  } else {
    return 'strong_no';
  }
}

function generateJobFitSummary(dimensions: DimensionEvaluation[], recommendation: Recommendation): string {
  const topStrengths = dimensions
    .filter(d => d.dimension_name !== 'red_flags' && d.score >= 70)
    .slice(0, 2)
    .map(d => d.dimension_name.replace('_', ' '));
  
  const mainGaps = dimensions
    .filter(d => d.score < 50)
    .slice(0, 2)
    .map(d => d.dimension_name.replace('_', ' '));
  
  let summary = '';
  
  if (recommendation === 'strong_yes') {
    summary = 'Excellent fit for this role. ';
  } else if (recommendation === 'yes') {
    summary = 'Strong candidate for this position. ';
  } else if (recommendation === 'maybe') {
    summary = 'Moderate fit with some areas to address. ';
  } else if (recommendation === 'no') {
    summary = 'Limited alignment with role requirements. ';
  } else {
    summary = 'Poor fit for this position. ';
  }
  
  if (topStrengths.length > 0) {
    summary += `Strong in ${topStrengths.join(' and ')}. `;
  }
  
  if (mainGaps.length > 0) {
    summary += `Consider addressing gaps in ${mainGaps.join(' and ')}.`;
  }
  
  return summary.trim();
}
