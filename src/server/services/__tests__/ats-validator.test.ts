import { describe, it, expect } from 'vitest';
import {
  checkContactInfo,
  checkRequiredSections,
  checkContentQuality,
  checkAtsCompatibility,
} from '../ats-validator.js';

describe('checkContactInfo', () => {
  it('passes when all contact info is present and valid', () => {
    const results = checkContactInfo({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      location: 'Berlin, Germany',
    });
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });

  it('fails when name is missing', () => {
    const results = checkContactInfo({ full_name: '', email: 'a@b.com', phone: '123', location: '' });
    const nameCheck = results.find(r => r.check === 'Full Name');
    expect(nameCheck?.status).toBe('fail');
  });

  it('fails when email is missing', () => {
    const results = checkContactInfo({ full_name: 'Jane', email: '', phone: '123', location: '' });
    const emailCheck = results.find(r => r.check === 'Email');
    expect(emailCheck?.status).toBe('fail');
  });

  it('fails when email format is invalid', () => {
    const results = checkContactInfo({ full_name: 'Jane', email: 'not-an-email', phone: '123', location: '' });
    const emailCheck = results.find(r => r.check === 'Email');
    expect(emailCheck?.status).toBe('fail');
    expect(emailCheck?.message).toContain('Invalid');
  });

  it('warns when phone is missing', () => {
    const results = checkContactInfo({ full_name: 'Jane', email: 'a@b.com', phone: '', location: '' });
    const phoneCheck = results.find(r => r.check === 'Phone');
    expect(phoneCheck?.status).toBe('warning');
  });

  it('warns when phone number is too short', () => {
    const results = checkContactInfo({ full_name: 'Jane', email: 'a@b.com', phone: '123', location: '' });
    const phoneCheck = results.find(r => r.check === 'Phone');
    expect(phoneCheck?.status).toBe('warning');
    expect(phoneCheck?.message).toContain('too short');
  });

  it('warns when location is missing', () => {
    const results = checkContactInfo({ full_name: 'Jane', email: 'a@b.com', phone: '1234567890', location: '' });
    const locCheck = results.find(r => r.check === 'Location');
    expect(locCheck?.status).toBe('warning');
  });

  it('handles null templateCv gracefully', () => {
    const results = checkContactInfo(null);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.status === 'fail')).toBe(true);
  });
});

describe('checkRequiredSections', () => {
  it('passes all checks for a well-structured CV', () => {
    const content = `# Jane Doe

## Summary
Experienced engineer with 10 years in systems programming.

## Skills
- Rust, TypeScript, Docker
- PostgreSQL, Redis

## Experience
### Senior Engineer at TechCo
- Built microservices in Rust
- Led migration from Python to Rust, reducing latency by 60%
`;
    const results = checkRequiredSections(content);
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });

  it('warns when no summary section found', () => {
    const content = `# Jane Doe

## Skills
- Rust

## Experience
- Did things
`;
    const results = checkRequiredSections(content);
    const summaryCheck = results.find(r => r.check === 'Summary Section');
    expect(summaryCheck?.status).toBe('warning');
  });

  it('fails when no skills section found', () => {
    const content = `# Jane Doe

## Summary
An engineer.

## Experience
- Did things
- More things
`;
    const results = checkRequiredSections(content);
    const skillsCheck = results.find(r => r.check === 'Skills Section');
    expect(skillsCheck?.status).toBe('fail');
  });

  it('warns when no experience section found', () => {
    const content = `# Jane Doe

## Summary
An engineer.

## Skills
- Rust
`;
    const results = checkRequiredSections(content);
    const expCheck = results.find(r => r.check === 'Experience Section');
    expect(expCheck?.status).toBe('warning');
  });

  it('detects "Technologies" as a skills section', () => {
    const content = `# Jane Doe

## Summary
Engineer.

## Technologies
- Rust, Go

## Experience
- Built things
`;
    const results = checkRequiredSections(content);
    const skillsCheck = results.find(r => r.check === 'Skills Section');
    expect(skillsCheck?.status).toBe('pass');
  });
});

describe('checkContentQuality', () => {
  it('passes for a substantial CV with bullets and numbers', () => {
    const content = `# CV

## Summary
Experienced software engineer with over 10 years of professional experience in systems programming, platform architecture, and team leadership across multiple high-growth startups and large enterprise environments. Passionate about building reliable distributed systems, mentoring engineering teams, and driving technical strategy that aligns with business objectives and customer needs.

## Skills
Proficient in Rust, TypeScript, Python, Go, Docker, Kubernetes, PostgreSQL, Redis, GraphQL, and AWS. Experienced with microservices architecture, event-driven systems, and infrastructure automation using Terraform and CI/CD pipelines.

## Experience
### Senior Platform Engineer at Infrastructure Co
- Led a cross-functional team of 8 engineers delivering a microservices platform that serves millions of daily active users across multiple geographic regions
- Reduced average deployment time by 45 percent through comprehensive CI/CD pipeline optimization and automated rollback strategies across all production services
- Built and maintained 12 separate microservices handling over 50 million requests per day with 99.99 percent uptime and sub-100ms p99 latency guarantees
- Managed a 2 million dollar annual infrastructure budget across multiple cloud providers, achieving 30 percent cost reduction through right-sizing and reserved instances
- Increased automated test coverage from 30 percent to 95 percent over 6 months by introducing property-based testing and contract testing frameworks
- Architected the migration from a legacy monolith to an event-driven architecture serving 200 internal clients with zero downtime during the transition period
- Mentored 4 junior developers who were all promoted within 18 months through structured pairing sessions, code review feedback, and growth plan development
- Designed and implemented a real-time data pipeline processing 10TB of event data daily using Kafka, Rust workers, and PostgreSQL for downstream analytics
- Reduced mean incident response time by 60 percent through automated alerting, comprehensive runbooks, and on-call rotation improvements across the platform team
- Delivered 3 major product launches on schedule with zero critical bugs by implementing thorough load testing, chaos engineering practices, and staged rollout procedures
`;
    const results = checkContentQuality(content);
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });

  it('fails for very short content (< 150 words)', () => {
    const content = `# Jane Doe\n\nSoftware engineer.`;
    const results = checkContentQuality(content);
    const lengthCheck = results.find(r => r.check === 'Content Length');
    expect(lengthCheck?.status).toBe('fail');
  });

  it('warns for brief content (150-300 words)', () => {
    const words = Array(200).fill('word').join(' ');
    const content = `# CV\n\n${words}`;
    const results = checkContentQuality(content);
    const lengthCheck = results.find(r => r.check === 'Content Length');
    expect(lengthCheck?.status).toBe('warning');
  });

  it('warns when few bullet points', () => {
    const words = Array(400).fill('word').join(' ');
    const content = `# CV\n\n${words}\n\n- One bullet`;
    const results = checkContentQuality(content);
    const bulletCheck = results.find(r => r.check === 'Bullet Points');
    expect(bulletCheck?.status).toBe('warning');
  });

  it('warns when no quantified achievements', () => {
    const content = `# CV

## Experience
- Did some work
- Helped the team
- Wrote some code
- Attended meetings
- Reviewed pull requests
`;
    const results = checkContentQuality(content);
    const quantCheck = results.find(r => r.check === 'Quantified Achievements');
    expect(quantCheck?.status).toBe('warning');
  });
});

describe('checkAtsCompatibility', () => {
  it('passes for clean markdown without tables or images', () => {
    const content = `# Jane Doe

## Experience
- Built things
- More things

Visit https://example.com for details.
`;
    const results = checkAtsCompatibility(content);
    expect(results.every(r => r.status === 'pass')).toBe(true);
  });

  it('warns on markdown tables', () => {
    const content = `# CV

| Skill | Years |
|-------|-------|
| Rust  | 5     |
`;
    const results = checkAtsCompatibility(content);
    const tableCheck = results.find(r => r.check === 'Tables');
    expect(tableCheck?.status).toBe('warning');
  });

  it('fails on image references', () => {
    const content = `# CV

![My Photo](photo.jpg)

## Experience
- Did things
`;
    const results = checkAtsCompatibility(content);
    const imgCheck = results.find(r => r.check === 'Images');
    expect(imgCheck?.status).toBe('fail');
  });

  it('warns on emoji', () => {
    const content = `# CV 🚀

## Experience
- Built awesome things ✨
- More great work 💪
`;
    const results = checkAtsCompatibility(content);
    const charCheck = results.find(r => r.check === 'Special Characters');
    expect(charCheck?.status).toBe('warning');
  });

  it('passes URLs as safe', () => {
    const content = `# CV\n\nhttps://github.com/user\n- item`;
    const results = checkAtsCompatibility(content);
    const urlCheck = results.find(r => r.check === 'URLs');
    expect(urlCheck?.status).toBe('pass');
  });
});
