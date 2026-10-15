# Petopia

Petopia is a portfolio project for a pet-care business group operating under one brand.

The first planned business flow is grooming service booking. The project is currently building its backend foundation; the booking flow is not implemented yet.

## Current implementation

- Customer registration with input validation and Argon2id password hashing.
- PostgreSQL-backed session login and logout.
- Current-user endpoint protected by a reusable session guard.
- Account status and auth-version checks.
- Database health endpoint.
- Business-unit and branch models.
- Repeatable demo seed for one grooming business and two branches.
- Automated tests and GitHub Actions CI.

## Stack

- Web: Next.js, React, TypeScript and Tailwind CSS.
- API: NestJS and TypeScript.
- Database: PostgreSQL 18.
- ORM: Prisma 7 with the PostgreSQL driver adapter.
- Tests: Jest and Supertest.
- Repository: npm workspaces.

## Requirements

- Node.js 24.18.0.
- npm 11.16.0.
- PostgreSQL 18 running locally.
- Git.
- pgAdmin or another PostgreSQL client for database setup.

Docker is not required for local development. GitHub Actions uses a PostgreSQL service container for CI.

The commands below use Windows Command Prompt.

## 1. Clone and install

```cmd
git clone https://github.com/CodePawsDev/Petopia.git
cd Petopia
npm ci
```

Run workspace commands from the repository root unless stated otherwise.

## 2. Prepare local databases

Using a PostgreSQL administrator account in pgAdmin:

1. Create a login role named `petopia_app` with a local password.
2. Create `petopia_dev` with `petopia_app` as its owner.
3. Create `petopia_test` with `petopia_app` as its owner.

These steps assume the role and databases do not already exist.

Use a dedicated local database account. Do not use workplace databases or credentials.

## 3. Configure environment files

```cmd
copy apps\api\.env.example apps\api\.env
copy apps\api\.env.test.example apps\api\.env.test
```

In each copied file:

- Replace `password` in `DATABASE_URL` with the local `petopia_app` password.
- URL-encode special characters in the password.
- Keep `.env` pointed at `petopia_dev`.
- Keep `.env.test` pointed at `petopia_test`.

Generate a session secret:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `SESSION_SECRET` in `.env`.

Run the command again and use a separate value for `.env.test`.

Each secret must contain 64 hexadecimal characters. Keep both actual environment files out of Git.

Before running setup or tests, remove any unintended shell-level `DATABASE_URL` or `SESSION_SECRET` overrides so the intended environment files are used.

## 4. Prepare the development database

```cmd
npm run prisma:validate --workspace apps/api
npm run prisma:generate --workspace apps/api
npm run prisma:migrate:deploy --workspace apps/api
npm run prisma:seed --workspace apps/api
```

The seed creates demo data:

- Business: `GROOMING`.
- Branch: `GROOMING-ARI`.
- Branch: `GROOMING-ONNUT`.

The branch names are fictional demo data.

The seed can run repeatedly without creating duplicate codes. Existing matching records are preserved. It does not create login accounts.

Seeding is restricted to databases named `petopia_dev` or `petopia_test`.

## 5. Prepare the test database

From the repository root:

```cmd
cd apps/api
```

Run this command as one line. It loads `.env.test`, verifies the database name and applies committed migrations:

```cmd
node -e "require('dotenv').config({path:'.env.test',override:true}); if(new URL(process.env.DATABASE_URL).pathname!=='/petopia_test') throw new Error('Expected petopia_test database'); const r=require('node:child_process').spawnSync(process.execPath,['../../node_modules/prisma/build/index.js','migrate','deploy'],{stdio:'inherit',env:process.env}); if(r.error) throw r.error; process.exitCode=r.status??1;"
```

Return to the repository root:

```cmd
cd ../..
```

E2E tests must use `petopia_test`. The test setup rejects other database names.

## 6. Run locally

Open two terminals at the repository root.

Terminal 1:

```cmd
npm run dev:api
```

Terminal 2:

```cmd
npm run dev:web
```

- Web: http://localhost:3000
- API: http://localhost:3001

The web currently provides the frontend scaffold. Authentication can be exercised through the API.

## 7. Smoke checks

With the API running:

| Request | Expected result |
| --- | --- |
| `GET /` | 200, `Hello World!` |
| `GET /health/database` | 200, database connected |
| `POST /auth/register` | 201 for a new valid account |
| `POST /auth/login` | 200 and a session cookie |
| `GET /auth/me` | 200 with the authenticated user's public fields |
| `POST /auth/logout` | 204 |
| `GET /auth/me` after logout | 401 |

Example registration body:

```json
{
  "email": "demo@example.com",
  "password": "PetopiaTest2026!",
  "displayName": "Demo User"
}
```

Example login body:

```json
{
  "email": "demo@example.com",
  "password": "PetopiaTest2026!"
}
```

Use a new email if the example account already exists. Login uses the account created through registration.

In Postman, use raw JSON for registration and login. Keep its cookie jar enabled and use the same hostname throughout. Current-user and logout requests require no body.

## 8. Automated checks

```cmd
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E tests start their own Nest application. A separately running API is not required, but PostgreSQL must be running and the test database must have all migrations applied.

## CI

GitHub Actions runs:

- Dependency installation using `npm ci`.
- Prisma schema validation and client generation.
- Migrations against a PostgreSQL test database.
- Demo seed twice.
- Lint, unit tests, E2E tests and builds.

CI uses test-only database credentials and a test-only session secret.

## Development workflow

- Create a branch from the latest `main`.
- Keep changes focused.
- Run relevant checks locally.
- Open a pull request into `main`.
- Wait for CI and review the changes.
- Squash and merge, then delete the remote branch.

Commit migration files. Do not edit migrations that have already been applied and shared.

## Troubleshooting

- Database connection failed: check the PostgreSQL service, port, database owner and `DATABASE_URL`.
- Session secret validation failed: generate a 64-character hexadecimal secret and set `SESSION_SECRET`.
- Missing generated Prisma Client: run `npm run prisma:generate --workspace apps/api`.
- E2E database safety check failed: check `.env.test` and shell-level environment overrides.
- Port already in use: stop the process using port 3000 or 3001 before starting the app.

## Planned work

- Customer pet profiles.
- Grooming services, pricing and staff schedules.
- Availability and booking.
- Branch operations and payment recording.
- Frontend integration.

Planned features are not included in the current implementation.