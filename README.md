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
- Branch-scoped staff roles and receive-payment permissions with reusable guards.
- Optional local demo accounts for customer, manager, groomer and payment access.
- Web login, account details and logout.
- Current-user response includes active branch roles and explicit permission grants.
- Role-based navigation to manager, groomer and payment workspaces.
- Workspace APIs enforce session authentication and branch-scoped access.
- Workspace pages display branch context; business operations are not implemented yet.
- Owner-scoped pet profiles for dogs, cats and rabbits.
- Web forms for creating and editing pet profiles with field-level validation.
- Separate active and archived pet lists, with reversible archival.
- Public catalog APIs for active grooming branches, services, rates and branch groomers.
- Repeatable demo service catalog with prices in satang and durations in minutes.
- Species-specific weight bands and assessment flags for rabbit services.
- Public grooming catalog page with branch and species selection.
- Optional weight input to display matching service prices and durations.
- Branch groomer lists and assessment notices.
- Authenticated multi-service quote API using stored pet species, weight and catalog rates.
- Server-side service combination checks, price and duration totals, and assessment flags.

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

### Optional: Local demo accounts

Demo accounts are optional and can only be seeded into `petopia_dev`.

1. Run the baseline seed to create the business unit and branches.
2. Set `DEMO_PASSWORD` in `apps/api/.env` to a password of 8–128 characters.
3. Run from the repository root:

```bash
npm run prisma:seed:demo --workspace apps/api
```

| Email                           | Branch | Role or permission               |
| ------------------------------- | ------ | -------------------------------- |
| customer@demo.petopia.test      | —      | Customer; no staff permissions   |
| manager.ari@demo.petopia.test   | Ari    | BRANCH_MANAGER                   |
| groomer.ari@demo.petopia.test   | Ari    | GROOMER                          |
| cashier.onnut@demo.petopia.test | Onnut  | RECEIVE_PAYMENT; no manager role |
| groomer.onnut@demo.petopia.test | Onnut  | GROOMER                          |

New accounts use the configured `DEMO_PASSWORD`.
Running the demo seed again does not duplicate records or reset existing
passwords, account status, assignments or grants.

Changing `DEMO_PASSWORD` does not change passwords for existing accounts.
Keep actual environment files out of Git.

Demo accounts support local development and manual testing.
After logging in, the account page displays branch access and available workspace links.

Managers can access the manager and payment workspaces in their assigned branch.
Groomers can access the groomer workspace in their assigned branch.
An explicit RECEIVE_PAYMENT grant permits payment workspace access without granting manager or groomer access.

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

Open http://localhost:3000/login to sign in with an existing account.
The account page displays public account details, branch access and workspace navigation.

The web forwards `/api/*` requests to the local API at http://localhost:3001.
This rewrite currently targets local development and must be configured before deployment.

Registration is currently available through the API; a registration page is not implemented yet.

## 7. Smoke checks

With the API running:

| Request                     | Expected result                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `GET /`                     | 200, `Hello World!`                                                                     |
| `GET /health/database`      | 200, database connected                                                                 |
| `POST /auth/register`       | 201 for a new valid account                                                             |
| `POST /auth/login`          | 200 and a session cookie                                                                |
| `GET /auth/me`              | 200 with public account fields, active staff assignments and explicit permission grants |
| `POST /auth/logout`         | 204                                                                                     |
| `GET /auth/me` after logout | 401                                                                                     |

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

### Browser and workspace checks

Log out before switching between demo accounts.

| Account               | Expected workspace access          |
| --------------------- | ---------------------------------- |
| Customer              | No staff workspace links           |
| Ari manager           | Ari manager and payment workspaces |
| Ari groomer           | Ari groomer workspace              |
| Onnut payment account | Onnut payment workspace            |
| Onnut groomer         | Onnut groomer workspace            |

Authorized workspace pages display the selected branch and placeholder content.

API workspace endpoints:

- GET /branches/:branchId/workspaces/manager
- GET /branches/:branchId/workspaces/groomer
- GET /branches/:branchId/workspaces/payment

Use the branch UUID as branchId, not its code.
Workspace API requests return 401 without authentication and 403 without the required branch access.
Successful responses include Cache-Control: no-store.

Verify that entering a workspace URL directly does not bypass authorization.
Unauthenticated browser requests redirect to login.
Unknown workspace types display a 404 page.

Browser checks are currently manual. API authorization checks are automated.

QA documentation: [Requirement traceability](docs/qa/traceability.md).

### Pet profile browser checks

Open `/account` and select “สัตว์เลี้ยงของฉัน”, or visit `/pets` after login.

- Create a pet with a name and species; optional fields may be left blank.
- Edit a pet and verify that saved changes remain after refreshing.
- Clear optional fields and verify that they display as unspecified.
- Check that invalid input displays an error beside the relevant field.
- Archive a pet through the confirmation dialog.
- Cancel archival using the cancel button or Escape.
- Switch between active and archived lists.
- Restore an archived pet and verify that it returns to the active list.
- Check the form, cards and dialog at a narrow viewport.

Pet API ownership and validation are covered by automated E2E tests.
Browser interaction checks are currently manual.

Booking-related archival restrictions are deferred until booking implementation.

### Service quotes

POST /quotes requires an authenticated session.

Send branchId, petId and a non-empty serviceIds array.
The pet must belong to the authenticated customer and must not be archived.

The API calculates prices and durations from stored pet data and active
catalog rates. Client-supplied prices and weight are rejected.

Quotes are calculated on demand and are not saved.
They do not reserve availability, lock prices or create bookings.
Assessment flags indicate whether staff assessment is required before
booking confirmation.

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
- Baseline business and branch seed twice.
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

- Grooming services, pricing and staff schedules.
- Availability and booking.
- Branch operations and payment recording.
- Frontend integration for pet profiles, booking and branch operations.

Planned features are not included in the current implementation.
