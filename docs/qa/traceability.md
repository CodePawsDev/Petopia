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

TC-AUTH-001 through TC-AUTH-015 map to existing automated tests.

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
| REQ-AUTH-010   | Expired sessions cannot access protected endpoints                                                              | TC-AUTH-015                           | Implemented |

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

## Branch Authorization

Authorization checks are implemented in:

- [Authorization tests](../../apps/api/test/authorization.e2e-spec.ts)
- [Test-only controller](../../apps/api/test/helpers/authorization-test.controller.ts)

The suite includes database integration tests, HTTP tests against test-only
routes and HTTP tests against branch workspace endpoints.

Account isolation and branch access are covered. Ownership checks for pets,
bookings and other business resources will be added when those endpoints
are implemented.

| Requirement ID | Acceptance criterion                                                                                                                             | Test case IDs                                          | Coverage    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ----------- |
| REQ-AUTHZ-001  | Branch-role access requires an active assignment for the requested role and branch                                                               | TC-AUTHZ-001–005                                       | Implemented |
| REQ-AUTHZ-002  | Branch-role access is denied when the user, branch or business unit is inactive                                                                  | TC-AUTHZ-006–008                                       | Implemented |
| REQ-AUTHZ-003  | Manager routes require an authenticated session and enforce branch scope over HTTP                                                               | TC-AUTHZ-009–010                                       | Implemented |
| REQ-AUTHZ-004  | Payment access requires an active branch-manager assignment or an active RECEIVE_PAYMENT grant in the requested branch                           | TC-AUTHZ-011–014                                       | Implemented |
| REQ-AUTHZ-005  | Payment grants do not allow access when the user, branch or business unit is inactive                                                            | TC-AUTHZ-015–017                                       | Implemented |
| REQ-AUTHZ-006  | Payment grants allow payment access without manager access; revocation takes effect on the next request                                          | TC-AUTHZ-018                                           | Implemented |
| REQ-AUTHZ-007  | Current-user response includes public account fields and the user's active branch roles and explicit permission grants                           | TC-AUTHZ-019                                           | Implemented |
| REQ-AUTHZ-008  | Current-user access reflects deactivated assignments, grants, branches and business units within an existing session                             | TC-AUTHZ-020, TC-AUTHZ-021, TC-AUTHZ-022, TC-AUTHZ-023 | Implemented |
| REQ-AUTHZ-009  | All branch workspace endpoints require an authenticated session                                                                                  | TC-AUTHZ-024, TC-AUTHZ-025, TC-AUTHZ-026               | Implemented |
| REQ-AUTHZ-010  | Managers can access manager and payment workspaces in their assigned branch, without implicit groomer access                                     | TC-AUTHZ-027                                           | Implemented |
| REQ-AUTHZ-011  | Groomer workspace access requires an active groomer assignment in that branch; revocation takes effect within an existing session                | TC-AUTHZ-028                                           | Implemented |
| REQ-AUTHZ-012  | An explicit payment grant permits payment workspace access without manager or groomer access; revocation takes effect within an existing session | TC-AUTHZ-029                                           | Implemented |
| REQ-AUTHZ-013  | Authenticated users see only their own account and branch access; logging out one user does not invalidate another user's session                | TC-AUTHZ-030                                           | Implemented |

### Authorization Test Case Index

| Test case ID | Scenario                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| TC-AUTHZ-001 | Allow an active manager in their assigned branch                                                                  |
| TC-AUTHZ-002 | Reject role access to another branch                                                                              |
| TC-AUTHZ-003 | Reject a role the user does not hold                                                                              |
| TC-AUTHZ-004 | Reject access without a matching assignment                                                                       |
| TC-AUTHZ-005 | Reject an inactive assignment                                                                                     |
| TC-AUTHZ-006 | Reject role access for an inactive user                                                                           |
| TC-AUTHZ-007 | Reject role access to an inactive branch                                                                          |
| TC-AUTHZ-008 | Reject role access under an inactive business unit                                                                |
| TC-AUTHZ-009 | Return 401 for a manager route without a session                                                                  |
| TC-AUTHZ-010 | Allow the assigned branch and reject another branch over HTTP                                                     |
| TC-AUTHZ-011 | Allow a branch manager to receive payment without an explicit grant                                               |
| TC-AUTHZ-012 | Reject payment access in another branch without a grant                                                           |
| TC-AUTHZ-013 | Allow an active payment grant without granting the manager role                                                   |
| TC-AUTHZ-014 | Reject an inactive payment grant                                                                                  |
| TC-AUTHZ-015 | Reject payment-grant access for an inactive user                                                                  |
| TC-AUTHZ-016 | Reject payment-grant access to an inactive branch                                                                 |
| TC-AUTHZ-017 | Reject payment-grant access under an inactive business unit                                                       |
| TC-AUTHZ-018 | Verify payment access, manager denial and grant revocation over HTTP                                              |
| TC-AUTHZ-019 | Return public account fields and active branch roles and permission grants                                        |
| TC-AUTHZ-020 | Exclude an inactive staff assignment from current-user access                                                     |
| TC-AUTHZ-021 | Exclude an inactive permission grant from current-user access                                                     |
| TC-AUTHZ-022 | Exclude roles and grants belonging to inactive branches                                                           |
| TC-AUTHZ-023 | Exclude roles and grants belonging to an inactive business unit                                                   |
| TC-AUTHZ-024 | Reject manager workspace access without a session                                                                 |
| TC-AUTHZ-025 | Reject groomer workspace access without a session                                                                 |
| TC-AUTHZ-026 | Reject payment workspace access without a session                                                                 |
| TC-AUTHZ-027 | Verify manager and payment access, branch isolation and no implicit groomer access                                |
| TC-AUTHZ-028 | Verify groomer access, branch isolation, role separation and assignment revocation                                |
| TC-AUTHZ-029 | Verify explicit payment access, role separation and grant revocation                                              |
| TC-AUTHZ-030 | Isolate account data and branch access between two users; logging out one user preserves the other user's session |

## Pet profiles

API coverage is mapped to [Pet profile tests](../../apps/api/test/pets.e2e-spec.ts).

These cases cover the API. Browser forms and browser interaction tests are tracked separately.

| Requirement ID | Acceptance criterion                                                                                   | Test case IDs                                                                                              | Coverage    |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------- |
| REQ-PET-001    | Create a pet using the authenticated owner, normalize text and return the expected response fields     | TC-PET-001                                                                                                 | Implemented |
| REQ-PET-002    | Update supplied fields, preserve omitted fields and allow clearing optional fields with null           | TC-PET-002                                                                                                 | Implemented |
| REQ-PET-003    | Archive and restore the same pet without deleting data; separate active and archived lists             | TC-PET-003                                                                                                 | Implemented |
| REQ-PET-004    | Reject invalid archive filters, invalid profile input and client-supplied ownership or archive changes | TC-PET-004, TC-PET-005, TC-PET-006, TC-PET-007, TC-PET-008, TC-PET-009, TC-PET-010, TC-PET-011, TC-PET-012 | Implemented |
| REQ-PET-005    | Require an authenticated session for all pet endpoints                                                 | TC-PET-013                                                                                                 | Implemented |
| REQ-PET-006    | Prevent another account from listing, reading, updating, archiving or restoring owned pets             | TC-PET-014                                                                                                 | Implemented |
| REQ-PET-007    | Reject malformed pet IDs with 400 and return 404 for nonexistent pet IDs                               | TC-PET-015, TC-PET-016                                                                                     | Implemented |

### Pet test case index

| Test case ID | Scenario                                                          |
| ------------ | ----------------------------------------------------------------- |
| TC-PET-001   | Create a pet with normalized input and session ownership          |
| TC-PET-002   | Partially update a pet and clear optional fields                  |
| TC-PET-003   | Archive, list, read and restore a pet; repeat archive and restore |
| TC-PET-004   | Reject an invalid archived query                                  |
| TC-PET-005   | Reject a blank name                                               |
| TC-PET-006   | Reject an unsupported species                                     |
| TC-PET-007   | Reject zero weight                                                |
| TC-PET-008   | Reject weight with more than three decimal places                 |
| TC-PET-009   | Reject an invalid calendar date                                   |
| TC-PET-010   | Reject a future birth date                                        |
| TC-PET-011   | Reject a client-supplied owner during creation                    |
| TC-PET-012   | Reject invalid updates without changing stored data               |
| TC-PET-013   | Reject all pet endpoints without a session                        |
| TC-PET-014   | Prevent access and changes across accounts                        |
| TC-PET-015   | Reject malformed pet IDs                                          |
| TC-PET-016   | Reject nonexistent pet IDs                                        |

### Deferred booking integration

- Prevent archived pets from being used in new bookings.
- Preserve access to historical booking information after pet archival.
- Define which booking statuses block archival and handle concurrent booking and archival requests.

These booking rules are not implemented or covered by the current pet API tests.

## Maintenance

- Add the case ID to the corresponding automated test title.
- One automated test may cover multiple case IDs.
- Link test files after checking their current names and contents.
- Record execution evidence separately; do not infer results from coverage.
- Expand the matrix when each feature's acceptance criteria are confirmed.
