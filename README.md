# Team Task Tracker — Sample Application

A sample project used for GitHub Copilot productivity demonstrations. This is **not** a production application — it's a scaffold designed to showcase Copilot capabilities across the full SDLC.

## Purpose

This directory contains the configuration files that power GitHub Copilot's contextual intelligence:

| File | Purpose |
|------|---------|
| `copilot-setup-steps.yml` | Environment setup for the coding agent |
| `.vscode/mcp.json` | MCP server configuration for VS Code |
| `.github/copilot-instructions.md` | Custom instructions for Copilot |
| `.github/prompts/create-user-story.prompt.md` | Reusable prompt for PM user stories |
| `.github/prompts/code-review.prompt.md` | Reusable prompt for code reviews |
| `.github/agents/frontend-agent.md` | Custom agent: Frontend specialist |
| `.github/agents/testing-agent.md` | Custom agent: Testing specialist |

## How to Use in Demos

### Part 1 (Product Managers)
1. Show `.github/copilot-instructions.md` — explain how custom instructions enforce team standards
2. Use `create-user-story.prompt.md` to generate a user story with compliance, accessibility, and security baked in

### Part 2 (Developers)
1. Show `.vscode/mcp.json` — explain MCP server integration
2. Use `@frontend-agent` to ask frontend-specific questions
3. Use `@testing-agent` to generate tests
4. Use `code-review.prompt.md` for structured PR reviews

### Part 3 (DevOps)
1. Show `copilot-setup-steps.yml` — explain how the coding agent environment is configured
2. Ask Copilot to generate `.github/workflows/ci-cd.yml` from natural language

## Application Structure

```
src/
  index.ts                 # Express server entry point — exports app for testing
  models/
    task.ts                # Task schema & types (Zod validation)
    team.ts                # Team schema & types (Zod validation)
  routes/
    tasks.ts               # Task CRUD API — /api/v1/tasks
    tasks.test.ts          # Task endpoint tests (colocated)
    teams.ts               # Team management API — /api/v1/teams
    teams.test.ts          # Team endpoint tests (colocated)
    dashboard.ts           # Dashboard aggregation — /api/v1/dashboard
    dashboard.test.ts      # Dashboard & health/status tests (colocated)
  middleware/
    auth.ts                # Authentication (Entra ID / demo headers)
    validation.ts          # Zod-based body & query validation
  utils/
    logger.ts              # Pino structured logging
    response.ts            # Consistent API response helpers
    database.ts            # Cosmos DB client + in-memory fallback
  tests/
    factories.ts           # Test data factories
.github/
  copilot-instructions.md  # Custom Copilot coding standards
  prompts/                 # Reusable prompt files
  agents/                  # Custom agent profiles
  workflows/ci-cd.yml      # GitHub Actions CI/CD pipeline
.vscode/mcp.json           # MCP server configuration
copilot-setup-steps.yml    # Coding agent environment
Dockerfile                 # Multi-stage production container
```

## Quick Start

```bash
cd SampleApp
npm install
npm run dev          # Start dev server with hot-reload (port 3000)
npm test             # Run tests with coverage
npm run build        # Compile TypeScript → dist/
```

### Try the API (no Azure required)

The app runs with an in-memory store when Cosmos DB is not configured:

```bash
# Health check (no auth)
curl http://localhost:3000/health

# Create a team
curl -X POST http://localhost:3000/api/v1/teams \
  -H "Content-Type: application/json" \
  -H "x-user-id: demo-user" \
  -H "x-user-role: admin" \
  -d '{"name": "Platform Team", "description": "Core platform engineering"}'

# Create a task (use the team ID from the response above)
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "x-user-id: demo-user" \
  -H "x-user-role: admin" \
  -d '{"title": "Add team dashboard", "teamId": "<TEAM_ID>", "priority": "high"}'

# Get dashboard
curl http://localhost:3000/api/v1/dashboard?teamId=<TEAM_ID> \
  -H "x-user-id: demo-user"
```

## Tech Stack
- **Runtime:** Node.js 20
- **Framework:** Express.js with TypeScript
- **Database:** Azure Cosmos DB (NoSQL)
- **Authentication:** Microsoft Entra ID (Azure AD)
- **Hosting:** Azure App Service
- **CI/CD:** GitHub Actions
