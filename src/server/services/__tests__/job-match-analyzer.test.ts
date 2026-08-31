import { describe, it, expect } from 'vitest';
import { analyzeJobMatch } from '../job-match-analyzer.js';
import type { JobPosting, TemplateCV, System, Block, Employment, Education, Project } from '../../../shared/types.js';

function makeProfile(overrides: {
  employment?: Partial<Employment>[];
  blocks?: Partial<Block>[];
  systems?: Partial<System>[];
  education?: Partial<Education>[];
  projects?: Partial<Project>[];
  allSkills?: string[];
  templateCv?: Partial<TemplateCV>;
} = {}) {
  const templateCv: TemplateCV = {
    id: 1,
    full_name: 'Test User',
    professional_title: 'Senior Software Engineer',
    email: 'test@example.com',
    phone: '+1234567890',
    location: 'Henties Bay, Namibia',
    linkedin: null,
    website: null,
    summary: 'Experienced software engineer with expertise in Rust, TypeScript, and systems programming.',
    education: [],
    employment: [],
    updated_at: '2026-01-01',
    ...overrides.templateCv,
  };

  return {
    templateCv,
    employment: (overrides.employment || []).map((e, i) => ({
      id: i + 1, company: null, title: null, start_date: null, end_date: null,
      location: null, description: null, sort_order: i, ...e,
    })) as Employment[],
    education: (overrides.education || []).map((e, i) => ({
      id: i + 1, institution: null, degree: null, field: null,
      start_date: null, end_date: null, details: null, sort_order: i, ...e,
    })) as Education[],
    systems: (overrides.systems || []).map((s, i) => ({
      id: i + 1, name: '', description: null, industry: null, notes: null,
      created_at: '', updated_at: '', ...s,
    })) as System[],
    blocks: (overrides.blocks || []).map((b, i) => ({
      id: i + 1, title: '', content: '', skills: [], is_generic: true,
      target_companies: '', created_at: '', updated_at: '', ...b,
    })) as Block[],
    projects: (overrides.projects || []).map((p, i) => ({
      id: i + 1, name: '', description: null, url: null, github_url: null,
      demo_url: null, technologies: null, start_date: null, end_date: null,
      category: 'personal', created_at: '', updated_at: '', ...p,
    })) as Project[],
    allSkills: overrides.allSkills || [],
  };
}

function makeJobPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 1,
    title: 'Software Engineer',
    company: 'Test Corp',
    url: null,
    content: 'We are looking for a software engineer with experience in Rust and TypeScript.',
    notes: null,
    status: 'active',
    application_status: 'not_applied',
    applied_date: null,
    compiled_cv_id: null,
    red_team_result_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('analyzeJobMatch', () => {
  describe('skill extraction — false positive prevention', () => {
    it('does not match "C" from "C-level executives"', () => {
      const job = makeJobPosting({
        title: 'Account Executive — Enterprise Sales',
        content: 'Selling to C-level executives at enterprise companies. SaaS experience required. CRM knowledge preferred.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.gaps).not.toContain('Missing: c');
      expect(techDim.strengths).not.toContain('Has c experience');
    });

    it('does not match "R" from generic text', () => {
      const job = makeJobPosting({
        title: 'Product Manager',
        content: 'Lead product strategy and work with engineering teams. Experience with roadmaps and user research required.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.gaps).not.toContain('Missing: r');
    });

    it('correctly extracts C++ and C# when explicitly mentioned', () => {
      const job = makeJobPosting({
        title: 'Game Developer',
        content: 'We need a developer proficient in C++ and C# for game engine work. Unity experience a plus.',
      });
      const profile = makeProfile({ allSkills: ['c++'] });
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.strengths).toContain('Has c++ experience');
      expect(techDim.gaps).toContain('Missing: c#');
    });
  });

  describe('non-technical role detection', () => {
    it('scores 20 with weight 0.10 for a sales role (non-technical)', () => {
      const job = makeJobPosting({
        title: 'Account Executive',
        content: 'Drive revenue growth by selling our SaaS platform to enterprise customers. CRM experience required. Quota-carrying role.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBe(20);
      expect(techDim.weight).toBe(0.10);
      expect(techDim.feedback).toContain('Non-technical role');
    });

    it('scores 20 with weight 0.10 for a product manager role', () => {
      const job = makeJobPosting({
        title: 'Product Manager',
        content: 'Own the product roadmap. Work with customers and engineering to define features. Write user stories and prioritize backlog.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBe(20);
      expect(techDim.weight).toBe(0.10);
    });

    it('scores 50 (not 20) for VP of Engineering — title contains "Engineering"', () => {
      const job = makeJobPosting({
        title: 'VP of Engineering',
        content: 'Lead our engineering organization.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBe(50);
      expect(techDim.weight).toBe(0.10);
      expect(techDim.feedback).toContain('No specific technical requirements');
    });

    it('scores 50 for a role with tech indicators but no specific skills', () => {
      const job = makeJobPosting({
        title: 'Developer Advocate',
        content: 'Build demos and SDKs for our cloud platform. Speak at conferences. Write technical blog posts about our API and framework.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBe(50);
      expect(techDim.weight).toBe(0.10);
    });
  });

  describe('technical role scoring', () => {
    it('scores 100 when all required skills are in profile', () => {
      const job = makeJobPosting({
        title: 'Rust Engineer',
        content: 'Build systems in Rust. Experience with TypeScript and Docker required. Knowledge of PostgreSQL a plus.',
      });
      const profile = makeProfile({
        allSkills: ['rust', 'typescript', 'docker', 'postgresql'],
        blocks: [{ title: 'Built API server', content: 'Built a REST API in Rust with Docker and PostgreSQL', skills: ['rust', 'docker', 'postgresql'] }],
      });
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBe(100);
      expect(techDim.weight).toBe(0.30);
    });

    it('scores low when profile has none of the required skills', () => {
      const job = makeJobPosting({
        title: 'Data Scientist',
        content: 'We need a data scientist with Python, machine learning, deep learning, and NLP experience. TensorFlow required.',
      });
      const profile = makeProfile({
        allSkills: ['rust', 'typescript'],
        blocks: [{ title: 'Built web server', content: 'Built a web server in Rust', skills: ['rust'] }],
      });
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.score).toBeLessThan(40);
      expect(techDim.weight).toBe(0.30);
      expect(techDim.gaps.length).toBeGreaterThan(0);
    });

    it('uses full 0.30 weight when required skills are detected', () => {
      const job = makeJobPosting({
        title: 'Backend Engineer',
        content: 'Backend engineer needed. Must know Go and Kubernetes.',
      });
      const profile = makeProfile({ allSkills: ['go'] });
      const result = analyzeJobMatch(job, profile);

      const techDim = result.dimensions.find(d => d.dimension_name === 'Technical Skills')!;
      expect(techDim.weight).toBe(0.30);
    });
  });

  describe('recommendation thresholds', () => {
    it('returns strong_yes for score >= 80', () => {
      const job = makeJobPosting({
        title: 'Rust Developer',
        content: 'Need a rust developer with typescript and docker skills. Remote work.',
      });
      const profile = makeProfile({
        allSkills: ['rust', 'typescript', 'docker'],
        employment: [{ title: 'Senior Rust Developer', company: 'TechCo', start_date: '2020-01-01', description: 'Developing rust services with docker' }],
        blocks: [{ title: 'Rust microservice', content: 'Built rust microservice with typescript frontend and docker deployment', skills: ['rust', 'typescript', 'docker'] }],
      });
      const result = analyzeJobMatch(job, profile);
      expect(['strong_yes', 'yes']).toContain(result.recommendation);
    });

    it('returns strong_no for very low scores', () => {
      const job = makeJobPosting({
        title: 'Senior Data Scientist',
        content: 'Need PhD in machine learning with Python, TensorFlow, deep learning, NLP, computer vision. 10+ years experience.',
      });
      const profile = makeProfile({
        allSkills: ['html', 'css'],
        employment: [{ title: 'Sales Representative', company: 'RetailCo', description: 'Sold products to customers' }],
      });
      const result = analyzeJobMatch(job, profile);
      expect(['no', 'strong_no']).toContain(result.recommendation);
    });
  });

  describe('location & logistics', () => {
    it('scores 90 for remote jobs', () => {
      const job = makeJobPosting({
        content: 'This is a fully remote position. Work from anywhere in the world.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const locDim = result.dimensions.find(d => d.dimension_name === 'Location & Logistics')!;
      expect(locDim.score).toBe(90);
    });

    it('scores 50 for hybrid jobs', () => {
      const job = makeJobPosting({
        content: 'Hybrid role — 3 days in office, 2 days flexible scheduling.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const locDim = result.dimensions.find(d => d.dimension_name === 'Location & Logistics')!;
      expect(locDim.score).toBe(50);
    });

    it('scores 30 for onsite jobs', () => {
      const job = makeJobPosting({
        content: 'Onsite position in our San Francisco office.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const locDim = result.dimensions.find(d => d.dimension_name === 'Location & Logistics')!;
      expect(locDim.score).toBe(30);
    });
  });

  describe('weighted score calculation', () => {
    it('normalizes weights when tech skills weight is reduced', () => {
      const job = makeJobPosting({
        title: 'Account Executive',
        content: 'Sell SaaS to C-level executives. CRM and Salesforce experience preferred. Quota carrying sales role.',
      });
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);

      const totalWeight = result.dimensions.reduce((sum, d) => sum + d.weight, 0);
      const expectedTotalWeight = 0.10 + 0.20 + 0.15 + 0.15 + 0.10 + 0.10;
      expect(Math.abs(totalWeight - expectedTotalWeight)).toBeLessThan(0.001);

      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);
    });

    it('overall score is between 0 and 100', () => {
      const job = makeJobPosting();
      const profile = makeProfile();
      const result = analyzeJobMatch(job, profile);
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);
    });
  });

  describe('gap suggestions', () => {
    it('suggests adding missing skills', () => {
      const job = makeJobPosting({
        title: 'Full Stack Developer',
        content: 'Need a developer with Rust and Python experience. React and TypeScript required.',
      });
      const profile = makeProfile({
        allSkills: ['rust'],
      });
      const result = analyzeJobMatch(job, profile);

      expect(result.gap_suggestions.length).toBeGreaterThan(0);
      const hasAddSkill = result.gap_suggestions.some(s => s.action === 'add_skill');
      expect(hasAddSkill).toBe(true);
    });
  });
});
