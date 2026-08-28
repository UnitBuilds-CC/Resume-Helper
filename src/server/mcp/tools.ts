import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import db from '../db.js';

export function registerTools(server: McpServer) {
  // 1. list_systems
  server.tool('list_systems', 'List all systems from scratch pad 1', {}, async () => {
    const rows = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all();
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  // 2. list_blocks
  server.tool(
    'list_blocks',
    'List blocks from scratch pad 2, optionally filtered by skill or search term',
    { skill: z.string().optional().describe('Filter by skill name'), search: z.string().optional().describe('Search in title and content') },
    async ({ skill, search }) => {
      let query = `
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names
        FROM blocks b
        LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
      `;
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (skill) {
        conditions.push('b.id IN (SELECT bs2.block_id FROM block_skills bs2 JOIN skills s2 ON s2.id = bs2.skill_id WHERE s2.name = ?)');
        params.push(skill);
      }
      if (search) {
        conditions.push('(b.title LIKE ? OR b.content LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
      query += ' GROUP BY b.id ORDER BY b.updated_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      const blocks = rows.map(r => ({
        id: r.id, title: r.title, content: r.content,
        skills: r.skill_names ? r.skill_names.split(',') : [],
        created_at: r.created_at, updated_at: r.updated_at,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(blocks, null, 2) }] };
    }
  );

  // 3. get_template_cv
  server.tool('get_template_cv', 'Get the template CV with education and employment history', {}, async () => {
    const cv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get();
    const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
    const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all();
    return { content: [{ type: 'text', text: JSON.stringify({ ...cv, education, employment }, null, 2) }] };
  });

  // 4. list_job_postings
  server.tool(
    'list_job_postings',
    'List job postings, optionally filtered by status',
    { status: z.string().optional().describe('Filter by status: active, applied, rejected, withdrawn') },
    async ({ status }) => {
      let query = 'SELECT * FROM job_postings';
      const params: unknown[] = [];
      if (status) { query += ' WHERE status = ?'; params.push(status); }
      query += ' ORDER BY updated_at DESC';
      return { content: [{ type: 'text', text: JSON.stringify(db.prepare(query).all(...params), null, 2) }] };
    }
  );

  // 5. get_job_posting
  server.tool(
    'get_job_posting',
    'Get a full job posting by ID',
    { job_posting_id: z.number().describe('Job posting ID') },
    async ({ job_posting_id }) => {
      const row = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id);
      if (!row) return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(row, null, 2) }] };
    }
  );

  // 6. prepare_compilation
  server.tool(
    'prepare_compilation',
    'Bundle all context needed to compile a tailored CV: job posting + template CV + all systems + all blocks. Returns everything the AI needs in one call.',
    { job_posting_id: z.number().describe('Job posting ID to compile CV for') },
    async ({ job_posting_id }) => {
      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
      if (!job) return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };

      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get();
      const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
      const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all();
      const systems = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all();

      const blockRows = db.prepare(`
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names
        FROM blocks b LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
        GROUP BY b.id ORDER BY b.updated_at DESC
      `).all() as any[];
      const blocks = blockRows.map(r => ({
        id: r.id, title: r.title, content: r.content,
        skills: r.skill_names ? r.skill_names.split(',') : [],
      }));

      const bundle = {
        job_posting: job,
        template_cv: { ...templateCv, education, employment },
        systems,
        blocks,
      };
      return { content: [{ type: 'text', text: JSON.stringify(bundle, null, 2) }] };
    }
  );

  // 7. save_compiled_cv
  server.tool(
    'save_compiled_cv',
    'Save an AI-compiled tailored CV for a job posting. Auto-increments version if one already exists.',
    {
      job_posting_id: z.number().describe('Job posting ID'),
      content: z.string().describe('Compiled CV content in Markdown'),
    },
    async ({ job_posting_id, content }) => {
      const job = db.prepare('SELECT id FROM job_postings WHERE id = ?').get(job_posting_id);
      if (!job) return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };

      const existing = db.prepare(
        'SELECT MAX(version) as max_version FROM compiled_cvs WHERE job_posting_id = ?'
      ).get(job_posting_id) as any;
      const version = (existing?.max_version ?? 0) + 1;

      const result = db.prepare(
        'INSERT INTO compiled_cvs (job_posting_id, content, version) VALUES (?, ?, ?)'
      ).run(job_posting_id, content, version);

      const saved = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(result.lastInsertRowid);
      return { content: [{ type: 'text', text: JSON.stringify(saved, null, 2) }] };
    }
  );

  // 8. prepare_red_team
  server.tool(
    'prepare_red_team',
    'Bundle all context for red team evaluation: compiled CV + job posting + template CV + systems + blocks. Returns everything the AI needs to evaluate.',
    { compiled_cv_id: z.number().describe('Compiled CV ID to evaluate') },
    async ({ compiled_cv_id }) => {
      const compiledCv = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(compiled_cv_id) as any;
      if (!compiledCv) return { content: [{ type: 'text', text: 'Compiled CV not found' }], isError: true };

      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(compiledCv.job_posting_id);
      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get();
      const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
      const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all();
      const systems = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all();

      const blockRows = db.prepare(`
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names
        FROM blocks b LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
        GROUP BY b.id ORDER BY b.updated_at DESC
      `).all() as any[];
      const blocks = blockRows.map(r => ({
        id: r.id, title: r.title, content: r.content,
        skills: r.skill_names ? r.skill_names.split(',') : [],
      }));

      const bundle = {
        compiled_cv: compiledCv,
        job_posting: job,
        template_cv: { ...templateCv, education, employment },
        systems,
        blocks,
      };
      return { content: [{ type: 'text', text: JSON.stringify(bundle, null, 2) }] };
    }
  );

  // 9. save_red_team_result
  server.tool(
    'save_red_team_result',
    'Save red team evaluation results including scores, analysis, and gap-analysis questions.',
    {
      compiled_cv_id: z.number().describe('Compiled CV ID'),
      phase1_qualified: z.number().describe('1 if qualified, 0 if not'),
      phase2_score: z.number().describe('Score 0-100 for job suitability'),
      phase3_summary: z.string().describe('One paragraph: what makes this person special for this role'),
      overall_score: z.number().describe('Overall score 0-100'),
      full_analysis: z.string().describe('Full analysis text'),
      questions: z.array(z.object({
        question: z.string().describe('The question to ask the user'),
        context: z.string().optional().describe('Why this question is being asked'),
        skill_tag: z.string().optional().describe('Related skill if applicable'),
      })).optional().describe('Gap-analysis questions for the user'),
    },
    async ({ compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, questions }) => {
      const cv = db.prepare('SELECT id FROM compiled_cvs WHERE id = ?').get(compiled_cv_id);
      if (!cv) return { content: [{ type: 'text', text: 'Compiled CV not found' }], isError: true };

      const result = db.prepare(
        `INSERT INTO red_team_results (compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis);

      const resultId = Number(result.lastInsertRowid);

      if (questions?.length) {
        const insertQ = db.prepare(
          'INSERT INTO questions (red_team_result_id, question, context, skill_tag) VALUES (?, ?, ?, ?)'
        );
        for (const q of questions) {
          insertQ.run(resultId, q.question, q.context ?? null, q.skill_tag ?? null);
        }
      }

      const saved = db.prepare('SELECT * FROM red_team_results WHERE id = ?').get(resultId);
      const savedQuestions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(resultId);
      return { content: [{ type: 'text', text: JSON.stringify({ ...saved, questions: savedQuestions }, null, 2) }] };
    }
  );
}
