# Resume Helper

A local CV tailoring tool that helps you build job-specific resumes from a master file of your career. Built around the philosophy that your resume should be uniquely *you*, not a generic list of qualifications.

## How It Works

1. **Fill your scratch pads** — Systems you've worked on (Pad 1) and detailed blocks of what you did, why, and how (Pad 2), tagged with skills
2. **Set up your template CV** — Education and employment history (the skeleton)
3. **Add job postings** — Paste or upload job descriptions you want to apply to
4. **Compile via AI** — An AI client (connected via MCP) bundles your data with the job posting and compiles a tailored CV using your own words
5. **Red team it** — The AI evaluates your compiled CV against the 3-phase hiring funnel and scores it
6. **Iterate** — Answer gap-analysis questions, add new blocks, re-compile until your score hits 90+
7. **Export PDF** — Download a polished, professional PDF

## Setup

### Prerequisites

- Node.js 18+ (LTS recommended)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts:
- **Express API** on `http://localhost:3000`
- **Vite dev server** on `http://localhost:5173` (with hot reload)

Open `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build
npm start
```

The Express server serves both the API and the built frontend on port 3000.

## MCP Configuration

> **Full walkthrough:** See [USER-GUIDE.md](./USER-GUIDE.md) for step-by-step instructions on connecting Claude Desktop, Qoder, Cursor, and other AI clients, plus the complete CV tailoring workflow.

The MCP server exposes 9 tools that let any AI client (Qoder, Claude Desktop, etc.) interact with your data.

### Run the MCP server

```bash
npm run mcp
```

### Configure your AI client

Add this to your MCP client configuration:

**Qoder** (`.qoder/settings.json`):
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

**Claude Desktop** (`claude_desktop_config.json`):
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

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_systems` | List all systems from scratch pad 1 |
| `list_blocks` | List blocks from scratch pad 2 (filterable by skill/search) |
| `get_template_cv` | Get template CV with education and employment |
| `list_job_postings` | List job postings (filterable by status) |
| `get_job_posting` | Get a full job posting by ID |
| `prepare_compilation` | Bundle all context for compiling a tailored CV |
| `save_compiled_cv` | Save an AI-compiled CV (auto-versions) |
| `prepare_red_team` | Bundle all context for red team evaluation |
| `save_red_team_result` | Save evaluation scores + gap-analysis questions |

### Typical AI Workflow

```
1. AI calls prepare_compilation(job_posting_id=1)
   → receives: job posting + template CV + all systems + all blocks

2. AI compiles a tailored CV in Markdown

3. AI calls save_compiled_cv(job_posting_id=1, content="# My CV...")
   → saved as version 1

4. AI calls prepare_red_team(compiled_cv_id=1)
   → receives: compiled CV + all context for evaluation

5. AI evaluates and calls save_red_team_result(...)
   → saves scores, analysis, and questions

6. User reviews questions in the web UI, adds new blocks, re-compiles
```

## Project Structure

```
src/
├── server/
│   ├── index.ts          # Express API server
│   ├── db.ts             # SQLite schema and connection
│   ├── routes/           # REST endpoints for web UI
│   ├── services/
│   │   ├── file-reader.ts    # PDF/DOCX/TXT/MD text extraction
│   │   └── pdf-generator.ts  # Markdown → HTML → Puppeteer PDF
│   └── mcp/
│       ├── index.ts      # MCP server entry (stdio transport)
│       └── tools.ts      # 9 MCP tool definitions
├── client/
│   ├── App.tsx           # React router
│   ├── pages/            # Dashboard, Systems, Blocks, etc.
│   ├── components/       # Layout, TagInput, FileUpload, ScoreGauge
│   └── hooks/            # useApi
└── shared/
    └── types.ts          # TypeScript interfaces
templates/
└── cv-template.html      # Puppeteer print template
data/
└── resume-helper.db    # SQLite database (auto-created)
```

## Tech Stack

- **Backend**: Express 5 + TypeScript
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
- **MCP**: @modelcontextprotocol/sdk (stdio transport)
- **PDF**: Puppeteer (HTML → PDF)
- **File Import**: pdf-parse (PDF), mammoth (DOCX)
