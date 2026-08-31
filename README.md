# Resume Helper

A desktop CV tailoring tool that helps you build job-specific resumes from a master file of your career. Built around the philosophy that your resume should be uniquely *you*, not a generic list of qualifications.

## Download

**[Download Resume Helper v1.1.0 (Windows)](https://github.com/UnitBuilds-CC/Resume-Helper/releases/download/v1.1.0/Resume.Helper_1.1.0_x64-setup.exe)**

77MB standalone installer. Includes everything — no Node.js or terminal required. Just install and run.

## How It Works

1. **Set up your profile** — Add your professional title, summary, and contact info on the Profile page
2. **Fill your scratch pads** — Systems you've worked on (Pad 1) and detailed blocks of what you did, why, and how (Pad 2), tagged with skills
3. **Set up your template CV** — Education and employment history (the skeleton)
4. **Find and add job postings** — Search for jobs or paste/upload descriptions you want to apply to
5. **Check your match** — The Job Match Scorecard analyzes how well you fit across 6 dimensions (tech skills, experience, role alignment, keywords, industry, location) and suggests gaps you may be able to fill
6. **Compile via AI** — An AI client (connected via MCP) bundles your data with the job posting and compiles a tailored CV using your own words
7. **Red team it** — The AI evaluates your compiled CV against the 3-phase hiring funnel and scores it across 10 dimensions
8. **Generate a cover letter** — AI-generated cover letters tailored to each job, pulling from your profile and blocks
9. **Track applications** — Move postings through your pipeline: Found → Preparing → Ready → Applied → Interview → Offer
10. **Iterate** — Answer gap-analysis questions, add new blocks, re-compile until your score hits 90+
11. **Export PDF** — ATS-validated download with compatibility scoring and PDF metadata embedding

## Desktop App vs Development

### Desktop App (Recommended)

Download the installer from [Releases](https://github.com/UnitBuilds-CC/Resume-Helper/releases). It bundles:
- Tauri runtime (native window, no Chromium)
- Node.js v22 (runs the API server)
- Express API + SQLite database
- React frontend

Data is stored in your AppData directory. The API server starts silently when you launch the app.

### Development Setup

**Prerequisites:** Node.js 18+, Rust (for Tauri builds)

```bash
git clone https://github.com/UnitBuilds-CC/Resume-Helper.git
cd Resume-Helper
npm install
```

**Run in development:**
```bash
npm run dev          # Web UI only (Express + Vite)
npm run mcp          # MCP server (for AI clients)
```

**Build desktop app:**
```bash
npm run tauri:build  # Produces NSIS installer in src-tauri/target/release/bundle/
```

## MCP Configuration

Resume Helper exposes 26 MCP tools that let any AI client (Claude Desktop, Qoder, Cursor, etc.) interact with your data.

> **Full walkthrough:** See [USER-GUIDE.md](./USER-GUIDE.md) for step-by-step instructions on connecting your AI client, plus the complete CV tailoring workflow with example prompts.

### Quick Setup

Add this to your AI client's MCP configuration:

```json
{
  "mcpServers": {
    "resume-helper": {
      "command": "npx",
      "args": ["tsx", "src/server/mcp/index.ts"],
      "cwd": "/path/to/resume-helper"
    }
  }
}
```

Config file locations:
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- **Qoder:** `.qoder/settings.json` in your project root
- **Cursor:** `.cursor/mcp.json` in your project root

### Available MCP Tools

**Core Data**
| Tool | Description |
|------|-------------|
| `list_systems` | List all systems from scratch pad 1 |
| `list_blocks` | List blocks from scratch pad 2 (filterable by skill/search) |
| `get_template_cv` | Get template CV with education and employment |
| `list_job_postings` | List job postings (filterable by status) |
| `get_job_posting` | Get a full job posting by ID |

**CV Compilation**
| Tool | Description |
|------|-------------|
| `prepare_compilation` | Bundle all context for compiling a tailored CV (one call) |
| `compile_cv_from_blocks` | Compile a CV from blocks with smart selection |

**Red Team Evaluation**
| Tool | Description |
|------|-------------|
| `prepare_red_team` | Bundle all context for red team evaluation (one call) |
| `save_red_team_result` | Save evaluation scores + gap-analysis questions |

**Application Workflow**
| Tool | Description |
|------|-------------|
| `extract_application_questions` | Extract application-specific questions from a job posting |
| `generate_application_answers` | Generate draft answers for application questions |
| `get_application_answers` | Get saved answers for a job posting |
| `update_application_status` | Update application pipeline status |
| `get_application_dashboard` | Get overview of all application statuses |
| `complete_application_workflow` | Mark application workflow as complete |

**Job Search**
| Tool | Description |
|------|-------------|
| `search_jobs` | Search for jobs from external sources |
| `import_job` | Import a job posting from search results |

**Git Integration**
| Tool | Description |
|------|-------------|
| `list_git_repos` | List configured git repositories |
| `add_git_repo` | Add a git repository for version control |
| `sync_git_repo` | Sync changes to a git repository |
| `get_repo_changes` | Get uncommitted changes in a repo |
| `approve_git_changes` | Approve and commit staged changes |

**Cover Letters**
| Tool | Description |
|------|-------------|
| `list_cover_letters` | List all generated cover letters |
| `get_cover_letter` | Get a specific cover letter |
| `generate_cover_letter` | Generate a cover letter for a job posting |
| `save_cover_letter` | Save a cover letter |

### AI Workflow

```
1. AI calls prepare_compilation(job_posting_id=1)
   → receives: job posting + template CV + profile + all systems + all blocks

2. AI compiles a tailored CV in Markdown

3. AI calls save_compiled_cv(job_posting_id=1, content="# My CV...")
   → saved as version 1

4. AI calls prepare_red_team(compiled_cv_id=1)
   → receives: compiled CV + all context for evaluation

5. AI evaluates and calls save_red_team_result(...)
   → saves scores, analysis, and questions

6. AI generates a cover letter via generate_cover_letter(job_posting_id=1)

7. User reviews questions in the web UI, adds new blocks, re-compiles

8. User tracks application status: Found → Preparing → Ready → Applied → Interview → Offer
```

## Project Structure

```
src/
├── server/
│   ├── index.ts                    # Express API server
│   ├── db.ts                       # SQLite schema and connection
│   ├── routes/
│   │   ├── systems.ts              # Scratch pad 1 CRUD
│   │   ├── blocks.ts               # Scratch pad 2 CRUD
│   │   ├── skills.ts               # Skill tags
│   │   ├── template-cv.ts          # Template CV + profile
│   │   ├── job-postings.ts         # Job postings + application status
│   │   ├── compiled-cvs.ts         # Compiled CV versions
│   │   ├── questions.ts            # Gap-analysis questions
│   │   ├── questionnaires.ts       # Application questionnaires
│   │   ├── red-team.ts             # Red team evaluation results
│   │   ├── job-match.ts            # Job match scorecard
│   │   ├── job-search.ts           # External job search
│   │   ├── cover-letters.ts        # Cover letter CRUD
│   │   ├── git.ts                  # Git repo integration
│   │   ├── import.ts               # File import (PDF/DOCX/TXT)
│   │   └── projects.ts             # Project management
│   ├── services/
│   │   ├── file-reader.ts          # PDF/DOCX/TXT/MD text extraction
│   │   ├── pdf-generator.ts        # Markdown → HTML → Puppeteer PDF
│   │   ├── ats-validator.ts        # ATS compatibility scoring + PDF metadata
│   │   ├── smart-compiler.ts       # Block selection and CV compilation
│   │   ├── red-team-evaluator.ts   # 3-phase hiring funnel evaluation
│   │   ├── job-match-analyzer.ts   # 6-dimension match scoring
│   │   ├── cover-letter-generator.ts # AI cover letter generation
│   │   ├── git-sync.ts             # Git repo sync and commit management
│   │   └── job-scraper.ts          # External job search scraping
│   └── mcp/
│       ├── index.ts                # MCP server entry (stdio transport)
│       └── tools.ts                # 26 MCP tool definitions
├── client/
│   ├── App.tsx                     # React router
│   ├── pages/
│   │   ├── Dashboard.tsx           # Overview and stats
│   │   ├── ProfilePage.tsx         # Professional profile + contact info
│   │   ├── SystemsPage.tsx         # Scratch pad 1
│   │   ├── BlocksPage.tsx          # Scratch pad 2
│   │   ├── TemplateCVPage.tsx      # Education + employment history
│   │   ├── JobPostingsPage.tsx     # Job postings + application pipeline
│   │   ├── JobSearchPage.tsx       # Search and import jobs
│   │   ├── JobMatchPage.tsx        # Match scorecard
│   │   ├── CompiledCVsPage.tsx     # Compiled CV versions
│   │   ├── RedTeamPage.tsx         # Red team evaluation results
│   │   ├── QuestionsPage.tsx       # Gap-analysis questions
│   │   ├── QuestionnairePage.tsx   # Application questionnaires
│   │   ├── CoverLettersPage.tsx    # Generated cover letters
│   │   └── GitIntegrationPage.tsx  # Git repo management
│   ├── components/                 # Layout, TagInput, FileUpload, Toast, ScoreGauge, etc.
│   └── hooks/                      # api() helper, useApi hook
└── shared/
    └── types.ts                    # TypeScript interfaces
src-tauri/
├── src/main.rs                     # Tauri entry point (auto-starts API server)
├── tauri.conf.json                 # Tauri configuration
├── Cargo.toml                      # Rust dependencies
└── resources/                      # Bundled Node.js + server for desktop app
templates/
└── cv-template.html                # PDF print template
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust + system webview) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Backend | Express 5 + TypeScript |
| Database | SQLite (better-sqlite3) |
| AI Integration | MCP (@modelcontextprotocol/sdk) |
| PDF | Puppeteer (HTML → PDF), pdf-lib (metadata embedding) |
| File Import | pdf-parse (PDF), mammoth (DOCX) |
| Git | simple-git |
| Bundler | esbuild (server), Vite (client) |

## License

MIT
