# User Guide: Connecting Your AI

Resume Helper works with any AI client that supports MCP (Model Context Protocol). This guide walks you through connecting it to your AI of choice and using the full CV tailoring workflow.

## What You Need

- Resume Helper running locally (`npm run dev` or the desktop app)
- An AI client that supports MCP (Claude Desktop, Qoder, Cursor, etc.)
- Your profile filled in (professional title, summary, contact info)
- Your scratch pads filled (Systems, Blocks, Template CV)
- At least one Job Posting added

---

## Step 1: Start the MCP Server

The MCP server is a separate process that your AI client connects to.

```bash
npm run mcp
```

This starts the server on stdio — it doesn't use a port. Your AI client launches it as a subprocess and communicates through stdin/stdout.

**Keep this running while you work with your AI.**

---

## Step 2: Configure Your AI Client

Each AI client has a different config file location. Add this configuration:

### Claude Desktop

**Config file:** `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "resume-helper": {
      "command": "npx",
      "args": ["tsx", "src/server/mcp/index.ts"],
      "cwd": "C:\\Users\\YOUR_NAME\\Documents\\Resume Helper"
    }
  }
}
```

Replace the `cwd` path with your actual project directory.

### Qoder

**Config file:** `.qoder/settings.json` in your project root

```json
{
  "mcpServers": {
    "resume-helper": {
      "command": "npx",
      "args": ["tsx", "src/server/mcp/index.ts"],
      "cwd": "C:\\Users\\YOUR_NAME\\Documents\\Resume Helper"
    }
  }
}
```

### Cursor

**Config file:** `.cursor/mcp.json` in your project root

```json
{
  "mcpServers": {
    "resume-helper": {
      "command": "npx",
      "args": ["tsx", "src/server/mcp/index.ts"],
      "cwd": "C:\\Users\\YOUR_NAME\\Documents\\Resume Helper"
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client follows the same pattern:
- **command:** `npx` (or the full path to `npx`/`node`)
- **args:** `["tsx", "src/server/mcp/index.ts"]`
- **cwd:** Your Resume Helper project directory

---

## Step 3: Verify the Connection

After configuring your AI client, restart it. You should see `resume-helper` appear in the list of available MCP servers.

**Test it:** Ask your AI:
> "List my systems from Resume Helper"

If it returns your data, you're connected.

---

## Step 4: The Complete Workflow

Here's the end-to-end workflow for finding jobs, tailoring your CV, and tracking applications.

### 4a. Set Up Your Profile

Before using the AI, fill in your Profile in the web UI:
- Professional title (e.g. "Senior Rust Engineer")
- Professional summary
- Contact info (email, phone, location, LinkedIn, GitHub)

This data is used by the AI when compiling CVs and generating cover letters.

### 4b. Check Your Job Match

Before compiling, see how well you fit a role:

The Job Match Scorecard (in the web UI) analyzes your fit across 6 dimensions:
1. **Technical Skills** — required languages, frameworks, tools
2. **Experience Relevance** — how your employment history maps to the role
3. **Role Alignment** — seniority, title, and responsibility level
4. **Keyword Coverage** — how many job posting keywords appear in your profile
5. **Industry & Domain** — sector overlap (fintech, healthtech, etc.)
6. **Location & Logistics** — remote/hybrid, timezone, clearance requirements

The scorecard identifies gaps you may be able to fill with new blocks.

### 4c. Compile a Tailored CV

Tell your AI:
> "Compile a CV for job posting #1 using my scratch pads. Use prepare_compilation to get all the context, then write a tailored CV in Markdown that highlights the most relevant experience for this role. Save it with save_compiled_cv."

The AI will:
1. Call `prepare_compilation(job_posting_id=1)` to get your job posting + profile + all scratch pad data
2. Analyze the job requirements against your experience
3. Write a tailored CV in Markdown, cherry-picking relevant blocks and skills
4. Call `save_compiled_cv(job_posting_id=1, content="...")` to save it

You'll see the compiled CV appear in the web UI under "Compiled CVs."

### 4d. Red Team the CV

Tell your AI:
> "Run a red team evaluation on compiled CV #1. Use prepare_red_team to get the context, then evaluate it through the 3-phase hiring funnel. Score it, identify gaps, and generate questions for anything I might be missing. Save with save_red_team_result."

The AI will:
1. Call `prepare_red_team(compiled_cv_id=1)` to get the compiled CV + all context
2. Evaluate Phase 1: Are you qualified? (degree, years, required skills)
3. Evaluate Phase 2: How well do you match? (0-100 score)
4. Evaluate Phase 3: What makes you exceptional? (one-paragraph summary)
5. Identify gaps between the job requirements and your scratch pads
6. Generate questions for each gap
7. Call `save_red_team_result(...)` with scores, analysis, and questions

You'll see the results in the web UI under "Red Team" and questions under "Questions."

### 4e. Generate a Cover Letter

Tell your AI:
> "Generate a cover letter for job posting #1. Use my profile and scratch pads to write a compelling letter that connects my experience to this role."

The AI will:
1. Pull your profile, blocks, and the job posting
2. Write a tailored cover letter
3. Call `save_cover_letter(job_posting_id=1, content="...")` to save it

You'll see it in the web UI under "Cover Letters."

### 4f. Handle Application Questions

Many job applications have specific questions ("Why do you want to work here?", "Describe a challenging project"). The AI can help:

> "Extract the application questions for job posting #1, then generate draft answers based on my scratch pads."

The AI will:
1. Call `extract_application_questions(job_posting_id=1)` to find questions in the posting
2. Call `generate_application_answers(job_posting_id=1, ...)` to draft answers from your experience

Review and edit answers in the Questionnaire page in the web UI.

### 4g. Iterate

Check your Questions page in the web UI. For each question:
- If you have the experience, answer it and consider adding a new Block to your scratch pad
- If you don't, dismiss it

Then re-compile and re-run the red team:
> "I've added new blocks to my scratch pads. Re-compile the CV for job #1 and run the red team again."

Repeat until your score hits 90+.

### 4h. Track Your Application

Update your application status as you progress:
> "Mark job posting #1 as Applied."

The pipeline stages are: **Found → Preparing → Ready → Applied → Interview → Offer**

Check your dashboard in the web UI for an overview of all applications.

### 4i. Export

Once you're happy:
- **Copy:** Click "Copy" on the compiled CV in the web UI to copy the Markdown to your clipboard
- **PDF:** Click "Download PDF" to get a polished, ATS-validated PDF with compatibility scoring and metadata embedding

---

## Available MCP Tools (26)

### Core Data
| Tool | What It Does |
|------|-------------|
| `list_systems` | List all systems from scratch pad 1 |
| `list_blocks` | List blocks from scratch pad 2 (filter by skill or search) |
| `get_template_cv` | Get your template CV with education and employment |
| `list_job_postings` | List job postings (filter by status) |
| `get_job_posting` | Get a full job posting by ID |

### CV Compilation
| Tool | What It Does |
|------|-------------|
| `prepare_compilation` | Bundle everything needed to compile a CV (one call) |
| `compile_cv_from_blocks` | Compile a CV from blocks with smart selection |

### Red Team Evaluation
| Tool | What It Does |
|------|-------------|
| `prepare_red_team` | Bundle everything needed for red team evaluation (one call) |
| `save_red_team_result` | Save scores, analysis, and gap-analysis questions |

### Application Workflow
| Tool | What It Does |
|------|-------------|
| `extract_application_questions` | Extract application-specific questions from a job posting |
| `generate_application_answers` | Generate draft answers for application questions |
| `get_application_answers` | Get saved answers for a job posting |
| `update_application_status` | Update application pipeline status |
| `get_application_dashboard` | Get overview of all application statuses |
| `complete_application_workflow` | Mark application workflow as complete |

### Job Search
| Tool | What It Does |
|------|-------------|
| `search_jobs` | Search for jobs from external sources |
| `import_job` | Import a job posting from search results |

### Git Integration
| Tool | What It Does |
|------|-------------|
| `list_git_repos` | List configured git repositories |
| `add_git_repo` | Add a git repository for version control |
| `sync_git_repo` | Sync changes to a git repository |
| `get_repo_changes` | Get uncommitted changes in a repo |
| `approve_git_changes` | Approve and commit staged changes |

### Cover Letters
| Tool | What It Does |
|------|-------------|
| `list_cover_letters` | List all generated cover letters |
| `get_cover_letter` | Get a specific cover letter |
| `generate_cover_letter` | Generate a cover letter for a job posting |
| `save_cover_letter` | Save a cover letter |

---

## Tips

- **Be specific in your prompts.** Instead of "compile a CV," say "compile a CV for job #1, emphasizing my ERP integration experience and SecOps background."
- **Use the web UI for data entry.** It's faster to add systems, blocks, and job postings through the web UI than through the AI.
- **The AI uses your words.** When compiling, the AI pulls from your blocks — it doesn't invent experience. The more detailed your blocks, the better the output.
- **Version control your CVs.** Each compilation creates a new version. You can compare versions in the web UI.
- **Red team is your reality check.** It simulates how a reviewer would see you. If the score is low, the questions will tell you exactly what's missing.
- **Check the match scorecard first.** Before spending time compiling, see if you're a good fit. The gap analysis tells you what's missing — you might be able to fill it with a new block.
- **Cover letters are one-click.** Once your scratch pads are filled, the AI can generate tailored cover letters that reference your actual experience.

---

## Troubleshooting

**"MCP server not found"**
- Make sure `npm run mcp` is running
- Check that the `cwd` path in your config points to the correct directory
- Restart your AI client after changing the config

**"Tools not showing up"**
- Your AI client may need a full restart (not just a new conversation)
- Check the AI client's logs for MCP connection errors

**"AI can't find my data"**
- Make sure you've added data through the web UI first
- Try `list_systems` or `list_blocks` to verify the AI can read your data

**"npx not found"**
- If your AI client can't find `npx`, use the full path to Node.js:
  ```json
  {
    "command": "C:\\Program Files\\nodejs\\npx.cmd",
    "args": ["tsx", "src/server/mcp/index.ts"],
    "cwd": "..."
  }
  ```
