import type {
  JobPosting, TemplateCV, System, Block, Employment, Education, Project,
  Recommendation, MatchDimension, GapSuggestion
} from '../../shared/types.js';

interface ProfileData {
  templateCv: TemplateCV;
  employment: Employment[];
  education: Education[];
  systems: System[];
  blocks: Block[];
  projects: Project[];
  allSkills: string[];
}

interface JobMatchResult {
  overall_score: number;
  recommendation: Recommendation;
  summary: string;
  dimensions: MatchDimension[];
  gap_suggestions: GapSuggestion[];
}

const DIMENSION_WEIGHTS: Record<string, number> = {
  technical_skills: 0.30,
  experience_relevance: 0.20,
  role_alignment: 0.15,
  keyword_coverage: 0.15,
  industry_domain: 0.10,
  location_logistics: 0.10,
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
  'our', 'their', 'as', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'what', 'which', 'who', 'whom', 'how',
  'when', 'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'because', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'any', 'if', 'while', 'also',
  'job', 'role', 'work', 'working', 'team', 'able', 'well', 'etc', 'plus',
]);

const TECH_ALIASES: Record<string, string[]> = {
  'js': ['javascript'],
  'ts': ['typescript'],
  'py': ['python'],
  'rb': ['ruby'],
  'rs': ['rust'],
  'golang': ['go'],
  'k8s': ['kubernetes'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud'],
  'pg': ['postgresql'],
  'mongo': ['mongodb'],
  'reactjs': ['react'],
  'vuejs': ['vue'],
  'nodejs': ['node'],
  'expressjs': ['express'],
  'nextjs': ['next'],
  'nuxtjs': ['nuxt'],
};

export function analyzeJobMatch(jobPosting: JobPosting, profile: ProfileData): JobMatchResult {
  const jobKeywords = extractKeywords(jobPosting.content);
  const requiredSkills = extractRequiredSkills(jobPosting.content);
  const jobText = jobPosting.content.toLowerCase();

  const dimensions: MatchDimension[] = [
    scoreTechnicalSkills(requiredSkills, jobKeywords, profile, jobText, jobPosting.title),
    scoreExperienceRelevance(profile.employment, jobKeywords, jobText),
    scoreRoleAlignment(profile.employment, jobPosting, jobText),
    scoreKeywordCoverage(jobKeywords, profile, jobText),
    scoreIndustryDomain(profile, jobText),
    scoreLocationLogistics(profile.templateCv, jobPosting),
  ];

  const overallScore = calculateWeightedScore(dimensions);
  const recommendation = generateRecommendation(overallScore);
  const gapSuggestions = generateGapSuggestions(requiredSkills, jobKeywords, profile, jobText);
  const summary = generateSummary(dimensions, overallScore, recommendation, gapSuggestions);

  return { overall_score: overallScore, recommendation, summary, dimensions, gap_suggestions: gapSuggestions };
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const frequency: Record<string, number> = {};

  for (const word of words) {
    if (!STOP_WORDS.has(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

function extractRequiredSkills(text: string): string[] {
  const skills: string[] = [];
  const lower = text.toLowerCase();

  const skillPatterns = [
    /\b(rust|java|python|ruby|go(?:lang)?|typescript|javascript|kotlin|swift|scala|elixir|erlang|haskell|clojure|php|perl|lua|matlab|dart|zig|nim|ocaml|fsharp)\b/gi,
    /\b(c\+\+|c#|c sharp)(?!\w)/gi,
    /\b(c programming|c language|r programming|r language)\b/gi,
    /\b(react|vue|angular|svelte|next\.?js|nuxt|remix|ember|backbone)\b/gi,
    /\b(node\.?js|express|fastify|nest|deno|bun)\b/gi,
    /\b(django|flask|fastapi|rails|spring|laravel|asp\.net|gin|actix|rocket|axum)\b/gi,
    /\b(postgresql|mysql|mongodb|redis|elasticsearch|sqlite|cassandra|dynamodb|couchdb|neo4j|clickhouse|timescaledb)\b/gi,
    /\b(aws|gcp|azure|digitalocean|heroku|vercel|netlify|cloudflare)\b/gi,
    /\b(docker|kubernetes|k8s|terraform|ansible|puppet|jenkins|github actions|ci\/cd|cdk)\b/gi,
    /\b(graphql|rest|grpc|websocket|oauth|jwt|openid|saml)\b/gi,
    /\b(tailwind|sass|less|css|html|webpack|vite|esbuild|rollup)\b/gi,
    /\b(git|linux|nginx|apache|redis|rabbitmq|kafka|mqtt)\b/gi,
    /\b(machine learning|deep learning|nlp|computer vision|data science|ai|ml|llm|transformer)\b/gi,
    /\b(agile|scrum|kanban|jira|confluence|figma|sketch)\b/gi,
    /\b(tdd|bdd|unit testing|integration testing|e2e|jest|vitest|mocha|cypress|playwright)\b/gi,
    /\b(microservices|monolith|serverless|event.driven|message.queue|pub.sub|cqrs)\b/gi,
    /\b(webassembly|wasm|ffi|wasi|embedded|iot|real.time)\b/gi,
  ];

  const seen = new Set<string>();
  for (const pattern of skillPatterns) {
    const matches = lower.match(pattern) || [];
    for (const m of matches) {
      const normalized = m.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        skills.push(normalized);
      }
    }
  }

  const requireIndicators = /(?:require|required|requirements|must have|need|needs|experience with|proficiency in|familiar with|knowledge of)\b/gi;
  const lines = text.split('\n');
  for (const line of lines) {
    if (requireIndicators.test(line)) {
      requireIndicators.lastIndex = 0;
      const techWords = line.toLowerCase().match(/\b(rust|python|java|typescript|javascript|ruby|go|kotlin|swift|react|vue|angular|node|docker|kubernetes|aws|gcp|azure|postgresql|mongodb|redis|graphql|rest|git|linux)\b/g);
      if (techWords) {
        for (const tw of techWords) {
          if (!seen.has(tw)) {
            seen.add(tw);
            skills.push(tw);
          }
        }
      }
    }
  }

  return skills;
}

function getAllProfileText(profile: ProfileData): string {
  const parts: string[] = [];
  for (const e of profile.employment) {
    parts.push(e.title || '', e.description || '', e.company || '');
  }
  for (const b of profile.blocks) {
    parts.push(b.title, b.content, b.skills?.join(' ') || '');
  }
  for (const s of profile.systems) {
    parts.push(s.name, s.description || '');
  }
  for (const p of profile.projects) {
    parts.push(p.name, p.description || '', p.technologies || '');
  }
  for (const ed of profile.education) {
    parts.push(ed.degree || '', ed.field || '', ed.institution || '', ed.details || '');
  }
  parts.push(profile.templateCv.summary || '');
  parts.push(profile.allSkills.join(' '));
  return parts.join(' ').toLowerCase();
}

function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  for (const [alias, equivalents] of Object.entries(TECH_ALIASES)) {
    if (lower === alias || equivalents.includes(lower)) {
      return equivalents[0];
    }
  }
  return lower;
}

function skillMatches(skill: string, text: string): boolean {
  const normalized = normalizeSkill(skill);
  const lowerText = text.toLowerCase();
  if (lowerText.includes(normalized)) return true;
  const aliases = TECH_ALIASES[normalized] || [normalized];
  for (const alias of aliases) {
    if (lowerText.includes(alias)) return true;
  }
  for (const [alias, equivalents] of Object.entries(TECH_ALIASES)) {
    if (equivalents.includes(normalized) && lowerText.includes(alias)) return true;
  }
  return false;
}

function scoreTechnicalSkills(
  requiredSkills: string[],
  jobKeywords: string[],
  profile: ProfileData,
  jobText: string,
  jobTitle: string
): MatchDimension {
  const profileText = getAllProfileText(profile);
  const allSkillNames = profile.allSkills.map(s => s.toLowerCase());
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  if (requiredSkills.length === 0) {
    const techText = (jobTitle + ' ' + jobText).toLowerCase();
    const techIndicatorPatterns = [
      /\b(engineer\w*|developer\w*|programming|coding|software|backend|frontend|fullstack|devops|architect\w*)\b/gi,
      /\b(technical|tech\b|api|sdk|library|framework|database|server|cloud)\b/gi,
    ];
    let techIndicators = 0;
    for (const p of techIndicatorPatterns) {
      techIndicators += (techText.match(p) || []).length;
    }

    const isNonTechnical = techIndicators < 2;
    return {
      dimension_name: 'Technical Skills',
      score: isNonTechnical ? 20 : 50,
      weight: 0.10,
      feedback: isNonTechnical
        ? 'Non-technical role — technical skills are not a primary factor.'
        : 'No specific technical requirements detected in the job posting.',
      strengths: isNonTechnical ? [] : ['General technical profile'],
      gaps: isNonTechnical ? ['Role does not require technical skills'] : [],
      evidence: [],
    };
  }

  let matched = 0;
  for (const skill of requiredSkills) {
    const inProfile = skillMatches(skill, profileText) || allSkillNames.some(s => skillMatches(skill, s));
    if (inProfile) {
      matched++;
      strengths.push(`Has ${skill} experience`);
      const relatedBlock = profile.blocks.find(b =>
        skillMatches(skill, b.content) || b.skills?.some(s => skillMatches(skill, s))
      );
      if (relatedBlock) {
        evidence.push(`${skill} demonstrated in "${relatedBlock.title}"`);
      }
    } else {
      gaps.push(`Missing: ${skill}`);
    }
  }

  const score = requiredSkills.length > 0 ? Math.round((matched / requiredSkills.length) * 100) : 50;

  let feedback: string;
  if (score >= 80) feedback = `Strong technical match — ${matched} of ${requiredSkills.length} required skills found.`;
  else if (score >= 60) feedback = `Good technical match — ${matched} of ${requiredSkills.length} required skills found.`;
  else if (score >= 40) feedback = `Partial technical match — ${matched} of ${requiredSkills.length} required skills found. Some gaps to address.`;
  else feedback = `Significant skill gaps — only ${matched} of ${requiredSkills.length} required skills found.`;

  return {
    dimension_name: 'Technical Skills',
    score,
    weight: DIMENSION_WEIGHTS.technical_skills,
    feedback,
    strengths,
    gaps,
    evidence,
  };
}

function scoreExperienceRelevance(
  employment: Employment[],
  jobKeywords: string[],
  jobText: string
): MatchDimension {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  if (employment.length === 0) {
    return {
      dimension_name: 'Experience Relevance',
      score: 20,
      weight: DIMENSION_WEIGHTS.experience_relevance,
      feedback: 'No employment history recorded.',
      strengths: [],
      gaps: ['No employment data'],
      evidence: [],
    };
  }

  let bestRelevance = 0;
  const topKeywords = jobKeywords.slice(0, 20);

  for (const emp of employment) {
    const empText = `${emp.title || ''} ${emp.description || ''} ${emp.company || ''}`.toLowerCase();
    let matchCount = 0;
    for (const kw of topKeywords) {
      if (empText.includes(kw)) matchCount++;
    }
    const relevance = topKeywords.length > 0 ? matchCount / topKeywords.length : 0;
    if (relevance > bestRelevance) bestRelevance = relevance;

    if (relevance > 0.2) {
      strengths.push(`Relevant experience: ${emp.title || ''} at ${emp.company || 'company'}`);
      evidence.push(`${matchCount} keyword matches in ${emp.title} role`);
    }
  }

  const totalYears = calculateTotalYears(employment);
  if (totalYears > 0) {
    evidence.push(`${totalYears.toFixed(1)} years total experience`);
  }

  const score = Math.round(Math.min(bestRelevance * 150, 100));

  let feedback: string;
  if (score >= 70) feedback = 'Strong experience alignment with job requirements.';
  else if (score >= 40) feedback = 'Some relevant experience found, but key areas may need emphasis.';
  else feedback = 'Limited direct experience match. Consider emphasizing transferable skills.';

  if (gaps.length === 0 && score < 60) {
    gaps.push('No employment roles closely match job requirements');
  }

  return {
    dimension_name: 'Experience Relevance',
    score: Math.max(score, 10),
    weight: DIMENSION_WEIGHTS.experience_relevance,
    feedback,
    strengths,
    gaps,
    evidence,
  };
}

function calculateTotalYears(employment: Employment[]): number {
  let totalMonths = 0;
  for (const emp of employment) {
    if (emp.start_date) {
      const start = new Date(emp.start_date);
      const end = emp.end_date ? new Date(emp.end_date) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += Math.max(months, 0);
    }
  }
  return totalMonths / 12;
}

function scoreRoleAlignment(
  employment: Employment[],
  jobPosting: JobPosting,
  jobText: string
): MatchDimension {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  const jobTitleWords = (jobPosting.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const seniorityIndicators = {
    senior: /\b(senior|sr\.?|lead|principal|staff|head of|director|vp|chief)\b/i,
    mid: /\b(mid.level|intermediate|II |2nd level)\b/i,
    junior: /\b(junior|jr\.?|entry.level|associate|graduate|intern)\b/i,
  };

  const jobSeniority = seniorityIndicators.senior.test(jobPosting.title || '') ? 'senior'
    : seniorityIndicators.junior.test(jobPosting.title || '') ? 'junior'
    : seniorityIndicators.mid.test(jobPosting.title || '') ? 'mid'
    : 'unknown';

  let candidateSeniority = 'unknown';
  for (const emp of employment) {
    const title = emp.title || '';
    if (seniorityIndicators.senior.test(title)) { candidateSeniority = 'senior'; break; }
    if (seniorityIndicators.mid.test(title)) candidateSeniority = 'mid';
    if (seniorityIndicators.junior.test(title) && candidateSeniority === 'unknown') candidateSeniority = 'junior';
  }

  if (jobSeniority === 'unknown' || candidateSeniority === 'unknown') {
    strengths.push('Seniority level unclear — no mismatch detected');
    evidence.push(`Job title: "${jobPosting.title}"`);
  } else if (jobSeniority === candidateSeniority) {
    strengths.push(`Seniority match: both ${jobSeniority}-level`);
  } else {
    const levelOrder = { junior: 1, mid: 2, senior: 3 };
    const diff = levelOrder[jobSeniority] - levelOrder[candidateSeniority];
    if (diff > 0) {
      gaps.push(`Job requires ${jobSeniority}-level but candidate appears ${candidateSeniority}-level`);
    } else {
      strengths.push(`Candidate is ${candidateSeniority}-level applying to ${jobSeniority}-level role (overqualified)`);
    }
  }

  let titleMatch = 0;
  for (const emp of employment) {
    const empTitle = (emp.title || '').toLowerCase();
    for (const w of jobTitleWords) {
      if (empTitle.includes(w)) titleMatch++;
    }
  }
  const titleScore = jobTitleWords.length > 0 ? Math.min(titleMatch / Math.max(jobTitleWords.length * 0.5, 1), 1) : 0.5;

  const seniorityBonus = (jobSeniority === 'unknown' || candidateSeniority === 'unknown') ? 0.5
    : jobSeniority === candidateSeniority ? 1.0
    : Math.abs(({ junior: 1, mid: 2, senior: 3 }[jobSeniority] || 2) - ({ junior: 1, mid: 2, senior: 3 }[candidateSeniority] || 2)) <= 1 ? 0.6
    : 0.2;

  const score = Math.round(((titleScore * 0.6 + seniorityBonus * 0.4)) * 100);

  return {
    dimension_name: 'Role Alignment',
    score: Math.max(Math.min(score, 100), 10),
    weight: DIMENSION_WEIGHTS.role_alignment,
    feedback: score >= 70 ? 'Good alignment between career trajectory and this role.'
      : score >= 40 ? 'Some alignment, but the role may represent a pivot or stretch.'
      : 'Limited alignment between current trajectory and this role.',
    strengths,
    gaps,
    evidence,
  };
}

function scoreKeywordCoverage(
  jobKeywords: string[],
  profile: ProfileData,
  jobText: string
): MatchDimension {
  const profileText = getAllProfileText(profile);
  const topKeywords = jobKeywords.slice(0, 30);
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  let covered = 0;
  for (const kw of topKeywords) {
    if (profileText.includes(kw)) {
      covered++;
    } else {
      let found = false;
      for (const [alias, equivalents] of Object.entries(TECH_ALIASES)) {
        if (equivalents.includes(kw) && profileText.includes(alias)) { found = true; break; }
        if (kw === alias && equivalents.some(eq => profileText.includes(eq))) { found = true; break; }
      }
      if (found) {
        covered++;
      } else {
        gaps.push(kw);
      }
    }
  }

  const score = topKeywords.length > 0 ? Math.round((covered / topKeywords.length) * 100) : 50;

  if (score >= 70) strengths.push(`${covered} of ${topKeywords.length} key terms found in profile`);
  else if (score >= 40) evidence.push(`${covered} of ${topKeywords.length} key terms found in profile`);

  return {
    dimension_name: 'Keyword Coverage',
    score,
    weight: DIMENSION_WEIGHTS.keyword_coverage,
    feedback: score >= 70 ? 'Strong keyword overlap — profile uses similar language to the job posting.'
      : score >= 40 ? 'Moderate keyword overlap — some job terms are missing from the profile.'
      : 'Low keyword overlap — the profile may need to mirror more of the job\'s language.',
    strengths,
    gaps: gaps.slice(0, 8),
    evidence,
  };
}

function scoreIndustryDomain(
  profile: ProfileData,
  jobText: string
): MatchDimension {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];

  const industryKeywords: Record<string, string[]> = {
    fintech: ['fintech', 'finance', 'banking', 'payment', 'trading', 'investment', 'crypto', 'blockchain', 'defi'],
    healthcare: ['health', 'medical', 'clinical', 'patient', 'pharma', 'biotech', 'healthcare', 'hipaa'],
    ecommerce: ['ecommerce', 'e-commerce', 'retail', 'shopping', 'marketplace', 'merchant', 'storefront'],
    saas: ['saas', 'subscription', 'b2b', 'enterprise', 'platform', 'multi.tenant'],
    gaming: ['gaming', 'game', 'player', 'multiplayer', 'gameplay', 'unity', 'unreal'],
    ai_ml: ['machine learning', 'artificial intelligence', 'deep learning', 'neural', 'nlp', 'computer vision'],
    devtools: ['developer tools', 'devtools', 'infrastructure', 'platform engineering', 'ci/cd', 'deployment'],
    security: ['cybersecurity', 'security', 'infosec', 'vulnerability', 'threat', 'compliance', 'soc2'],
    education: ['edtech', 'education', 'learning', 'student', 'curriculum', 'lms'],
  };

  let matchedIndustries = 0;
  let totalJobIndustries = 0;

  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    const inJob = keywords.some(kw => jobText.includes(kw));
    if (!inJob) continue;
    totalJobIndustries++;

    const profileText = getAllProfileText(profile);
    const inProfile = keywords.some(kw => profileText.includes(kw));
    if (inProfile) {
      matchedIndustries++;
      strengths.push(`Relevant domain: ${industry}`);
      const relatedSystem = profile.systems.find(s =>
        keywords.some(kw => (s.description || '').toLowerCase().includes(kw))
      );
      if (relatedSystem) {
        evidence.push(`${industry} experience via ${relatedSystem.name}`);
      }
    }
  }

  const score = totalJobIndustries > 0
    ? Math.round((matchedIndustries / totalJobIndustries) * 100)
    : 60;

  if (totalJobIndustries === 0) {
    evidence.push('No specific industry detected in job posting');
  }

  return {
    dimension_name: 'Industry & Domain',
    score: Math.max(score, 15),
    weight: DIMENSION_WEIGHTS.industry_domain,
    feedback: score >= 70 ? 'Strong industry alignment.'
      : score >= 40 ? 'Some industry overlap — emphasize transferable domain knowledge.'
      : totalJobIndustries === 0 ? 'No specific industry requirements detected.'
      : 'Limited industry overlap — consider researching the domain.',
    strengths,
    gaps: matchedIndustries === 0 && totalJobIndustries > 0 ? ['No matching industry experience found'] : [],
    evidence,
  };
}

function scoreLocationLogistics(
  templateCv: TemplateCV,
  jobPosting: JobPosting
): MatchDimension {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const evidence: string[] = [];
  const jobText = jobPosting.content.toLowerCase();

  const isRemote = /\b(remote|work from home|wfh|anywhere|distributed|telecommute)\b/i.test(jobPosting.content);
  const isHybrid = /\b(hybrid|flexible|2.days|3.days|in.office)\b/i.test(jobPosting.content);
  const isOnsite = !isRemote && /\b(on.site|onsite|in.person|in.office)\b/i.test(jobPosting.content);

  const location = (templateCv.location || '').toLowerCase();

  if (isRemote) {
    strengths.push('Job is remote — location is not a barrier');
    evidence.push('Remote-friendly posting detected');
  } else if (isHybrid) {
    evidence.push('Hybrid role — location matters');
    gaps.push('Hybrid role may require relocation');
  } else if (isOnsite) {
    gaps.push('Onsite role — relocation likely required');
  }

  const visaKeywords = ['visa sponsorship', 'visa', 'work permit', 'relocation assistance', 'relocation support'];
  const mentionsVisa = visaKeywords.some(kw => jobText.includes(kw));
  if (mentionsVisa) {
    evidence.push('Visa/relocation mentioned in posting');
  }

  const score = isRemote ? 90 : isHybrid ? 50 : isOnsite ? 30 : 70;

  return {
    dimension_name: 'Location & Logistics',
    score,
    weight: DIMENSION_WEIGHTS.location_logistics,
    feedback: isRemote ? 'Remote role — no location constraints.'
      : isHybrid ? 'Hybrid role — proximity may be a factor.'
      : isOnsite ? 'Onsite role — relocation would be needed.'
      : 'Work arrangement unclear from the posting.',
    strengths,
    gaps,
    evidence,
  };
}

function calculateWeightedScore(dimensions: MatchDimension[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of dimensions) {
    weightedSum += dim.score * dim.weight;
    totalWeight += dim.weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function generateRecommendation(score: number): Recommendation {
  if (score >= 80) return 'strong_yes';
  if (score >= 65) return 'yes';
  if (score >= 45) return 'maybe';
  if (score >= 30) return 'no';
  return 'strong_no';
}

function generateGapSuggestions(
  requiredSkills: string[],
  jobKeywords: string[],
  profile: ProfileData,
  jobText: string
): GapSuggestion[] {
  const suggestions: GapSuggestion[] = [];
  const profileText = getAllProfileText(profile);
  const allSkillNames = profile.allSkills.map(s => s.toLowerCase());

  for (const skill of requiredSkills) {
    const inProfile = skillMatches(skill, profileText) || allSkillNames.some(s => skillMatches(skill, s));
    if (inProfile) continue;

    const relatedBlock = profile.blocks.find(b => {
      const bText = `${b.title} ${b.content} ${b.skills?.join(' ') || ''}`.toLowerCase();
      for (const [alias, equivalents] of Object.entries(TECH_ALIASES)) {
        if (equivalents.includes(normalizeSkill(skill)) && bText.includes(alias)) return true;
        if (normalizeSkill(skill) === alias && equivalents.some(eq => bText.includes(eq))) return true;
      }
      return false;
    });

    if (relatedBlock) {
      suggestions.push({
        gap: `No explicit ${skill} experience`,
        suggestion: `"${relatedBlock.title}" likely uses ${skill} — add it as evidence`,
        related_block_id: relatedBlock.id,
        related_block_title: relatedBlock.title,
        action: 'add_to_block',
      });
    } else {
      const relatedProject = profile.projects.find(p => {
        const pText = `${p.name} ${p.description || ''} ${p.technologies || ''}`.toLowerCase();
        return skillMatches(skill, pText);
      });

      if (relatedProject) {
        suggestions.push({
          gap: `No explicit ${skill} experience`,
          suggestion: `"${relatedProject.name}" uses ${skill} — link it to a block`,
          related_project_id: relatedProject.id,
          related_project_name: relatedProject.name,
          action: 'add_to_block',
        });
      } else {
        suggestions.push({
          gap: `Missing: ${skill}`,
          suggestion: `Consider adding ${skill} to your skills if you have experience with it`,
          action: 'add_skill',
        });
      }
    }
  }

  const keywordGaps = jobKeywords.slice(0, 15).filter(kw => !profileText.includes(kw));
  for (const kw of keywordGaps.slice(0, 3)) {
    const alreadySuggested = suggestions.some(s => s.gap.toLowerCase().includes(kw));
    if (!alreadySuggested) {
      suggestions.push({
        gap: `Keyword "${kw}" not in profile`,
        suggestion: `If you have experience with ${kw}, mention it in your CV or cover letter`,
        action: 'note_for_cover_letter',
      });
    }
  }

  return suggestions;
}

function generateSummary(
  dimensions: MatchDimension[],
  score: number,
  recommendation: Recommendation,
  gaps: GapSuggestion[]
): string {
  const parts: string[] = [];

  const recLabels: Record<Recommendation, string> = {
    strong_yes: 'Strong match',
    yes: 'Good match',
    maybe: 'Moderate match',
    no: 'Weak match',
    strong_no: 'Poor match',
  };
  parts.push(`${recLabels[recommendation]} (${score}%).`);

  const topStrength = dimensions.filter(d => d.score >= 70).sort((a, b) => b.score - a.score)[0];
  if (topStrength) {
    parts.push(`Strongest in ${topStrength.dimension_name}.`);
  }

  const biggestGap = dimensions.filter(d => d.score < 50).sort((a, b) => a.score - b.score)[0];
  if (biggestGap) {
    parts.push(`Biggest gap: ${biggestGap.dimension_name}.`);
  }

  if (gaps.length > 0) {
    const actionable = gaps.filter(g => g.action !== 'ignore').length;
    if (actionable > 0) {
      parts.push(`${actionable} gap${actionable > 1 ? 's' : ''} you may be able to fill from existing experience.`);
    }
  }

  return parts.join(' ');
}
