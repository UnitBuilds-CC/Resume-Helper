// Cover letter generator service
// Generates tailored cover letters from database content

interface JobPosting {
  id: number;
  title: string;
  company: string | null;
  url: string | null;
  content: string;
}

interface TemplateCV {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
  summary: string | null;
}

interface System {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  notes: string | null;
}

interface Block {
  id: number;
  title: string;
  content: string;
  skills: string[];
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
    'while', 'during', 'work', 'working', 'role', 'position', 'job'
  ]);
  
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // Count frequency and return top keywords
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// Calculate relevance score between item and job keywords
function calculateRelevance(
  item: { title: string; description?: string | null; content?: string; skills?: string[] },
  keywords: string[]
): number {
  const text = `${item.title} ${item.description || ''} ${item.content || ''} ${(item.skills || []).join(' ')}`.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
      // Bonus for title match
      if (item.title.toLowerCase().includes(keyword)) {
        score += 2;
      }
      // Bonus for skill match
      if (item.skills?.some(s => s.toLowerCase().includes(keyword))) {
        score += 1.5;
      }
    }
  }
  
  return score;
}

// Generate opening paragraph
function generateOpening(jobPosting: JobPosting, templateCv: TemplateCV): string {
  const company = jobPosting.company || 'your company';
  const title = jobPosting.title || 'this position';
  
  return `I am writing to express my strong interest in the ${title} position at ${company}. With my background in software engineering and experience building high-performance systems, I am confident I can make a meaningful contribution to your team.`;
}

// Generate body paragraphs from selected systems/blocks
function generateBodyParagraphs(
  selected: Array<{ type: string; item: any; score: number }>,
  jobPosting: JobPosting
): string[] {
  const paragraphs: string[] = [];
  
  // Take top 3 items
  const topItems = selected.slice(0, 3);
  
  for (const { type, item } of topItems) {
    if (type === 'system') {
      const system = item as System;
      const paragraph = `In my work on ${system.name}${system.industry ? `, a ${system.industry} project` : ''}, I ${system.description ? system.description.toLowerCase().startsWith('i') ? system.description : `developed ${system.description.toLowerCase()}` : 'implemented robust solutions'}. This experience has given me deep expertise in building scalable, high-performance systems.`;
      paragraphs.push(paragraph);
    } else if (type === 'block') {
      const block = item as Block;
      const paragraph = `${block.title}: ${block.content}`;
      paragraphs.push(paragraph);
    }
  }
  
  return paragraphs;
}

// Generate employment highlight
function generateEmploymentHighlight(employment: Employment, jobPosting: JobPosting): string {
  const company = employment.company || 'my previous company';
  const title = employment.title || 'Software Engineer';
  const description = employment.description || '';
  
  // Extract first 2 sentences from description
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const highlight = sentences.slice(0, 2).join('. ');
  
  return `Most recently, as ${title} at ${company}, ${highlight}. This role has honed my ability to deliver high-quality solutions in fast-paced environments.`;
}

// Main cover letter generation function
export function generateCoverLetter(
  jobPosting: JobPosting,
  templateCv: TemplateCV,
  systems: System[],
  blocks: Block[],
  employment: Employment[]
): string {
  // 1. Analyze job posting for keywords
  const jobKeywords = extractKeywords(jobPosting.content);
  
  // 2. Score systems/blocks by relevance
  const scoredItems = [
    ...systems.map(s => ({ type: 'system', item: s, score: calculateRelevance(s, jobKeywords) })),
    ...blocks.map(b => ({ type: 'block', item: b, score: calculateRelevance(b, jobKeywords) }))
  ].sort((a, b) => b.score - a.score);
  
  // 3. Generate cover letter structure
  const letter: string[] = [];
  
  // Opening
  letter.push(`Dear Hiring Manager,`);
  letter.push(``);
  letter.push(generateOpening(jobPosting, templateCv));
  letter.push(``);
  
  // Body paragraphs (2-3 paragraphs from selected items)
  const bodyParagraphs = generateBodyParagraphs(scoredItems, jobPosting);
  letter.push(...bodyParagraphs);
  letter.push(``);
  
  // Employment highlight
  if (employment.length > 0) {
    letter.push(generateEmploymentHighlight(employment[0], jobPosting));
    letter.push(``);
  }
  
  // Closing
  const companyName = jobPosting.company || 'your company';
  letter.push(`I am excited about the opportunity to contribute to ${companyName} and would welcome the opportunity to discuss how my experience aligns with your needs. I am available for an interview at your convenience and can be reached at ${templateCv.email || 'my email'} or ${templateCv.phone || 'my phone number'}.`);
  letter.push(``);
  letter.push(`Thank you for your consideration.`);
  letter.push(``);
  letter.push(`Sincerely,`);
  letter.push(`${templateCv.full_name || 'Your Name'}`);
  
  return letter.join('\n');
}
