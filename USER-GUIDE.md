# User Guide: Connecting Your AI

Resume Helper works with any AI client that supports MCP (Model Context Protocol). This guide walks you through connecting it to your AI of choice and using the CV tailoring workflow.

## What You Need

- Resume Helper running locally (`npm run dev` or `npm start`)
- An AI client that supports MCP (Claude Desktop, Qoder, Cursor, etc.)
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

## Step 4: The CV Tailoring Workflow

Here's the complete workflow for tailoring a CV to a specific job.

### 4a. Compile a Tailored CV

Tell your AI:
> "Compile a CV for job posting #1 using my scratch pads. Use prepare_compilation to get all the context, then write a tailored CV in Markdown that highlights the most relevant experience for this role. Save it with save_compiled_cv."

The AI will:
1. Call `prepare_compilation(job_posting_id=1)` to get your job posting + all scratch pad data
2. Analyze the job requirements against your experience
3. Write a tailored CV in Markdown, cherry-picking relevant blocks and skills
4. Call `save_compiled_cv(job_posting_id=1, content="...")` to save it

You'll see the compiled CV appear in the web UI under "Compiled CVs."

### 4b. Red Team the CV

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

### 4c. Iterate

Check your Questions page in the web UI. For each question:
- If you have the experience, answer it and consider adding a new Block to your scratch pad
- If you don't, dismiss it

Then re-compile and re-run the red team:
> "I've added new blocks to my scratch pads. Re-compile the CV for job #1 and run the red team again."

Repeat until your score hits 90+.

### 4d. Export

Once you're happy:
- **Copy:** Click "Copy" on the compiled CV in the web UI to copy the Markdown to your clipboard
- **PDF:** Click "Download PDF" to get a polished PDF

---

## Available MCP Tools

| Tool | What It Does |
|------|-------------|
| `list_systems` | List all systems from scratch pad 1 |
| `list_blocks` | List blocks from scratch pad 2 (filter by skill or search) |
| `get_template_cv` | Get your template CV with education and employment |
| `list_job_postings` | List job postings (filter by status) |
| `get_job_posting` | Get a full job posting by ID |
| `prepare_compilation` | Bundle everything needed to compile a CV (one call) |
| `save_compiled_cv` | Save an AI-compiled CV (auto-versions) |
| `prepare_red_team` | Bundle everything needed for red team evaluation (one call) |
| `save_red_team_result` | Save scores, analysis, and gap-analysis questions |

---

## Tips

- **Be specific in your prompts.** Instead of "compile a CV," say "compile a CV for job #1, emphasizing my ERP integration experience and SecOps background."
- **Use the web UI for data entry.** It's faster to add systems, blocks, and job postings through the web UI than through the AI.
- **The AI uses your words.** When compiling, the AI pulls from your blocks — it doesn't invent experience. The more detailed your blocks, the better the output.
- **Version control your CVs.** Each compilation creates a new version. You can compare versions in the web UI.
- **Red team is your reality check.** It simulates how a reviewer would see you. If the score is low, the questions will tell you exactly what's missing.

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
