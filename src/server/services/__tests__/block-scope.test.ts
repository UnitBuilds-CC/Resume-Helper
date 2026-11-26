import { describe, it, expect } from 'vitest';
import { blockAppliesToCompany } from '../block-scope.js';
import { compileProfile } from '../smart-compiler.js';
import { generateCoverLetter } from '../cover-letter-generator.js';

// Company-scoped blocks exist because scratch-pad text is often written for one employer. A letter once
// carried another company's paragraph because nothing filtered on is_generic / target_companies: the
// cover-letter scorer ranks every block by keyword overlap, and a remote/timezone paragraph scores well
// against any posting that mentions remote work. The fixtures below are invented so this suite can be
// public without describing anyone's actual career.

const scopedBlock = {
  id: 48,
  title: 'Northwind: Paris Timezone Overlap and Coverage',
  content: 'The Northwind team is in Paris and across Europe, so the MARKER_SENTINEL working-day overlap is '
    + 'complete. Remote work discipline and timezone coverage are existing behaviour.',
  skills: ['Remote Work', 'Time Management'],
  is_generic: false,
  target_companies: 'Northwind',
};

const genericBlock = {
  id: 20,
  title: 'Timezone, Ownership and Remote Discipline',
  content: 'I overlap the team working day wherever I am, and I have worked remotely since 2020, async and written.',
  skills: ['Remote Work', 'Ownership'],
  is_generic: true,
  target_companies: '',
};

const jobPosting = (company: string) => ({
  id: 1,
  title: 'Junior Fullstack Engineer',
  company,
  url: null,
  content: 'Remote-first team, flexible hours, timezone overlap, own processes start to finish, '
    + 'publish polished code, conduct PR code reviews.',
});

describe('blockAppliesToCompany', () => {
  it('keeps generic blocks for any company', () => {
    expect(blockAppliesToCompany(genericBlock, 'Acme Analytics, Inc.')).toBe(true);
    expect(blockAppliesToCompany(genericBlock, 'Northwind')).toBe(true);
  });

  it('keeps blocks whose genericity flag is absent (loaders predating the column)', () => {
    expect(blockAppliesToCompany({ id: 1, title: 'x', content: 'y', skills: [] } as any, 'Acme')).toBe(true);
  });

  it('drops a scoped block for a non-matching company', () => {
    expect(blockAppliesToCompany(scopedBlock, 'Acme Analytics, Inc.')).toBe(false);
  });

  it('keeps a scoped block for its own company, case-insensitively', () => {
    expect(blockAppliesToCompany(scopedBlock, 'Northwind')).toBe(true);
    expect(blockAppliesToCompany(scopedBlock, 'northwind GmbH')).toBe(true);
  });

  it('handles a comma-separated target list', () => {
    const multi = { ...scopedBlock, target_companies: 'Northwind, Globex' };
    expect(blockAppliesToCompany(multi, 'Globex')).toBe(true);
    expect(blockAppliesToCompany(multi, 'Acme Analytics, Inc.')).toBe(false);
  });

  it('drops a scoped block when the posting has no company', () => {
    expect(blockAppliesToCompany(scopedBlock, null)).toBe(false);
  });
});

describe('generateCoverLetter respects block scoping', () => {
  const templateCv = {
    id: 1, full_name: 'Alex Sample', email: 'alex@example.com', phone: '1', location: 'Testville',
    linkedin: null, website: 'github.com/example', summary: 'Backend engineer.',
    professional_title: 'Software Engineer',
  } as any;
  const employment = [{
    id: 1, company: 'Fictional Systems CC', title: 'Software Engineer', start_date: 'January 2024',
    end_date: 'December 2025', location: 'Elsewhere', description: 'A sample ERP and WMS in a managed language.',
  }];

  it('omits another employer-scoped paragraph', () => {
    const letter = generateCoverLetter(jobPosting('Acme Analytics, Inc.') as any, templateCv, [], [scopedBlock, genericBlock], employment as any);
    expect(letter).not.toContain('MARKER_SENTINEL');
    expect(letter.toLowerCase()).not.toContain('northwind');
  });

  it('still includes the same paragraph for the employer it was written for', () => {
    const letter = generateCoverLetter(jobPosting('Northwind') as any, templateCv, [], [scopedBlock, genericBlock], employment as any);
    expect(letter).toContain('MARKER_SENTINEL');
  });

  it('is not vacuous: without the scoped block the marker never appears anyway', () => {
    const letter = generateCoverLetter(jobPosting('Acme Analytics, Inc.') as any, templateCv, [], [genericBlock], employment as any);
    expect(letter).not.toContain('MARKER_SENTINEL');
  });
});

describe('compileProfile respects block scoping', () => {
  const input = (company: string) => ({
    jobPosting: jobPosting(company) as any,
    templateCv: { id: 1, full_name: 'Alex Sample', summary: 'Backend engineer.' } as any,
    education: [] as any[],
    employment: [{ id: 1, company: 'Fictional Systems CC', title: 'Software Engineer', start_date: '2024', end_date: '2025', description: 'ERP' }] as any[],
    systems: [] as any[],
    blocks: [
      { ...scopedBlock, employment_ids: [1] },
      { ...genericBlock, employment_ids: [1] },
    ] as any[],
    projects: [] as any[],
  });

  it('excludes the scoped block from another company CV', () => {
    const compiled = compileProfile(input('Acme Analytics, Inc.'));
    expect(compiled.blocks.map(b => b.id)).not.toContain(48);
    expect(compiled.employment[0].blocks.map(b => b.id)).not.toContain(48);
  });

  it('includes it for the target company', () => {
    const compiled = compileProfile(input('Northwind'));
    expect(compiled.blocks.map(b => b.id)).toContain(48);
  });
});
