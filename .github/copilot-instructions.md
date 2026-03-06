# Team Task Tracker — Copilot Custom Instructions

## Project Overview
This is the Team Task Tracker application — a collaborative task management tool built with Node.js, Express, and TypeScript. It uses Azure Cosmos DB for data storage and Microsoft Entra ID for authentication.

## Architecture
- **Backend:** Express.js REST API with TypeScript
- **Database:** Azure Cosmos DB (NoSQL) — use the `@azure/cosmos` SDK
- **Authentication:** Microsoft Entra ID via `@azure/identity` and `passport-azure-ad`
- **Hosting:** Azure App Service (Linux, Node.js 20)

## Coding Standards
- Use TypeScript strict mode (`"strict": true` in tsconfig.json)
- Follow ESLint recommended rules with `@typescript-eslint/recommended`
- Use `async/await` — never raw Promises or callbacks
- All API endpoints must validate input using `zod` schemas
- All API endpoints must return consistent JSON: `{ data: T, error?: string }`
- Use structured logging with `pino` — never `console.log` in production code

## API Design
- RESTful endpoints under `/api/v1/`
- Use plural nouns: `/api/v1/tasks`, `/api/v1/teams`
- Return proper HTTP status codes: 200, 201, 400, 401, 403, 404, 500
- Include pagination for list endpoints: `?page=1&limit=20`
- Include filtering and sorting: `?status=active&sort=createdAt:desc`

## Security Requirements
- All endpoints require authentication except `/health` and `/api/v1/status`
- Use RBAC: roles are `admin`, `team-lead`, `member`
- Sanitize all user input to prevent injection attacks
- Never expose stack traces in production error responses
- Use Azure Managed Identity for service-to-service communication

## Testing Standards
- Unit tests with Jest — minimum 80% code coverage
- Integration tests for all API endpoints
- Test files colocated: `src/routes/tasks.test.ts` alongside `src/routes/tasks.ts`
- Use factories for test data — never hardcode test values
- Mock external services (Cosmos DB, Entra ID) in unit tests

## Accessibility
- All error messages must be user-readable (not technical jargon)
- API responses must include descriptive error codes for frontend i18n
- Documentation must be available for all public endpoints

## Git Conventions
- Branch naming: `feature/`, `bugfix/`, `hotfix/` prefixes
- Commit messages: Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`)
- PR descriptions must reference the Azure DevOps work item ID
