# Groomer Schedule Rules

Status: Agreed for initial implementation

## Scope

- Demo branches operate from 09:00 to 18:00 in Asia/Bangkok.
- Opening hours do not automatically make every groomer available.
- Branch managers manage schedules only within their authorized branches.
- Schedules can be assigned only to active GROOMER assignments.
- The groomer, branch and business unit must also be active.

## Weekly working intervals

- Weekly schedules define working intervals for each weekday.
- A weekday can contain multiple intervals to accommodate staggered breaks.
- Breaks are represented by gaps between working intervals.
- A weekday without intervals is a non-working day.
- Intervals must start before they end and stay within 09:00–18:00.
- Overnight intervals are not supported.
- Intervals use inclusive starts and exclusive ends.
- Adjacent intervals are permitted.
- A groomer's working intervals must not overlap, including across branches.
- Cross-branch weekly overlap checks initially assume Asia/Bangkok for all branches.
- Schedule changes apply immediately; future-dated schedule versions are deferred.

## Time off

- Time off can cover a full day or part of a day.
- Time off belongs to the groomer and blocks availability across branches.
- A manager can manage time off only for groomers assigned to their branch.
- Time-off records retain the branch in which they were managed.
- Managers cannot modify another branch's time-off records.
- Time-off reasons are optional and are not exposed through public availability APIs.

## Availability and booking integration

- A service appointment must fit entirely within one continuous working interval.
- Appointments cannot span breaks, time off or existing blocking bookings.
- Total appointment duration is the sum of selected service durations.
- A booking may end exactly when a working interval ends.
- This increment implements schedule management APIs only.
- Availability search, booking creation and booking conflict protection follow separately.
- Before booking integration, define how schedule changes interact with existing bookings.

## Deferred decisions

- Slot start-time increments and booking lead time.
- Booking horizon and travel buffers between branches.
- Rabbit assessment and confirmation workflow.
- Schedule changes must not silently invalidate existing bookings.
