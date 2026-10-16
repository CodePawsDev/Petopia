# Petopia — Test Plan

Status: Draft
Release: V1 Grooming

## 1. Objective

Verify that customers can book grooming services and branch staff
can manage appointments and record payments correctly.

Prioritize access control, booking conflicts, service states
and payment integrity.

## 2. Scope

- Customer registration, login, session and logout
- Pet profiles and ownership
- Branches, services, pricing and groomer skills
- Working hours, breaks, closures and availability
- Booking with a specific groomer or any available groomer
- Cancellation and rescheduling
- Check-in, service start, completion and no-show
- On-site payment recording and receipt correction
- Main customer and staff interfaces

This scope describes planned V1 coverage.
It does not mean every feature is implemented or tested.

## 3. Out of Scope

- Other Petopia businesses
- Online payment, deposits, refunds and wallet
- Microservices and infrastructure load testing

## 4. Main Risks

| Risk | Priority | Main verification |
| --- | --- | --- |
| Access to another customer's data | High | API ownership tests |
| Staff actions outside their branch or permissions | High | API authorization tests |
| Concurrent bookings exceed capacity | High | Concurrent API tests with PostgreSQL |
| Invalid service-state transitions | High | State-transition tests |
| Duplicate or unauthorized payment records | High | API and database integration tests |
| Incorrect price or duration at boundaries | High | Boundary-value tests |
| Unclear loading, empty or error states | Medium | UI tests and exploratory testing |

## 5. Test Levels

- Unit: business rules and isolated failure handling
- API integration/E2E: HTTP behavior, sessions, permissions and database results
- Browser E2E: selected customer and staff journeys
- Exploratory: usability, unexpected actions and recovery

Booking concurrency must be verified against PostgreSQL.
Browser timing alone is insufficient evidence.

## 6. Environments

- Local development: petopia_dev
- Automated database tests: petopia_test
- CI: PostgreSQL service container

Never run automated cleanup against development or workplace databases.
Use synthetic test data and keep secrets out of Git.

## 7. Evidence

Record the tested commit, environment, command or steps,
expected result, actual result and evidence link.

Use Not Run until a test has actually been executed.
A passing test applies to the tested commit and environment.

## 8. Supporting Documents

- [Requirement traceability and case IDs](./traceability.md)
- [Test data](./test-data.md)
- [Bug report template](./bug-report-template.md)

### Ongoing Maintenance

- Expand requirement and test-case mappings as features are confirmed.
- Create planned fixtures alongside their feature tests.
- Record actual execution results with commit and environment evidence.
- Review coverage gaps before closing each feature.

## 9. Entry Criteria

Before testing a feature:

- Acceptance criteria and relevant business rules are confirmed.
- The implementation is available at an identified commit.
- The test environment and required migrations are ready.
- Required synthetic test data can be created.
- Test cases are linked to requirement IDs.
- Blocking dependencies are resolved or explicitly recorded.

If a prerequisite is missing, record the affected cases as Blocked.
Do not report them as passed.

## 10. Feature Exit Criteria

Before considering a feature verified:

- Tests for its acceptance criteria have been executed.
- All high-risk cases for the feature pass.
- Relevant automated checks pass on the tested commit.
- Fixes have been retested and affected scenarios checked for regression.
- No unresolved access-control breach, booking-capacity violation,
  payment corruption or main-flow failure remains.
- Other unresolved defects and limitations are documented with impact.
- Traceability and execution evidence are updated.

Passing checks for one feature does not mean the entire release is ready.

## 11. Release Exit Criteria

Before presenting V1 as a completed release:

- All committed V1 features meet their feature exit criteria.
- The main customer and staff journeys pass through the real system.
- Booking concurrency tests pass against PostgreSQL.
- Relevant browser E2E and exploratory testing are complete.
- Setup instructions work from a clean checkout.
- CI passes on the release commit.
- Test results, known limitations and release notes are available.

## 12. Test Execution Records

Keep execution results separate from test definitions.

For each recorded run, include:

- Run date
- Tested commit and any uncommitted changes
- Environment and relevant configuration
- Command or manual steps
- Test case IDs or suite names
- Outcome: Pass / Fail / Blocked / Not Run
- Evidence link
- Related defects, if any

A previous passing run is historical evidence.
It does not automatically verify later code changes.