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

## Availability rules

- Demo branches operate from 09:00 to 18:00 in Asia/Bangkok.
- Appointment starts follow 15-minute clock boundaries: :00, :15, :30 and :45.
- Service durations are taken from the current catalog and are not rounded to 15-minute increments.
- One appointment is for one pet at one branch.
- Multiple distinct services may be selected according to catalog selection rules.
- One groomer performs all selected services sequentially.
- The groomer must have active eligibility for the pet species and every selected service.
- The groomer's account, branch assignment, branch and business unit must be active.
- Selected services and applicable rates must also be active.

## Buffer and occupied intervals

- Add one 15-minute buffer after the total service duration.
- Do not add a separate buffer for each service.
- Customer-facing service duration excludes the buffer.
- The occupied interval includes its start and excludes its end.
- The complete service and buffer must fit within one continuous working interval.
- The occupied interval must not overlap breaks, groomer time off, branch closures or blocking bookings.
- Groomer time off applies across all branches.
- Branch closures may cover a full day or part of a day.
- Adjacent occupied intervals are allowed.
- Example: a 09:00 appointment with 55 minutes of services occupies the groomer until 10:10. The next eligible clock boundary is 10:15, subject to other availability rules.

## Booking window

- Use the server's current time.
- Appointment starts must be at least two hours ahead.
- Appointment starts must be no more than 30 days ahead.
- Both boundaries are inclusive.
- Thirty days means 30 times 24 hours, not the end of the thirtieth calendar day.
- Evaluate the time consistently within a request and recheck it when creating a booking.

## Availability and booking consistency

- Availability results do not reserve a slot.
- Availability and booking creation must share the same eligibility and time rules.
- Booking creation must recheck current data and assign the groomer atomically.
- Schedule, time-off and closure changes must reject conflicts with existing blocking bookings once booking integration is implemented.
- Changes must not silently move or cancel existing bookings.
- Groomer time-off changes must invalidate affected availability across branches; the originating branch's scheduleVersion alone is insufficient.

## Remaining implementation

- Groomer eligibility data by species and service.
- Branch closure data.
- Availability calculation and read API.
- Booking integration and conflict protection.
- Cross-branch availability invalidation if availability is cached.
- Travel buffers between branches remain deferred.

## Unresolved rabbit assessment workflow

- Rabbit catalog rates currently require assessment.
- Whether assessment occurs before booking submission or before confirmation remains unresolved.
- Availability must not be presented as approval to automatically confirm an assessment-required booking.
- Resolve this workflow before implementing rabbit booking confirmation.
