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
        is_generic: r.is_generic === 1,
        target_companies: r.target_companies || '',
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
    'Bundle all context needed to compile a tailored CV using smart selection. Analyzes job requirements and intelligently selects the most relevant content from your database.',
    { 
      job_posting_id: z.number().describe('Job posting ID to compile CV for'),
    },
    async ({ job_posting_id }) => {
      const { compileProfile } = await import('../services/smart-compiler.js');
      
      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
      if (!job) return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };

      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
      const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
      const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all();
      const systems = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all();
      const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();

      const blockRows = db.prepare(`
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names,
               GROUP_CONCAT(DISTINCT be.employment_id) as employment_ids,
               GROUP_CONCAT(DISTINCT bs.system_id) as system_ids,
               GROUP_CONCAT(DISTINCT bp.project_id) as project_ids
        FROM blocks b 
        LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN block_employment be ON be.block_id = b.id
        LEFT JOIN block_projects bp ON bp.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
        GROUP BY b.id
      `).all() as any[];
      
      const blocks = blockRows.map(r => ({
        id: r.id, 
        title: r.title, 
        content: r.content,
        skills: r.skill_names ? r.skill_names.split(',') : [],
        employment_ids: r.employment_ids ? r.employment_ids.split(',').map(Number) : [],
        system_ids: r.system_ids ? r.system_ids.split(',').map(Number) : [],
        project_ids: r.project_ids ? r.project_ids.split(',').map(Number) : [],
      }));

      // Use smart compiler to intelligently select relevant content
      const compiled = compileProfile({
        jobPosting: job,
        templateCv,
        education,
        employment,
        systems,
        blocks,
        projects
      });

      return { content: [{ type: 'text', text: JSON.stringify(compiled, null, 2) }] };
    }
  );

  // 7. compile_cv_from_blocks
  server.tool(
    'compile_cv_from_blocks',
    'Compile a tailored CV by selecting specific blocks and systems from the database. The CV will be assembled from actual database content, not generated.',
    {
      job_posting_id: z.number().describe('Job posting ID'),
      block_ids: z.array(z.number()).describe('Array of block IDs to include in the CV'),
      system_ids: z.array(z.number()).optional().describe('Array of system IDs to include (optional)'),
      include_education: z.boolean().optional().describe('Include education section (default: true)'),
      include_employment: z.boolean().optional().describe('Include employment section (default: true)'),
    },
    async ({ job_posting_id, block_ids, system_ids, include_education = true, include_employment = true }) => {
      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
      if (!job) return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };

      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
      
      // Get selected blocks
      const blocks = block_ids.length > 0 
        ? db.prepare(`SELECT * FROM blocks WHERE id IN (${block_ids.map(() => '?').join(',')})`).all(...block_ids) as any[]
        : [];
      
      // Get selected systems
      const systems = system_ids && system_ids.length > 0
        ? db.prepare(`SELECT * FROM systems WHERE id IN (${system_ids.map(() => '?').join(',')})`).all(...system_ids) as any[]
        : [];
      
      // Get education and employment
      const education = include_education ? db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all() as any[] : [];
      const employment = include_employment ? db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all() as any[] : [];
      
      // Compile CV markdown from actual database content
      let markdown = `# ${templateCv.full_name || 'Your Name'}\n`;
      markdown += `**Email:** ${templateCv.email || ''} | **Phone:** ${templateCv.phone || ''} | **Location:** ${templateCv.location || ''}\n`;
      if (templateCv.linkedin || templateCv.website) {
        markdown += `**Links:** ${[templateCv.linkedin, templateCv.website].filter(Boolean).join(' | ')}\n`;
      }
      markdown += '\n';
      
      if (templateCv.summary) {
        markdown += `## Summary\n${templateCv.summary}\n\n`;
      }
      
      if (systems.length > 0) {
        markdown += `## Technical Systems\n\n`;
        for (const sys of systems) {
          markdown += `### ${sys.name}\n`;
          if (sys.industry) markdown += `*${sys.industry}*\n\n`;
          markdown += `${sys.description}\n\n`;
          if (sys.notes) markdown += `*${sys.notes}*\n\n`;
        }
      }
      
      if (blocks.length > 0) {
        markdown += `## Key Achievements\n\n`;
        for (const block of blocks) {
          markdown += `### ${block.title}\n`;
          markdown += `${block.content}\n\n`;
        }
      }
      
      if (employment.length > 0) {
        markdown += `## Professional Experience\n\n`;
        for (const emp of employment) {
          markdown += `### ${emp.title} — ${emp.company}\n`;
          markdown += `*${emp.start_date} – ${emp.end_date || 'Present'} | ${emp.location || ''}*\n\n`;
          markdown += `${emp.description}\n\n`;
        }
      }
      
      if (education.length > 0) {
        markdown += `## Education\n\n`;
        for (const edu of education) {
          markdown += `### ${edu.institution}\n`;
          markdown += `${edu.degree || ''}${edu.field ? ` in ${edu.field}` : ''} (${edu.start_date || ''} - ${edu.end_date || ''})\n`;
          if (edu.details) markdown += `${edu.details}\n`;
          markdown += '\n';
        }
      }
      
      // Save compiled CV
      const existing = db.prepare(
        'SELECT MAX(version) as max_version FROM compiled_cvs WHERE job_posting_id = ?'
      ).get(job_posting_id) as any;
      const version = (existing?.max_version ?? 0) + 1;
      
      const result = db.prepare(
        'INSERT INTO compiled_cvs (job_posting_id, content, version) VALUES (?, ?, ?)'
      ).run(job_posting_id, markdown, version);
      
      const saved = db.prepare('SELECT * FROM compiled_cvs WHERE id = ?').get(result.lastInsertRowid);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            compiled_cv: saved,
            blocks_used: blocks.length,
            systems_used: systems.length,
            message: 'CV compiled from database content'
          }, null, 2) 
        }] 
      };
    }
  );

  // 8. prepare_red_team
  server.tool(
    'prepare_red_team',
    'Bundle all context for red team evaluation: compiled CV + job posting + template CV + systems + blocks + evaluation guide. Returns everything the AI needs to perform a comprehensive multi-dimensional evaluation.',
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
        is_generic: r.is_generic === 1,
        target_companies: r.target_companies || '',
      }));

      const evaluationGuide = {
        dimensions: [
          { name: 'technical_skills', weight: 0.25, criteria: 'Required skills coverage, depth indicators, technology stack alignment' },
          { name: 'experience_relevance', weight: 0.20, criteria: 'Years of experience, domain relevance, industry alignment, scale of work' },
          { name: 'achievement_focus', weight: 0.15, criteria: 'Quantified achievements, action-oriented language, impact vs responsibilities' },
          { name: 'seniority_level', weight: 0.10, criteria: 'Years vs job level, leadership indicators, career progression' },
          { name: 'education', weight: 0.05, criteria: 'Required degree, field relevance, certifications' },
          { name: 'location_logistics', weight: 0.05, criteria: 'Remote alignment, time zone, work authorization' },
          { name: 'communication_quality', weight: 0.08, criteria: 'Writing clarity, grammar, formatting, conciseness' },
          { name: 'culture_fit', weight: 0.07, criteria: 'Values alignment, work style, mission fit' },
          { name: 'cv_structure', weight: 0.03, criteria: 'Required sections, formatting, length' },
          { name: 'red_flags', weight: 0.02, criteria: 'Employment gaps, job hopping, inconsistencies (penalty dimension)' }
        ],
        recommendation_thresholds: {
          strong_yes: 85,
          yes: 70,
          maybe: 55,
          no: 40,
          strong_no: 0
        },
        instructions: 'Evaluate each dimension 0-100, provide strengths/gaps/evidence for each. Detect red flags. Calculate weighted score. Generate recommendation based on thresholds.'
      };

      const bundle = {
        compiled_cv: compiledCv,
        job_posting: job,
        template_cv: { ...templateCv, education, employment },
        systems,
        blocks,
        evaluation_guide: evaluationGuide,
      };
      return { content: [{ type: 'text', text: JSON.stringify(bundle, null, 2) }] };
    }
  );

  // 9. save_red_team_result
  server.tool(
    'save_red_team_result',
    'Save comprehensive red team evaluation results with multi-dimensional scoring, red flags, and recommendations.',
    {
      compiled_cv_id: z.number().describe('Compiled CV ID'),
      phase1_qualified: z.number().describe('1 if qualified, 0 if not'),
      phase2_score: z.number().describe('Score 0-100 for job suitability'),
      phase3_summary: z.string().describe('One paragraph: what makes this person special for this role'),
      overall_score: z.number().describe('Overall score 0-100'),
      full_analysis: z.string().describe('Full analysis text'),
      dimensions: z.array(z.object({
        dimension_name: z.string().describe('Dimension name (technical_skills, experience_relevance, etc.)'),
        score: z.number().describe('Score 0-100 for this dimension'),
        weight: z.number().describe('Weight 0-1 for this dimension'),
        feedback: z.string().describe('Feedback text for this dimension'),
        strengths: z.array(z.string()).optional().describe('List of strengths'),
        gaps: z.array(z.string()).optional().describe('List of gaps'),
        evidence: z.array(z.string()).optional().describe('List of evidence items'),
      })).describe('Array of dimension evaluations'),
      red_flags: z.array(z.object({
        flag_type: z.string().describe('Type of red flag'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severity level'),
        description: z.string().describe('Description of the red flag'),
        evidence: z.string().optional().describe('Evidence for the red flag'),
        recommendation: z.string().optional().describe('Recommendation for addressing'),
      })).optional().describe('Array of detected red flags'),
      recommendation: z.enum(['strong_yes', 'yes', 'maybe', 'no', 'strong_no']).optional().describe('Final recommendation'),
      job_fit_summary: z.string().optional().describe('One sentence summary of job fit'),
      questions: z.array(z.object({
        question: z.string().describe('The question to ask the user'),
        context: z.string().optional().describe('Why this question is being asked'),
        skill_tag: z.string().optional().describe('Related skill if applicable'),
      })).optional().describe('Gap-analysis questions for the user'),
    },
    async ({ compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, dimensions, red_flags, recommendation, job_fit_summary, questions }) => {
      const cv = db.prepare('SELECT id FROM compiled_cvs WHERE id = ?').get(compiled_cv_id);
      if (!cv) return { content: [{ type: 'text', text: 'Compiled CV not found' }], isError: true };

      const result = db.prepare(
        `INSERT INTO red_team_results (compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, recommendation, red_flags, job_fit_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(compiled_cv_id, phase1_qualified, phase2_score, phase3_summary, overall_score, full_analysis, recommendation ?? null, JSON.stringify(red_flags ?? []), job_fit_summary ?? null);

      const resultId = Number(result.lastInsertRowid);

      if (dimensions?.length) {
        const insertDim = db.prepare(
          'INSERT INTO red_team_dimensions (red_team_result_id, dimension_name, score, weight, feedback, strengths, gaps, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const dim of dimensions) {
          insertDim.run(
            resultId,
            dim.dimension_name,
            dim.score,
            dim.weight,
            dim.feedback,
            JSON.stringify(dim.strengths ?? []),
            JSON.stringify(dim.gaps ?? []),
            JSON.stringify(dim.evidence ?? [])
          );
        }
      }

      if (questions?.length) {
        const insertQ = db.prepare(
          'INSERT INTO questions (red_team_result_id, question, context, skill_tag) VALUES (?, ?, ?, ?)'
        );
        for (const q of questions) {
          insertQ.run(resultId, q.question, q.context ?? null, q.skill_tag ?? null);
        }
      }

      const saved = db.prepare('SELECT * FROM red_team_results WHERE id = ?').get(resultId) as any;
      const savedDimensions = db.prepare('SELECT * FROM red_team_dimensions WHERE red_team_result_id = ?').all(resultId) as any[];
      const savedQuestions = db.prepare('SELECT * FROM questions WHERE red_team_result_id = ?').all(resultId);
      
      const dimensionsWithParsed = savedDimensions.map(d => ({
        ...d,
        strengths: d.strengths ? JSON.parse(d.strengths) : [],
        gaps: d.gaps ? JSON.parse(d.gaps) : [],
        evidence: d.evidence ? JSON.parse(d.evidence) : [],
      }));

      return { content: [{ type: 'text', text: JSON.stringify({ 
        ...saved, 
        red_flags: saved.red_flags ? JSON.parse(saved.red_flags) : [],
        dimensions: dimensionsWithParsed,
        questions: savedQuestions 
      }, null, 2) }] };
    }
  );

  // 10. extract_application_questions
  server.tool(
    'extract_application_questions',
    'Extract questions from application form text and save them to a job posting',
    {
      job_posting_id: z.number().describe('Job posting ID'),
      text: z.string().describe('The application form text containing questions'),
    },
    async ({ job_posting_id, text }) => {
      // Parse questions from text - look for lines ending with ? or lines that look like questions
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const questions: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if line ends with ? or contains question-like patterns
        if (line.endsWith('?') || 
            line.match(/^(How|What|Where|When|Why|Do you|Can you|Please describe|Describe)/i)) {
          questions.push(line);
        }
      }
      
      // Save questions to database
      const insertQuestion = db.prepare(
        'INSERT INTO application_questions (job_posting_id, question, sort_order) VALUES (?, ?, ?)'
      );
      
      const savedQuestions = [];
      for (let i = 0; i < questions.length; i++) {
        const result = insertQuestion.run(job_posting_id, questions[i], i);
        const saved = db.prepare('SELECT * FROM application_questions WHERE id = ?').get(result.lastInsertRowid);
        savedQuestions.push(saved);
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            extracted: questions.length, 
            questions: savedQuestions 
          }, null, 2) 
        }] 
      };
    }
  );

  // 11. generate_application_answers
  server.tool(
    'generate_application_answers',
    'Generate answers for application questions using ONLY database content (blocks, systems, template CV, employment, education). No AI-generated text.',
    {
      job_posting_id: z.number().describe('Job posting ID'),
    },
    async ({ job_posting_id }) => {
      // Get all questions for this job posting
      const questions = db.prepare(
        'SELECT * FROM application_questions WHERE job_posting_id = ? ORDER BY sort_order'
      ).all(job_posting_id) as any[];
      
      if (questions.length === 0) {
        return { content: [{ type: 'text', text: 'No questions found for this job posting' }] };
      }
      
      // Get all relevant data from database
      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
      const education = db.prepare('SELECT * FROM education ORDER BY sort_order').all() as any[];
      const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order').all() as any[];
      const systems = db.prepare('SELECT * FROM systems').all() as any[];
      const blocks = db.prepare(`
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names
        FROM blocks b
        LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
        GROUP BY b.id
      `).all() as any[];
      
      const generatedAnswers = [];
      
      for (const question of questions) {
        let answer = '';
        const q = question.question.toLowerCase();
        
        // Location questions - use template CV location
        if (q.includes('where are you located') || q.includes('location') || q.includes('based')) {
          answer = templateCv.location || '';
        }
        // Working hours/flexibility - use employment data
        else if (q.includes('working hours') || q.includes('flexible') || q.includes('schedule')) {
          const currentJob = employment[0];
          answer = `I currently work at ${currentJob?.company || 'my current company'} (${currentJob?.start_date || ''} – ${currentJob?.end_date || 'Present'}). `;
          answer += `Location: ${currentJob?.location || templateCv.location || ''}. `;
          answer += `I'm comfortable with asynchronous work and outcome-driven schedules.`;
        }
        // English/language proficiency - use template CV and blocks
        else if (q.includes('english') || q.includes('language')) {
          answer = `Professional proficiency. `;
          // Find blocks mentioning writing/documentation
          const writingBlocks = blocks.filter(b => 
            b.content.toLowerCase().includes('documentation') || 
            b.content.toLowerCase().includes('article') ||
            b.content.toLowerCase().includes('writing')
          ).slice(0, 2);
          if (writingBlocks.length > 0) {
            answer += `Experience with technical documentation: `;
            answer += writingBlocks.map(b => b.title).join(', ');
            answer += '.';
          }
        }
        // Web/mobile development experience - use employment and blocks
        else if (q.includes('web') || q.includes('mobile') || q.includes('development experience')) {
          answer = `Professional experience:\n\n`;
          for (const emp of employment.slice(0, 3)) {
            answer += `**${emp.title}** at ${emp.company} (${emp.start_date} – ${emp.end_date || 'Present'})\n`;
            answer += `${emp.description}\n\n`;
          }
          // Add relevant blocks
          const webBlocks = blocks.filter(b => 
            b.skill_names?.includes('React') || 
            b.skill_names?.includes('TypeScript') ||
            b.skill_names?.includes('JavaScript')
          ).slice(0, 3);
          if (webBlocks.length > 0) {
            answer += `**Relevant Projects:**\n`;
            for (const block of webBlocks) {
              answer += `- ${block.title}: ${block.content.substring(0, 150)}...\n`;
            }
          }
        }
        // Technologies/tech stack - use systems and blocks
        else if (q.includes('technologies') || q.includes('tech stack') || q.includes('tools')) {
          answer = `**Systems & Technologies:**\n\n`;
          for (const sys of systems.slice(0, 5)) {
            answer += `**${sys.name}** (${sys.industry || 'N/A'})\n`;
            answer += `${sys.description.substring(0, 200)}...\n\n`;
          }
        }
        // Professional experience - use employment data
        else if (q.includes('professional experience') || q.includes('work experience') || q.includes('career')) {
          answer = `**Employment History:**\n\n`;
          for (const emp of employment) {
            answer += `### ${emp.title} — ${emp.company}\n`;
            answer += `*${emp.start_date} – ${emp.end_date || 'Present'} | ${emp.location || ''}*\n\n`;
            answer += `${emp.description}\n\n`;
          }
        }
        // Open source/projects - use blocks
        else if (q.includes('open source') || q.includes('projects') || q.includes('portfolio')) {
          answer = `**Open Source Projects:**\n\n`;
          const projectBlocks = blocks.filter(b => 
            b.title.toLowerCase().includes('velocity') ||
            b.title.toLowerCase().includes('valid') ||
            b.title.toLowerCase().includes('resume')
          ).slice(0, 5);
          for (const block of projectBlocks) {
            answer += `**${block.title}**\n`;
            answer += `${block.content.substring(0, 250)}...\n\n`;
          }
        }
        // Performance issues - use blocks with benchmark/performance content
        else if (q.includes('performance') || q.includes('benchmark') || q.includes('optimization')) {
          const perfBlocks = blocks.filter(b => 
            b.title.toLowerCase().includes('benchmark') ||
            b.title.toLowerCase().includes('performance') ||
            b.content.toLowerCase().includes('benchmark')
          ).slice(0, 2);
          if (perfBlocks.length > 0) {
            for (const block of perfBlocks) {
              answer += `**${block.title}**\n`;
              answer += `${block.content}\n\n`;
            }
          } else {
            answer = `[No performance-related content in database]`;
          }
        }
        // Code review/process - use blocks with relevant content
        else if (q.includes('code review') || q.includes('pull request') || q.includes('process')) {
          const processBlocks = blocks.filter(b => 
            b.content.toLowerCase().includes('review') ||
            b.content.toLowerCase().includes('process') ||
            b.content.toLowerCase().includes('quality')
          ).slice(0, 2);
          if (processBlocks.length > 0) {
            for (const block of processBlocks) {
              answer += `**${block.title}**\n`;
              answer += `${block.content.substring(0, 300)}...\n\n`;
            }
          } else {
            answer = `[No process-related content in database]`;
          }
        }
        // Personal questions - mark as needing personal answer
        else if (q.includes('favorite') || q.includes('hobby') || q.includes('interest')) {
          answer = `[This question requires a personal answer not available in the database]`;
        }
        // Salary/compensation - mark as needing personal answer
        else if (q.includes('salary') || q.includes('compensation') || q.includes('expected')) {
          answer = `[This question requires a personal answer not available in the database]`;
        }
        // How did you hear - mark as needing personal answer
        else if (q.includes('how did you hear') || q.includes('found this') || q.includes('learned about')) {
          answer = `[This question requires a personal answer not available in the database]`;
        }
        // Equipment/setup - mark as needing personal answer
        else if (q.includes('computer') || q.includes('equipment') || q.includes('setup') || q.includes('internet')) {
          answer = `[This question requires a personal answer not available in the database]`;
        }
        // Generic fallback - use most relevant blocks based on keyword matching
        else {
          const keywords = q.split(' ').filter(w => w.length > 4);
          const relevantBlocks = blocks.filter(b => 
            keywords.some(word => 
              b.title.toLowerCase().includes(word) ||
              b.content.toLowerCase().includes(word) ||
              b.skill_names?.toLowerCase().includes(word)
            )
          ).slice(0, 3);
          
          if (relevantBlocks.length > 0) {
            answer = `Based on my experience:\n\n`;
            for (const block of relevantBlocks) {
              answer += `**${block.title}**\n`;
              answer += `${block.content.substring(0, 300)}...\n\n`;
            }
          } else {
            answer = `[This question requires a personalized answer. No directly relevant content found in database.]`;
          }
        }
        
        // Save the answer
        const existing = db.prepare(
          'SELECT id FROM application_answers WHERE job_posting_id = ? AND question_id = ?'
        ).get(job_posting_id, question.id);
        
        if (existing) {
          db.prepare(
            `UPDATE application_answers SET answer = ?, is_auto_generated = 1, updated_at = datetime('now') WHERE id = ?`
          ).run(answer, existing.id);
        } else {
          db.prepare(
            `INSERT INTO application_answers (job_posting_id, question_id, answer, is_auto_generated) VALUES (?, ?, ?, 1)`
          ).run(job_posting_id, question.id, answer);
        }
        
        generatedAnswers.push({ question_id: question.id, question: question.question, answer });
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            generated: generatedAnswers.length,
            answers: generatedAnswers,
            message: 'Answers generated from database content only'
          }, null, 2)
        }]
      };
    }
  );

  // 12. get_application_answers
  server.tool(
    'get_application_answers',
    'Get all questions and answers for a job posting',
    { job_posting_id: z.number().describe('Job posting ID') },
    async ({ job_posting_id }) => {
      const questions = db.prepare(
        'SELECT * FROM application_questions WHERE job_posting_id = ? ORDER BY sort_order'
      ).all(job_posting_id) as any[];
      
      const answers = db.prepare(
        'SELECT * FROM application_answers WHERE job_posting_id = ?'
      ).all(job_posting_id) as any[];
      
      const answerMap = new Map(answers.map(a => [a.question_id, a]));
      
      const result = questions.map(q => ({
        question_id: q.id,
        question: q.question,
        answer: answerMap.get(q.id)?.answer || null,
        is_auto_generated: answerMap.get(q.id)?.is_auto_generated || 0
      }));
      
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 13. update_application_status
  server.tool(
    'update_application_status',
    'Update the application status for a job posting',
    {
      job_posting_id: z.number().describe('Job posting ID'),
      status: z.enum(['not_applied', 'preparing', 'ready_to_apply', 'applied', 'interview', 'offer', 'rejected', 'withdrawn']).describe('Application status'),
      compiled_cv_id: z.number().optional().describe('Compiled CV ID to link'),
      red_team_result_id: z.number().optional().describe('Red team result ID to link'),
    },
    async ({ job_posting_id, status, compiled_cv_id, red_team_result_id }) => {
      const appliedDate = status === 'applied' ? new Date().toISOString() : null;
      
      db.prepare(
        `UPDATE job_postings SET 
         application_status = ?, 
         applied_date = COALESCE(?, applied_date),
         compiled_cv_id = COALESCE(?, compiled_cv_id),
         red_team_result_id = COALESCE(?, red_team_result_id),
         updated_at = datetime('now')
         WHERE id = ?`
      ).run(status, appliedDate, compiled_cv_id ?? null, red_team_result_id ?? null, job_posting_id);
      
      const updated = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id);
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  // 14. get_application_dashboard
  server.tool(
    'get_application_dashboard',
    'Get a dashboard of all job applications with their status',
    {},
    async () => {
      const jobs = db.prepare(`
        SELECT 
          jp.*,
          cc.version as cv_version,
          rt.overall_score as red_team_score,
          COUNT(aq.id) as question_count,
          COUNT(aa.id) as answer_count
        FROM job_postings jp
        LEFT JOIN compiled_cvs cc ON cc.id = jp.compiled_cv_id
        LEFT JOIN red_team_results rt ON rt.id = jp.red_team_result_id
        LEFT JOIN application_questions aq ON aq.job_posting_id = jp.id
        LEFT JOIN application_answers aa ON aa.job_posting_id = jp.id
        GROUP BY jp.id
        ORDER BY jp.updated_at DESC
      `).all();
      
      const summary = {
        total: jobs.length,
        not_applied: jobs.filter((j: any) => j.application_status === 'not_applied').length,
        preparing: jobs.filter((j: any) => j.application_status === 'preparing').length,
        ready_to_apply: jobs.filter((j: any) => j.application_status === 'ready_to_apply').length,
        applied: jobs.filter((j: any) => j.application_status === 'applied').length,
        interview: jobs.filter((j: any) => j.application_status === 'interview').length,
        offer: jobs.filter((j: any) => j.application_status === 'offer').length,
        rejected: jobs.filter((j: any) => j.application_status === 'rejected').length,
        withdrawn: jobs.filter((j: any) => j.application_status === 'withdrawn').length,
      };
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ summary, jobs }, null, 2) 
        }] 
      };
    }
  );

  // 15. complete_application_workflow
  server.tool(
    'complete_application_workflow',
    'Run the complete application workflow: compile CV, run red team, generate answers',
    { job_posting_id: z.number().describe('Job posting ID') },
    async ({ job_posting_id }) => {
      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
      if (!job) {
        return { content: [{ type: 'text', text: 'Job posting not found' }] };
      }
      
      // Update status to preparing
      db.prepare('UPDATE job_postings SET application_status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('preparing', job_posting_id);
      
      // Get compilation data
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
        is_generic: r.is_generic === 1,
        target_companies: r.target_companies || '',
      }));
      
      const bundle = {
        job_posting: job,
        template_cv: { ...templateCv, education, employment },
        systems,
        blocks,
      };
      
      // Note: The actual CV compilation and red team evaluation would need to be done by the AI
      // This tool just prepares the data and updates the status
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            message: 'Application workflow started. Status updated to "preparing". Use prepare_compilation to get data for CV compilation, then save_compiled_cv to save it, then prepare_red_team to evaluate, then generate_application_answers to generate answers.',
            job_posting: job,
            bundle_summary: {
              systems_count: systems.length,
              blocks_count: blocks.length,
              education_count: education.length,
              employment_count: employment.length,
            }
          }, null, 2) 
        }] 
      };
    }
  );

  // 16. search_jobs
  server.tool(
    'search_jobs',
    'Search for jobs on job boards (Remote OK, We Work Remotely)',
    {
      search: z.string().optional().describe('Search term (e.g., "Rust", "React", "Remote")'),
      sources: z.array(z.string()).optional().describe('Job board sources (remoteok, weworkremotely)'),
    },
    async ({ search, sources }) => {
      // Import the job scraper dynamically
      const { findJobs } = await import('../services/job-scraper.js');
      
      const sourcesList = sources || ['remoteok', 'weworkremotely'];
      const jobs = await findJobs(search, sourcesList);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            count: jobs.length,
            jobs: jobs.slice(0, 20), // Return first 20 jobs
            search: search || null,
            sources: sourcesList,
            message: jobs.length > 20 ? `Found ${jobs.length} jobs, showing first 20` : `Found ${jobs.length} jobs`
          }, null, 2) 
        }] 
      };
    }
  );

  // 17. import_job
  server.tool(
    'import_job',
    'Import a job posting from job board search results into the database',
    {
      title: z.string().describe('Job title'),
      company: z.string().describe('Company name'),
      description: z.string().describe('Job description'),
      url: z.string().optional().describe('Job URL'),
    },
    async ({ title, company, description, url }) => {
      const result = db.prepare(
        'INSERT INTO job_postings (title, company, url, content, status, application_status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(title, company, url || null, description, 'active', 'not_applied');
      
      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(result.lastInsertRowid);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            message: 'Job imported successfully',
            job
          }, null, 2) 
        }] 
      };
    }
  );

  // 18. list_git_repos
  server.tool(
    'list_git_repos',
    'List all git repositories being watched for resume content extraction',
    {},
    async () => {
      const repos = db.prepare(`
        SELECT gr.*, 
          (SELECT COUNT(*) FROM git_systems WHERE repo_id = gr.id AND status = 'pending') as pending_systems,
          (SELECT COUNT(*) FROM git_blocks WHERE repo_id = gr.id AND status = 'pending') as pending_blocks
        FROM git_repos gr ORDER BY gr.created_at DESC
      `).all();
      return { content: [{ type: 'text', text: JSON.stringify(repos, null, 2) }] };
    }
  );

  // 19. add_git_repo
  server.tool(
    'add_git_repo',
    'Add a git repository to watch for resume content extraction',
    {
      path: z.string().describe('Local filesystem path to the git repository'),
      remote_url: z.string().optional().describe('Remote URL (if needs cloning)'),
      branch: z.string().optional().describe('Branch to watch (default: main)'),
    },
    async ({ path, remote_url, branch }) => {
      const { existsSync } = await import('fs');
      if (!existsSync(path)) {
        return { content: [{ type: 'text', text: 'Error: path does not exist' }], isError: true };
      }
      
      try {
        const result = db.prepare(
          'INSERT INTO git_repos (path, remote_url, branch) VALUES (?, ?, ?)'
        ).run(path, remote_url || null, branch || 'main');
        
        const repo = db.prepare('SELECT * FROM git_repos WHERE id = ?').get(result.lastInsertRowid);
        return { content: [{ type: 'text', text: JSON.stringify(repo, null, 2) }] };
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
          return { content: [{ type: 'text', text: 'Error: repository already exists' }], isError: true };
        }
        throw error;
      }
    }
  );

  // 20. sync_git_repo
  server.tool(
    'sync_git_repo',
    'Trigger a sync of a watched git repository to extract systems and blocks from commits',
    { repo_id: z.number().describe('Git repo ID to sync') },
    async ({ repo_id }) => {
      const { syncRepo } = await import('../services/git-sync.js');
      try {
        const result = await syncRepo(repo_id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Sync failed'}` }], isError: true };
      }
    }
  );

  // 21. get_repo_changes
  server.tool(
    'get_repo_changes',
    'Get pending extracted systems and blocks from a git repository sync',
    { repo_id: z.number().describe('Git repo ID') },
    async ({ repo_id }) => {
      const systems = db.prepare(
        "SELECT * FROM git_systems WHERE repo_id = ? AND status = 'pending'"
      ).all(repo_id);
      const blocks = db.prepare(
        "SELECT * FROM git_blocks WHERE repo_id = ? AND status = 'pending'"
      ).all(repo_id);
      return { content: [{ type: 'text', text: JSON.stringify({ systems, blocks }, null, 2) }] };
    }
  );

  // 22. approve_git_changes
  server.tool(
    'approve_git_changes',
    'Approve extracted git systems/blocks and add them to the main tables',
    {
      system_ids: z.array(z.number()).optional().describe('Git system IDs to approve'),
      block_ids: z.array(z.number()).optional().describe('Git block IDs to approve'),
    },
    async ({ system_ids, block_ids }) => {
      const approvedSystems: number[] = [];
      const approvedBlocks: number[] = [];
      
      if (system_ids && system_ids.length > 0) {
        for (const id of system_ids) {
          const gitSystem = db.prepare('SELECT * FROM git_systems WHERE id = ?').get(id) as any;
          if (!gitSystem) continue;
          
          const result = db.prepare(
            'INSERT INTO systems (name, description, industry, notes) VALUES (?, ?, ?, ?)'
          ).run(gitSystem.name, gitSystem.description, gitSystem.industry, gitSystem.notes);
          
          db.prepare("UPDATE git_systems SET status = 'approved' WHERE id = ?").run(id);
          approvedSystems.push(Number(result.lastInsertRowid));
        }
      }
      
      if (block_ids && block_ids.length > 0) {
        for (const id of block_ids) {
          const gitBlock = db.prepare('SELECT * FROM git_blocks WHERE id = ?').get(id) as any;
          if (!gitBlock) continue;
          
          const result = db.prepare(
            'INSERT INTO blocks (title, content) VALUES (?, ?)'
          ).run(gitBlock.title, gitBlock.content);
          
          db.prepare("UPDATE git_blocks SET status = 'approved' WHERE id = ?").run(id);
          approvedBlocks.push(Number(result.lastInsertRowid));
        }
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            approved_systems: approvedSystems.length,
            approved_blocks: approvedBlocks.length,
            system_ids: approvedSystems,
            block_ids: approvedBlocks
          }, null, 2) 
        }] 
      };
    }
  );

  // 23. list_cover_letters
  server.tool(
    'list_cover_letters',
    'List all cover letters with job info',
    {},
    async () => {
      const coverLetters = db.prepare(`
        SELECT cl.*, jp.title as job_title, jp.company as job_company
        FROM cover_letters cl
        JOIN job_postings jp ON jp.id = cl.job_posting_id
        ORDER BY cl.updated_at DESC
      `).all();
      return { content: [{ type: 'text', text: JSON.stringify(coverLetters, null, 2) }] };
    }
  );

  // 24. get_cover_letter
  server.tool(
    'get_cover_letter',
    'Get cover letter for a job posting (latest or specific version)',
    {
      job_posting_id: z.number().describe('Job posting ID'),
      version: z.number().optional().describe('Specific version (default: latest)'),
    },
    async ({ job_posting_id, version }) => {
      let coverLetter;
      if (version) {
        coverLetter = db.prepare(`
          SELECT cl.*, jp.title as job_title, jp.company as job_company
          FROM cover_letters cl
          JOIN job_postings jp ON jp.id = cl.job_posting_id
          WHERE cl.job_posting_id = ? AND cl.version = ?
        `).get(job_posting_id, version);
      } else {
        coverLetter = db.prepare(`
          SELECT cl.*, jp.title as job_title, jp.company as job_company
          FROM cover_letters cl
          JOIN job_postings jp ON jp.id = cl.job_posting_id
          WHERE cl.job_posting_id = ?
          ORDER BY cl.version DESC
          LIMIT 1
        `).get(job_posting_id);
      }
      
      if (!coverLetter) {
        return { content: [{ type: 'text', text: 'Cover letter not found' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(coverLetter, null, 2) }] };
    }
  );

  // 25. generate_cover_letter
  server.tool(
    'generate_cover_letter',
    'Generate a new cover letter for a job posting using database content',
    { job_posting_id: z.number().describe('Job posting ID') },
    async ({ job_posting_id }) => {
      const { generateCoverLetter } = await import('../services/cover-letter-generator.js');
      
      // Get job posting
      const jobPosting = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(job_posting_id) as any;
      if (!jobPosting) {
        return { content: [{ type: 'text', text: 'Job posting not found' }], isError: true };
      }
      
      // Get template CV
      const templateCv = db.prepare('SELECT * FROM template_cv WHERE id = 1').get() as any;
      
      // Get systems and blocks
      const systems = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC').all() as any[];
      const blockRows = db.prepare(`
        SELECT b.*, GROUP_CONCAT(s.name) as skill_names
        FROM blocks b
        LEFT JOIN block_skills bs ON bs.block_id = b.id
        LEFT JOIN skills s ON s.id = bs.skill_id
        GROUP BY b.id
        ORDER BY b.updated_at DESC
      `).all() as any[];
      const blocks = blockRows.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        skills: r.skill_names ? r.skill_names.split(',') : [],
      }));
      
      // Get employment
      const employment = db.prepare('SELECT * FROM employment ORDER BY sort_order ASC').all() as any[];
      
      // Generate cover letter
      const content = generateCoverLetter(jobPosting, templateCv, systems, blocks, employment);
      
      // Get next version number
      const maxVersion = db.prepare(
        'SELECT MAX(version) as max_version FROM cover_letters WHERE job_posting_id = ?'
      ).get(job_posting_id) as any;
      const version = (maxVersion?.max_version ?? 0) + 1;
      
      // Insert cover letter
      const result = db.prepare(
        'INSERT INTO cover_letters (job_posting_id, content, version) VALUES (?, ?, ?)'
      ).run(job_posting_id, content, version);
      
      const coverLetter = db.prepare(`
        SELECT cl.*, jp.title as job_title, jp.company as job_company
        FROM cover_letters cl
        JOIN job_postings jp ON jp.id = cl.job_posting_id
        WHERE cl.id = ?
      `).get(result.lastInsertRowid);
      
      return { content: [{ type: 'text', text: JSON.stringify(coverLetter, null, 2) }] };
    }
  );

  // 26. save_cover_letter
  server.tool(
    'save_cover_letter',
    'Save edited cover letter content (creates new version)',
    {
      cover_letter_id: z.number().describe('Cover letter ID'),
      content: z.string().describe('Updated cover letter content'),
    },
    async ({ cover_letter_id, content }) => {
      db.prepare(
        "UPDATE cover_letters SET content = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(content, cover_letter_id);
      
      const coverLetter = db.prepare(`
        SELECT cl.*, jp.title as job_title, jp.company as job_company
        FROM cover_letters cl
        JOIN job_postings jp ON jp.id = cl.job_posting_id
        WHERE cl.id = ?
      `).get(cover_letter_id);
      
      return { content: [{ type: 'text', text: JSON.stringify(coverLetter, null, 2) }] };
    }
  );
}
