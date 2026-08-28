# Resume Helper

A desktop CV tailoring tool that helps you build job-specific resumes from a master file of your career. Built around the philosophy that your resume should be uniquely *you*, not a generic list of qualifications.

## Download

**[Download Resume Helper v1.0.0 (Windows)](https://github.com/UnitBuilds-CC/Resume-Helper/releases/download/v1.0.0/Resume.Helper_1.0.0_x64-setup.exe)**

77MB standalone installer. Includes everything — no Node.js or terminal required. Just install and run.

## How It Works

1. **Fill your scratch pads** — Systems you've worked on (Pad 1) and detailed blocks of what you did, why, and how (Pad 2), tagged with skills
2. **Set up your template CV** — Education and employment history (the skeleton)
3. **Add job postings** — Paste or upload job descriptions you want to apply to
4. **Compile via AI** — An AI client (connected via MCP) bundles your data with the job posting and compiles a tailored CV using your own words
5. **Red team it** — The AI evaluates your compiled CV against the 3-phase hiring funnel and scores it
6. **Iterate** — Answer gap-analysis questions, add new blocks, re-compile until your score hits 90+
7. **Export PDF** — Download a polished, professional PDF

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

Resume Helper exposes 9 MCP tools that let any AI client (Claude Desktop, Qoder, Cursor, etc.) interact with your data.

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

| Tool | Description |
|------|-------------|
| `list_systems` | List all systems from scratch pad 1 |
| `list_blocks` | List blocks from scratch pad 2 (filterable by skill/search) |
| `get_template_cv` | Get template CV with education and employment |
| `list_job_postings` | List job postings (filterable by status) |
| `get_job_posting` | Get a full job posting by ID |
| `prepare_compilation` | Bundle all context for compiling a tailored CV (one call) |
| `save_compiled_cv` | Save an AI-compiled CV (auto-versions) |
| `prepare_red_team` | Bundle all context for red team evaluation (one call) |
| `save_red_team_result` | Save evaluation scores + gap-analysis questions |

### AI Workflow

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
│   ├── index.ts              # Express API server
│   ├── db.ts                 # SQLite schema and connection
│   ├── routes/               # REST endpoints (systems, blocks, jobs, etc.)
│   ├── services/
│   │   ├── file-reader.ts    # PDF/DOCX/TXT/MD text extraction
│   │   └── pdf-generator.ts  # Markdown → HTML → Puppeteer PDF
│   └── mcp/
│       ├── index.ts          # MCP server entry (stdio transport)
│       └── tools.ts          # 9 MCP tool definitions
├── client/
│   ├── App.tsx               # React router
│   ├── pages/                # Dashboard, Systems, Blocks, Template CV, etc.
│   ├── components/           # Layout, TagInput, FileUpload, Toast, ConfirmDialog
│   └── hooks/                # api() helper with retry logic
└── shared/
    └── types.ts              # TypeScript interfaces
src-tauri/
├── src/main.rs               # Tauri entry point (auto-starts API server)
├── tauri.conf.json           # Tauri configuration
├── Cargo.toml                # Rust dependencies
└── resources/                # Bundled Node.js + server for desktop app
templates/
└── cv-template.html          # PDF print template
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust + system webview) |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Backend | Express 5 + TypeScript |
| Database | SQLite (better-sqlite3) |
| AI Integration | MCP (@modelcontextprotocol/sdk) |
| PDF | Puppeteer (HTML → PDF) |
| File Import | pdf-parse (PDF), mammoth (DOCX) |
| Bundler | esbuild (server), Vite (client) |

## License

MIT
