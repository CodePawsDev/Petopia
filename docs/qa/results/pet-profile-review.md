# Pet Profile QA Review

## Test context

- Date: 2026-10-20
- Tested commit: 4517406444605b84e52322d0a674868d2c26d431
- Environment: local Windows development environment
- Automated test database: petopia_test
- Execution: developer-run checks, with results reported in the working session.

## Automated results

| Check | Result |
| --- | --- |
| API and web lint | Passed |
| API unit tests | 3 passed, 1 suite |
| API E2E tests | 61 passed, 5 suites |
| API and web production builds | Passed |

The E2E total includes all API test suites, not only pet tests.

Commands:

```cmd
npm run lint
npm test --workspace apps/api -- --runInBand
npm run test:e2e --workspace apps/api -- --runInBand
npm run build
```

## Manual browser results

All eight checks below were reported as passed by the developer.

| Check | Result |
| --- | --- |
| Create a pet and retain saved data after refresh | Passed |
| Edit a pet and clear optional fields | Passed |
| Show field-level errors for blank name, future birth date and invalid weight | Passed |
| Cancel archival using the cancel button or Escape | Passed |
| Archive a pet and find it in the archived list | Passed |
| Restore a pet with its existing data preserved | Passed |
| Check form, cards and dialog at approximately 375px width | Passed |
| Navigate the form and dialog using Tab with visible focus | Passed |

These are manual checks, not automated browser tests or a complete accessibility audit.

## Issues and retest

No issues were reported during this review.
Earlier validation-message and species-dropdown spacing fixes were included in the tested commit.

## Deferred coverage

The following require booking implementation and were not tested:

- Reading existing booking history after pet archival.
- Preventing archival while a pet has an unfinished booking.
- Preventing conflicts between concurrent booking and archival.

## Evidence

- Feature PR: https://github.com/CodePawsDev/Petopia/pull/23
- Feature PR CI: https://github.com/CodePawsDev/Petopia/actions/runs/39438063407
- Local automated results: terminal output shared in the working session.
- Manual results: developer confirmation in the working session.

The linked CI run tested the feature PR head.
The local results above apply to the tested merge commit.

## Conclusion

The implemented pet-profile flow passed the recorded automated and manual checks.
Booking integration remains deferred.