# Petopia — Test Data

## Principles

- Use synthetic data only.
- Automated tests use petopia_test.
- Generate unique emails and IDs for each test run.
- Create only the fixtures required by each test.
- Clean up records created by that test; preserve unrelated data.
- Never commit real passwords, session cookies or environment secrets.

## Existing Fixtures

| Data | Current use |
| --- | --- |
| Unique registration payload | Registration and validation tests |
| Active customer | Login, current-user and logout tests |
| Unknown email | Invalid-credentials tests |
| Deactivated customer | Existing-session rejection test |
| Changed authVersion | Old-session invalidation test |
| GROOMING-ARI and GROOMING-ONNUT | Development seed branches |

Existing authentication tests create their own users.
Development seed data is not a substitute for isolated test fixtures.

## Planned Fixtures

These fixtures are planned and are not yet implemented.

| Fixture | Purpose |
| --- | --- |
| Customer A and Customer B | Verify ownership isolation |
| Pet A owned by Customer A | Owner access and booking |
| Pet B owned by Customer B | Reject access by another customer |
| Archived pet | Verify archive and booking restrictions |
| Branch A and Branch B | Verify branch isolation |
| Groomer A assigned to Branch A | Allowed staff actions |
| Groomer B assigned to Branch B | Reject cross-branch actions |
| Manager A assigned to Branch A | Branch management actions |
| Staff with RECEIVE_PAYMENT grant | Verify payment permission |
| Staff without RECEIVE_PAYMENT grant | Reject unauthorized payment |
| Service and eligible groomer | Valid booking |
| Ineligible groomer | Reject unsupported service assignment |
| Shift, break and closure | Availability rules |
| Existing booking | Conflicts and capacity checks |

## Boundary Data

Define exact values from confirmed requirements before implementation.

- Weight: below, at and above each pricing boundary
- Time: before, at and after booking or rescheduling cutoffs
- Availability: shift edges, breaks, closures and buffer boundaries
- State: allowed and rejected service transitions
- Payment: correct amount, incorrect amount and duplicate submission

## Concurrent Requests

Use isolated fixtures and verify both HTTP responses and database state.

Planned scenarios:
- Two requests for the same specific groomer and overlapping time
- Any-groomer request competing with a specific-groomer request
- Two any-groomer requests competing for limited capacity
- Duplicate booking submission
- Duplicate payment submission

## Cleanup

- Track fixture IDs or unique test-run identifiers.
- Delete dependent records before their parent records when required.
- Restore shared account state in finally blocks.
- Close the Nest application and database connections after the suite.