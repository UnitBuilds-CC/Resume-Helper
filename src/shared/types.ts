export interface System {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: number;
  name: string;
}

export interface Block {
  id: number;
  title: string;
  content: string;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export interface TemplateCV {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
  summary: string | null;
  education: Education[];
  employment: Employment[];
  updated_at: string;
}

export interface Education {
  id: number;
  institution: string | null;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  details: string | null;
  sort_order: number;
}

export interface Employment {
  id: number;
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  description: string | null;
  sort_order: number;
}

export interface JobPosting {
  id: number;
  title: string;
  company: string | null;
  url: string | null;
  content: string;
  notes: string | null;
  status: 'active' | 'applied' | 'rejected' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface CompiledCV {
  id: number;
  job_posting_id: number;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RedTeamResult {
  id: number;
  compiled_cv_id: number;
  phase1_qualified: number;
  phase2_score: number;
  phase3_summary: string;
  overall_score: number;
  full_analysis: string;
  questions: Question[];
  created_at: string;
}

export interface Question {
  id: number;
  red_team_result_id: number;
  question: string;
  context: string | null;
  skill_tag: string | null;
  status: 'pending' | 'answered' | 'dismissed';
  answer: string | null;
  created_at: string;
}

export interface DashboardStats {
  systems_count: number;
  blocks_count: number;
  skills_count: number;
  job_postings_count: number;
  compiled_cvs_count: number;
  pending_questions_count: number;
}
