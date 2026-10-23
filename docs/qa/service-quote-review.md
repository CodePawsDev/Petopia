# Service Quote QA Review

## Test context

- Date: 2026-10-23
- Tested commit: c874885f0f9c7b0cfe2740a145662f4bc96ae16f
- Environment: local Windows development environment
- Next.js: 16.4.2
- Automated test database: petopia_test
- Execution: commands and manual browser checks performed by the developer; results reported in the working session.

## Automated results

| Check                         | Result              |
| ----------------------------- | ------------------- |
| API and web lint              | Passed              |
| API unit tests                | 3 passed, 1 suite   |
| API E2E tests                 | 95 passed, 7 suites |
| API and web production builds | Passed              |

The E2E total covers the full API regression suite, not quote tests alone.

Commands:

```cmd
npm run lint
npm test --workspace apps/api -- --runInBand
npm run test:e2e
npm run build
```

## Manual browser results

| Check                        | Expected result                                                                                     | Result |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| Multiple-service calculation | A 5 kg dog with bath and nail trimming totals THB 400 and 55 minutes using demo rates               | Passed |
| Branch change                | Selected pet is preserved; selected services and previous quote are cleared                         | Passed |
| Edit pet from services       | Saving returns to services with the same branch and pet selected; updated weight is used            | Passed |
| Pet ownership                | Another account cannot view the pet's data through its edit URL                                     | Passed |
| Guest access                 | Guests can browse estimated prices and see a login prompt; authenticated pet quoting is unavailable | Passed |

## Scope and limitations

- Prices and durations are fictional demo data.
- Quotes calculate prices and durations; they do not create bookings or reserve availability.
- Rabbit assessment rules remain pending business clarification before booking implementation.
- Browser checks were manual; this review does not add automated browser tests.

## Conclusion

All automated checks and the five manual browser scenarios listed above passed for the tested commit.
