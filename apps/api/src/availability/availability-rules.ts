export const SLOT_INTERVAL_MINUTES = 15;
export const BUFFER_MINUTES = 15;
export const MINIMUM_LEAD_MINUTES = 120;
export const BOOKING_HORIZON_DAYS = 30;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export type AvailableSlot = {
  startsAt: Date;
  serviceEndsAt: Date;
  occupiedEndsAt: Date;
};

type CalculateSlotsInput = {
  now: Date;
  serviceDurationMinutes: number;
  workingIntervals: TimeRange[];
  blockedIntervals: TimeRange[];
};

function isValidRange(range: TimeRange): boolean {
  return (
    Number.isFinite(range.startsAt.getTime()) &&
    Number.isFinite(range.endsAt.getTime()) &&
    range.startsAt.getTime() < range.endsAt.getTime()
  );
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return (
    a.startsAt.getTime() < b.endsAt.getTime() &&
    b.startsAt.getTime() < a.endsAt.getTime()
  );
}

export function calculateAvailableSlots({
  now,
  serviceDurationMinutes,
  workingIntervals,
  blockedIntervals,
}: CalculateSlotsInput): AvailableSlot[] {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isSafeInteger(serviceDurationMinutes) ||
    serviceDurationMinutes <= 0
  ) {
    throw new Error('Invalid availability calculation input');
  }

  if (
    !workingIntervals.every(isValidRange) ||
    !blockedIntervals.every(isValidRange)
  ) {
    throw new Error('Invalid availability interval');
  }

  const earliestStart = now.getTime() + MINIMUM_LEAD_MINUTES * MINUTE_MS;
  const latestStart = now.getTime() + BOOKING_HORIZON_DAYS * DAY_MS;

  const stepMs = SLOT_INTERVAL_MINUTES * MINUTE_MS;
  const serviceMs = serviceDurationMinutes * MINUTE_MS;
  const occupiedMs = (serviceDurationMinutes + BUFFER_MINUTES) * MINUTE_MS;

  if (!Number.isSafeInteger(occupiedMs)) {
    throw new Error('Service duration is too large');
  }

  const slots = new Map<number, AvailableSlot>();

  for (const working of workingIntervals) {
    const firstPossibleStart = Math.max(
      working.startsAt.getTime(),
      earliestStart,
    );

    // Asia/Bangkok's UTC+07:00 offset aligns with 15-minute UTC boundaries.
    // This calculation is currently restricted to Asia/Bangkok.
    const firstStart = Math.ceil(firstPossibleStart / stepMs) * stepMs;

    const lastStart = Math.min(
      working.endsAt.getTime() - occupiedMs,
      latestStart,
    );

    for (let startMs = firstStart; startMs <= lastStart; startMs += stepMs) {
      const occupied: TimeRange = {
        startsAt: new Date(startMs),
        endsAt: new Date(startMs + occupiedMs),
      };

      if (
        blockedIntervals.some((blocked) => rangesOverlap(occupied, blocked))
      ) {
        continue;
      }

      slots.set(startMs, {
        startsAt: occupied.startsAt,
        serviceEndsAt: new Date(startMs + serviceMs),
        occupiedEndsAt: occupied.endsAt,
      });
    }
  }

  return [...slots.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}
