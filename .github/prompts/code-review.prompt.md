---
mode: agent
description: "Perform a structured code review following team standards and best practices"
tools: ["githubRepo"]
---

# Code Review

Perform a thorough code review of the specified changes following our team standards.

## Review Checklist

### 1. Code Quality
- [ ] TypeScript strict mode compliance — no `any` types without justification
- [ ] Consistent error handling with proper HTTP status codes
- [ ] Input validation using zod schemas
- [ ] No `console.log` — use `pino` structured logging
- [ ] Async/await used consistently (no raw Promises or callbacks)

### 2. Security
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] User input sanitized before use
- [ ] Authentication middleware applied to protected endpoints
- [ ] RBAC checks for role-restricted operations
- [ ] No SQL/NoSQL injection vulnerabilities

### 3. Performance
- [ ] Database queries use proper indexing strategies
- [ ] No N+1 query patterns
- [ ] Pagination implemented for list endpoints
- [ ] Appropriate use of caching where applicable

### 4. Testing
- [ ] Unit tests added for new functionality
- [ ] Edge cases covered (empty input, invalid data, unauthorized access)
- [ ] Test factories used instead of hardcoded values
- [ ] Integration tests for new API endpoints

### 5. Documentation
- [ ] JSDoc comments on public functions and interfaces
- [ ] API endpoint documentation updated
- [ ] README updated if setup steps changed

### 6. Accessibility & UX
- [ ] Error messages are user-readable
- [ ] Error codes included for frontend i18n support
- [ ] API responses follow consistent format: `{ data: T, error?: string }`

## Output Format

For each issue found, provide:
1. **File and line number**
2. **Severity:** Critical / Warning / Suggestion
3. **Issue description**
4. **Recommended fix** with a code snippet

## Changes to Review

{{{ input }}}
