// Smart compilation service
// Intelligently selects relevant content from database based on job requirements

interface JobPosting {
  id: number;
  title: string;
  company: string | null;
  content: string;
}

interface TemplateCV {
  id: number;
  full_name: string | null;
  professional_title: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
  summary: string | null;
}

interface Education {
  id: number;
  institution: string | null;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  details: string | null;
}

interface Employment {
  id: number;
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  description: string | null;
}

interface System {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
}

interface Block {
  id: number;
  title: string;
  content: string;
  skills: string[];
  employment_ids?: number[];
  system_ids?: number[];
  project_ids?: number[];
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  technologies: string | null;
}

interface CompilationInput {
  jobPosting: JobPosting;
  templateCv: TemplateCV;
  education: Education[];
  employment: Employment[];
  systems: System[];
  blocks: Block[];
  projects: Project[];
}

interface EmploymentWithBlocks extends Employment {
  blocks: Block[];
}

interface CompilationOutput {
  personalInfo: TemplateCV;
  summary: string;
  education: Education[];
  employment: EmploymentWithBlocks[];
  systems: System[];
  blocks: Block[];
  projects: Project[];
}

// Extract keywords from job posting
function extractKeywords(content: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i',
    'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which', 'who',
    'whom', 'when', 'where', 'why', 'how', 'not', 'no', 'nor', 'if', 'then',
    'than', 'too', 'very', 'just', 'about', 'above', 'after', 'again', 'all',
    'also', 'am', 'any', 'because', 'before', 'between', 'both', 'each', 'few',
    'get', 'got', 'here', 'into', 'more', 'most', 'only', 'other', 'out', 'own',
    'same', 'so', 'some', 'such', 'there', 'through', 'under', 'until', 'up',
    'while', 'during', 'work', 'working', 'role', 'position', 'job', 'company',
    'team', 'experience', 'years', 'year', 'required', 'requirements', 'skills',
    'skill', 'ability', 'able', 'strong', 'good', 'great', 'excellent', 'plus',
    'preferred', 'nice', 'have', 'has', 'must', 'should', 'will', 'looking',
    'seeking', 'join', 'opportunity', 'opportunity'
  ]);
  
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Count frequency and return top keywords
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);
}

// Calculate relevance score for employment
function calculateEmploymentRelevance(employment: Employment, keywords: string[]): number {
  const text = `${employment.title} ${employment.company} ${employment.description}`.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
      // Bonus for title match
      if (employment.title?.toLowerCase().includes(keyword)) {
        score += 2;
      }
    }
  }
  
  return score;
}

// Calculate relevance score for block
function calculateBlockRelevance(block: Block, keywords: string[]): number {
  const text = `${block.title} ${block.content} ${block.skills.join(' ')}`.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
      // Bonus for title match
      if (block.title.toLowerCase().includes(keyword)) {
        score += 2;
      }
      // Bonus for skill match
      if (block.skills.some(s => s.toLowerCase().includes(keyword))) {
        score += 1.5;
      }
    }
  }
  
  return score;
}

// Calculate relevance score for system
function calculateSystemRelevance(system: System, keywords: string[]): number {
  const text = `${system.name} ${system.description} ${system.industry}`.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
      // Bonus for name match
      if (system.name.toLowerCase().includes(keyword)) {
        score += 2;
      }
      // Bonus for industry match
      if (system.industry?.toLowerCase().includes(keyword)) {
        score += 1.5;
      }
    }
  }
  
  return score;
}

// Calculate relevance score for project
function calculateProjectRelevance(project: Project, keywords: string[]): number {
  const text = `${project.name} ${project.description} ${project.technologies}`.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
      // Bonus for name match
      if (project.name.toLowerCase().includes(keyword)) {
        score += 2;
      }
      // Bonus for technology match
      if (project.technologies?.toLowerCase().includes(keyword)) {
        score += 1.5;
      }
    }
  }
  
  return score;
}

// Generate tailored summary
function generateTailoredSummary(
  templateCv: TemplateCV,
  jobPosting: JobPosting,
  employment: EmploymentWithBlocks[]
): string {
  const baseSummary = templateCv.summary || '';
  
  // If no base summary, create one
  if (!baseSummary) {
    const topEmployment = employment[0];
    const title = templateCv.professional_title || 'Software Engineer';
    const company = topEmployment?.company || 'leading technology companies';
    
    return `Experienced ${title} with a proven track record at ${company}. Specialized in building high-performance systems and delivering impactful solutions.`;
  }
  
  return baseSummary;
}

// Main compilation function
export function compileProfile(input: CompilationInput): CompilationOutput {
  const { jobPosting, templateCv, education, employment, systems, blocks, projects } = input;
  
  // 1. Extract keywords from job posting
  const jobKeywords = extractKeywords(jobPosting.content);
  
  // 2. Score and select relevant employment entries
  const scoredEmployment = employment.map(emp => ({
    ...emp,
    score: calculateEmploymentRelevance(emp, jobKeywords)
  })).sort((a, b) => b.score - a.score);
  
  // 3. For each employment, select relevant blocks
  const employmentWithBlocks: EmploymentWithBlocks[] = scoredEmployment.slice(0, 3).map(emp => {
    const relatedBlocks = blocks.filter(b => b.employment_ids?.includes(emp.id));
    const scoredBlocks = relatedBlocks.map(b => ({
      ...b,
      score: calculateBlockRelevance(b, jobKeywords)
    })).sort((a, b) => b.score - a.score);
    
    return {
      ...emp,
      blocks: scoredBlocks.slice(0, 3)
    };
  });
  
  // 4. Select relevant systems
  const relevantSystems = systems
    .map(sys => ({ ...sys, score: calculateSystemRelevance(sys, jobKeywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  // 5. Select relevant projects
  const relevantProjects = projects
    .map(proj => ({ ...proj, score: calculateProjectRelevance(proj, jobKeywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  // 6. Generate tailored summary
  const summary = generateTailoredSummary(templateCv, jobPosting, employmentWithBlocks);
  
  // 7. Collect all blocks from employment
  const allBlocks = employmentWithBlocks.flatMap(e => e.blocks);
  
  return {
    personalInfo: templateCv,
    summary,
    education: education.slice(0, 3),
    employment: employmentWithBlocks,
    systems: relevantSystems,
    blocks: allBlocks,
    projects: relevantProjects
  };
}
