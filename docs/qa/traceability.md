# Petopia — Requirement Traceability

Status: Draft

## ID Convention

- REQ-AUTH-001: authentication requirement
- TC-AUTH-001: authentication test case
- REQ-AUTHZ-001: authorization requirement
- TC-AUTHZ-001: authorization test case
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
| TC-AUTH-015 | Reject expired session |

## Branch Authorization

Authorization checks are implemented in:

- [Authorization tests](../../apps/api/test/authorization.e2e-spec.ts)
- [Test-only controller](../../apps/api/test/helpers/authorization-test.controller.ts)

The suite includes database integration tests and HTTP tests against
test-only routes. Production business endpoints must apply these guards
and enforce resource ownership when implemented.

| Requirement ID | Acceptance criterion | Test case IDs | Coverage |
| --- | --- | --- | --- |
| REQ-AUTHZ-001 | Branch-role access requires an active assignment for the requested role and branch | TC-AUTHZ-001–005 | Implemented |
| REQ-AUTHZ-002 | Branch-role access is denied when the user, branch or business unit is inactive | TC-AUTHZ-006–008 | Implemented |
| REQ-AUTHZ-003 | Manager routes require an authenticated session and enforce branch scope over HTTP | TC-AUTHZ-009–010 | Implemented |
| REQ-AUTHZ-004 | Payment access requires an active branch-manager assignment or an active RECEIVE_PAYMENT grant in the requested branch | TC-AUTHZ-011–014 | Implemented |
| REQ-AUTHZ-005 | Payment grants do not allow access when the user, branch or business unit is inactive | TC-AUTHZ-015–017 | Implemented |
| REQ-AUTHZ-006 | Payment grants allow payment access without manager access; revocation takes effect on the next request | TC-AUTHZ-018 | Implemented |

### Authorization Test Case Index

| Test case ID | Scenario |
| --- | --- |
| TC-AUTHZ-001 | Allow an active manager in their assigned branch |
| TC-AUTHZ-002 | Reject role access to another branch |
| TC-AUTHZ-003 | Reject a role the user does not hold |
| TC-AUTHZ-004 | Reject access without a matching assignment |
| TC-AUTHZ-005 | Reject an inactive assignment |
| TC-AUTHZ-006 | Reject role access for an inactive user |
| TC-AUTHZ-007 | Reject role access to an inactive branch |
| TC-AUTHZ-008 | Reject role access under an inactive business unit |
| TC-AUTHZ-009 | Return 401 for a manager route without a session |
| TC-AUTHZ-010 | Allow the assigned branch and reject another branch over HTTP |
| TC-AUTHZ-011 | Allow a branch manager to receive payment without an explicit grant |
| TC-AUTHZ-012 | Reject payment access in another branch without a grant |
| TC-AUTHZ-013 | Allow an active payment grant without granting the manager role |
| TC-AUTHZ-014 | Reject an inactive payment grant |
| TC-AUTHZ-015 | Reject payment-grant access for an inactive user |
| TC-AUTHZ-016 | Reject payment-grant access to an inactive branch |
| TC-AUTHZ-017 | Reject payment-grant access under an inactive business unit |
| TC-AUTHZ-018 | Verify payment access, manager denial and grant revocation over HTTP |                                              |

## Maintenance

- Add the case ID to the corresponding automated test title.
- One automated test may cover multiple case IDs.
- Link test files after checking their current names and contents.
- Record execution evidence separately; do not infer results from coverage.
- Expand the matrix when each feature's acceptance criteria are confirmed.
