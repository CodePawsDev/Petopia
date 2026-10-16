# Bug Report Template

Use this template for actual defects.
Do not invent defects or mark a fix as verified before retesting.

## Title

Short description of the observed failure.

## References

- Requirement ID:
- Test case ID:
- Related issue or PR:

## Environment

- Commit:
- Environment: local / CI / demo
- Browser and version, if relevant:
- OS, if relevant:

## Severity

Choose one and explain the impact:

- Critical: data loss, access-control breach or payment corruption
- Major: main flow fails or produces incorrect results
- Minor: limited impact with a practical workaround
- Cosmetic: presentation issue without functional impact

## Priority

- High / Medium / Low
- Reason:

Severity describes impact.
Priority describes how urgently the defect should be fixed.

## Preconditions and Test Data

Describe the required state and synthetic test data.
Exclude passwords, session cookies and other secrets.

## Steps to Reproduce

1.
2.
3.

## Expected Result

Describe the result required by the acceptance criterion.

## Actual Result

Describe what happened.

## Reproducibility

Number of failures / number of attempts.

## Evidence

Attach relevant screenshots, sanitized requests/responses or logs.

## Fix

- Fix PR or commit:
- Explanation:

## Retest

- Tested commit:
- Steps or command:
- Actual result:
- Outcome: Not Run / Pass / Fail / Blocked
- Evidence:

## Regression

Record related scenarios checked after the fix and their results.