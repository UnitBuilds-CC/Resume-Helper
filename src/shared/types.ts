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
  is_generic: boolean;
  target_companies: string;
  employment_ids?: number[];
  system_ids?: number[];
  project_ids?: number[];
  created_at: string;
  updated_at: string;
}

export interface TemplateCV {
  id: number;
  full_name: string | null;
  professional_title: string | null;
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

export interface Project {
  id: number;
  name: string;
  description: string | null;
  url: string | null;
  github_url: string | null;
  demo_url: string | null;
  technologies: string | null;
  start_date: string | null;
  end_date: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface JobPosting {
  id: number;
  title: string;
  company: string | null;
  url: string | null;
  content: string;
  notes: string | null;
  status: 'active' | 'applied' | 'rejected' | 'withdrawn';
  application_status: ApplicationStatus;
  applied_date: string | null;
  compiled_cv_id: number | null;
  red_team_result_id: number | null;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 
  | 'not_applied'
  | 'preparing'
  | 'ready_to_apply'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationQuestion {
  id: number;
  job_posting_id: number;
  question: string;
  question_type: string;
  sort_order: number;
  created_at: string;
}

export interface ApplicationAnswer {
  id: number;
  job_posting_id: number;
  question_id: number;
  answer: string;
  is_auto_generated: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationQuestionWithAnswer extends ApplicationQuestion {
  answer: string | null;
  answer_id: number | null;
  is_auto_generated: number | null;
}

export interface GitRepo {
  id: number;
  path: string;
  remote_url: string | null;
  branch: string;
  last_synced_commit: string | null;
  last_synced_at: string | null;
  created_at: string;
  pending_systems: number;
  pending_blocks: number;
}

export interface GitSystem {
  id: number;
  repo_id: number;
  commit_hash: string;
  file_path: string | null;
  name: string;
  description: string | null;
  industry: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface GitBlock {
  id: number;
  repo_id: number;
  commit_hash: string;
  file_path: string | null;
  title: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface GitSyncLog {
  id: number;
  repo_id: number;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: 'in_progress' | 'completed' | 'failed';
  commits_processed: number;
  systems_extracted: number;
  blocks_extracted: number;
  error_message: string | null;
}

export interface CoverLetter {
  id: number;
  job_posting_id: number;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  job_title?: string;
  job_company?: string;
}

export interface CompiledCV {
  id: number;
  job_posting_id: number;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type Recommendation = 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';

export interface RedFlag {
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence?: string;
  recommendation?: string;
}

export interface RedTeamDimension {
  id: number;
  red_team_result_id: number;
  dimension_name: string;
  score: number;
  weight: number;
  feedback: string;
  strengths: string[] | null;
  gaps: string[] | null;
  evidence: string[] | null;
  created_at: string;
}

export interface RedTeamResult {
  id: number;
  compiled_cv_id: number;
  phase1_qualified: number;
  phase2_score: number;
  phase3_summary: string;
  overall_score: number;
  full_analysis: string;
  recommendation: Recommendation | null;
  red_flags: RedFlag[] | null;
  job_fit_summary: string | null;
  dimensions: RedTeamDimension[];
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

export interface MatchDimension {
  dimension_name: string;
  score: number;
  weight: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
  evidence: string[];
}

export interface GapSuggestion {
  gap: string;
  suggestion: string;
  related_block_id?: number;
  related_block_title?: string;
  related_system_id?: number;
  related_system_name?: string;
  related_project_id?: number;
  related_project_name?: string;
  action: 'add_to_block' | 'add_skill' | 'add_system' | 'note_for_cover_letter' | 'ignore';
}

export interface JobMatchResult {
  id: number;
  job_posting_id: number;
  overall_score: number;
  recommendation: Recommendation;
  summary: string;
  dimensions: MatchDimension[];
  gap_suggestions: GapSuggestion[];
  created_at: string;
  job_title?: string;
  job_company?: string;
}
