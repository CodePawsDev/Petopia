# Petopia — Requirement Traceability

Status: Draft

## ID Convention

- REQ-AUTH-001: authentication requirement
- TC-AUTH-001: authentication test case
- Other modules will use PET, CATALOG, AVAIL, BOOKING, SERVICE and PAYMENT.
- IDs remain stable when wording or implementation changes.
- Retired IDs are not reused.

## Coverage and Results

Coverage describes whether a test exists:

- Implemented: automated test exists
- Planned: test still needs implementation

Execution results are recorded separately with the tested commit,
environment and evidence. Implemented does not mean currently passing.

## Authentication

These IDs label the existing authentication behavior and tests.
The mapping was reviewed against:

- [Registration tests](../../apps/api/test/auth.e2e-spec.ts)
- [Session authentication tests](../../apps/api/test/session-auth.e2e-spec.ts)

TC-AUTH-001 through TC-AUTH-014 map to existing automated tests.
TC-AUTH-015 remains planned.

| Requirement ID | Acceptance criterion                                                                                            | Test case IDs                         | Coverage    |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| REQ-AUTH-001   | Registration normalizes email and display name, stores an Argon2id password hash and returns only public fields | TC-AUTH-001                           | Implemented |
| REQ-AUTH-002   | Duplicate emails are rejected regardless of letter case; concurrent registration creates only one user          | TC-AUTH-002, TC-AUTH-003              | Implemented |
| REQ-AUTH-003   | Registration rejects invalid email, passwords shorter than 8 characters and client-supplied staff roles         | TC-AUTH-004, TC-AUTH-005, TC-AUTH-006 | Implemented |
| REQ-AUTH-004   | Valid credentials create an authenticated session and return public user fields                                 | TC-AUTH-007                           | Implemented |
| REQ-AUTH-005   | Incorrect password and unknown email return the same authentication error without authenticating                | TC-AUTH-008, TC-AUTH-009              | Implemented |
| REQ-AUTH-006   | Current-user requests require an authenticated session and return Cache-Control: no-store                       | TC-AUTH-010, TC-AUTH-011              | Implemented |
| REQ-AUTH-007   | Logout returns 204, destroys the session and prevents reuse of the old cookie                                   | TC-AUTH-012                           | Implemented |
| REQ-AUTH-008   | Deactivated users cannot continue using an existing session                                                     | TC-AUTH-013                           | Implemented |
| REQ-AUTH-009   | Changing authVersion invalidates an old session; a fresh login can authenticate again                           | TC-AUTH-014                           | Implemented |
| REQ-AUTH-010   | Expired sessions cannot access protected endpoints                                                              | TC-AUTH-015                           | Planned     |

## Test Case Index

| Test case ID | Scenario                                                               |
| ------------ | ---------------------------------------------------------------------- |
| TC-AUTH-001  | Normalize registration input, verify password hash and public response |
| TC-AUTH-002  | Reject duplicate email with different letter case                      |
| TC-AUTH-003  | Submit concurrent registrations for the same email                     |
| TC-AUTH-004  | Reject invalid email                                                   |
| TC-AUTH-005  | Reject password shorter than 8 characters                              |
| TC-AUTH-006  | Reject client-supplied staff role                                      |
| TC-AUTH-007  | Log in successfully and check session-cookie attributes                |
| TC-AUTH-008  | Reject incorrect password without creating an authenticated session    |
| TC-AUTH-009  | Reject unknown email without creating an authenticated session         |
| TC-AUTH-010  | Reject current-user request without authentication                     |
| TC-AUTH-011  | Return current user with no-store cache policy                         |
| TC-AUTH-012  | Log out and reject both the agent session and replayed cookie          |
| TC-AUTH-013  | Reject existing session after user deactivation                        |
| TC-AUTH-014  | Reject old authVersion and allow fresh login                           |
| TC-AUTH-015  | Reject expired session                                                 |

## Maintenance

- Add the case ID to the corresponding automated test title.
- One automated test may cover multiple case IDs.
- Link test files after checking their current names and contents.
- Record execution evidence separately; do not infer results from coverage.
- Expand the matrix when each feature's acceptance criteria are confirmed.
