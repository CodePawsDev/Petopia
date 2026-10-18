# Authentication and Access Review

## Execution

- Date: 2026-10-18
- Tested commit: 8b20153f5ad44676c938ede9122966597cb8de66
- Environment: Local Windows development environment
- Database: Local PostgreSQL, petopia_test
- Results recorded from local execution reported by the developer.

## Automated checks

| Command | Result |
| --- | --- |
| npm run lint | Passed |
| npm test | Passed: 3 tests |
| npm run test:e2e | Passed: 45 tests |
| npm run build | Passed |

## Coverage reviewed

- Registration validation, password hashing and duplicate email handling.
- Session login, current-user access and logout.
- Rejection of replayed expired or logged-out session cookies.
- Session rejection after account deactivation or authVersion changes.
- Branch-scoped manager, groomer and receive-payment access.
- Rejection of inactive assignments, grants, branches and business units.
- Account and branch-access isolation between authenticated users.
- Logging out one user preserves another user's session.

See [Requirement traceability](../traceability.md) for case mappings.

## Scope limits

- Browser checks are manual; this run records automated checks only.
- Pet, booking and other business-resource ownership checks are deferred
  until those endpoints are implemented.
- These results do not constitute a production security audit.