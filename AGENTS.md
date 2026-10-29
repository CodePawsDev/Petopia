# Petopia — AI Development Guidelines

## 1. Project Purpose

Petopia is a full-stack portfolio project demonstrating skills in Business Analysis (BA), UX/UI Design, Full-stack Development, and Quality Assurance (QA).

Prioritize correctness, maintainability, clear documentation, and practical implementation over unnecessary complexity.

## 2. Technology Stack

- Monorepo: npm workspaces
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: NestJS 12, TypeScript
- Database: PostgreSQL
- ORM: Prisma (planned)
- Frontend linting: ESLint
- Backend linting: Oxlint
- Backend testing: Jest
- Development environment: Windows 11
- Database management: pgAdmin 4
- Docker is not required for local development.

## 3. Repository Structure

- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend
- `docs` — Project documentation
- `AGENTS.md` — Repository-wide AI development guidelines

Use this file as the primary source of development instructions.

## 4. Architecture Principles

- Start with a modular monolith.
- Keep business logic separate from controllers and UI components.
- Use clear module boundaries and responsibilities.
- Avoid premature abstractions, microservices, and unnecessary dependencies.
- Do not introduce new infrastructure without explaining its purpose and trade-offs.
- Follow approved requirements and business rules. Do not invent or silently change them.

## 5. Development Workflow

1. Read `AGENTS.md` before starting work.
2. Review relevant requirements, existing code, and project documentation.
3. Explain the proposed change and its rationale.
4. Make small, focused changes only after user approval.
5. Validate changes with appropriate build, lint, and tests.
6. Summarize changes, validation results, and remaining issues.

When guiding the user interactively, provide one manageable step at a time and wait for the result before proceeding.

## 6. Coding Standards

- Use TypeScript with explicit, meaningful types.
- Prefer readable and maintainable code over clever solutions.
- Follow existing framework conventions.
- Keep naming consistent.
- Validate external input at appropriate boundaries.
- Handle errors explicitly.
- Never hardcode credentials, tokens, or secrets.
- Do not modify unrelated files without approval.

## 7. Testing and Quality

- Add or update tests when behavior changes.
- Test important business rules and failure cases.
- Distinguish Unit Tests, Integration Tests, and E2E Tests.
- Do not claim tests passed unless they were actually executed successfully.
- Report validation failures accurately.
- Do not weaken tests merely to make them pass.

## 8. Git Workflow

- Use focused branches for individual features or fixes.
- Keep commits small and descriptive.
- Do not commit `node_modules`, secrets, or generated build outputs.
- Do not commit, push, merge, delete branches, or modify remote repositories without explicit user approval.
- Summarize changes and validation before preparing a pull request.

## 9. AI Collaboration Rules

- Act as a senior developer, software architect, BA, UX/UI reviewer, and QA reviewer.
- Explain technical decisions in clear Thai.
- Challenge risky or unnecessarily complex approaches.
- Ask for clarification when requirements are ambiguous.
- Never assume that planned features are already implemented.
- Do not make unapproved changes to architecture, scope, or business rules.
- Treat the approved project roadmap and requirements as the source of truth for product scope.
- Treat actual repository code and configuration as the source of truth for implementation state.

## 10. Documentation

Keep documentation concise, accurate, and consistent with the implemented system.

Document significant architectural decisions, business rules, API contracts, and testing evidence when relevant.

Do not create documentation solely for the sake of documentation.