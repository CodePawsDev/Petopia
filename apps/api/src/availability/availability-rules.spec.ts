import {
  calculateAvailableSlots,
  rangesOverlap,
  type TimeRange,
} from './availability-rules';

function range(startsAt: string, endsAt: string): TimeRange {
  return {
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
  };
}

describe('Availability rules', () => {
  const now = new Date('2026-11-01T00:00:00+07:00');

  it('adds one buffer after the total service duration', () => {
    const slots = calculateAvailableSlots({
      now,
      serviceDurationMinutes: 55,
      workingIntervals: [
        range('2026-11-02T09:00:00+07:00', '2026-11-02T12:00:00+07:00'),
      ],
      blockedIntervals: [],
    });

    expect(slots[0]).toEqual({
      startsAt: new Date('2026-11-02T09:00:00+07:00'),
      serviceEndsAt: new Date('2026-11-02T09:55:00+07:00'),
      occupiedEndsAt: new Date('2026-11-02T10:10:00+07:00'),
    });
  });

  it('keeps the full service and buffer inside one working interval', () => {
    const slots = calculateAvailableSlots({
      now,
      serviceDurationMinutes: 45,
      workingIntervals: [
        range('2026-11-02T09:00:00+07:00', '2026-11-02T12:00:00+07:00'),
        range('2026-11-02T13:00:00+07:00', '2026-11-02T18:00:00+07:00'),
      ],
      blockedIntervals: [],
    });

    const starts = slots.map((slot) => slot.startsAt.toISOString());

    expect(starts).toContain(
      new Date('2026-11-02T11:00:00+07:00').toISOString(),
    );
    expect(starts).not.toContain(
      new Date('2026-11-02T11:15:00+07:00').toISOString(),
    );
    expect(starts).toContain(
      new Date('2026-11-02T13:00:00+07:00').toISOString(),
    );

    expect(slots[slots.length - 1].occupiedEndsAt).toEqual(
      new Date('2026-11-02T18:00:00+07:00'),
    );
  });

  it('rejects a slot when only its buffer overlaps a blocked interval', () => {
    const slots = calculateAvailableSlots({
      now,
      serviceDurationMinutes: 55,
      workingIntervals: [
        range('2026-11-02T09:00:00+07:00', '2026-11-02T12:00:00+07:00'),
      ],
      blockedIntervals: [
        range('2026-11-02T10:00:00+07:00', '2026-11-02T10:30:00+07:00'),
      ],
    });

    expect(
      slots.some(
        (slot) =>
          slot.startsAt.getTime() ===
          new Date('2026-11-02T09:00:00+07:00').getTime(),
      ),
    ).toBe(false);

    expect(slots[0].startsAt).toEqual(new Date('2026-11-02T10:30:00+07:00'));
  });

  it('allows adjacent ranges without treating them as overlapping', () => {
    expect(
      rangesOverlap(
        range('2026-11-02T09:00:00+07:00', '2026-11-02T10:00:00+07:00'),
        range('2026-11-02T10:00:00+07:00', '2026-11-02T11:00:00+07:00'),
      ),
    ).toBe(false);
  });

  it('includes the exact two-hour lead-time boundary', () => {
    const slots = calculateAvailableSlots({
      now: new Date('2026-11-02T07:00:00+07:00'),
      serviceDurationMinutes: 45,
      workingIntervals: [
        range('2026-11-02T09:00:00+07:00', '2026-11-02T12:00:00+07:00'),
      ],
      blockedIntervals: [],
    });

    expect(slots[0].startsAt).toEqual(new Date('2026-11-02T09:00:00+07:00'));
  });

  it('rounds the earliest eligible start up to the next clock boundary', () => {
    const slots = calculateAvailableSlots({
      now: new Date('2026-11-02T07:00:01+07:00'),
      serviceDurationMinutes: 45,
      workingIntervals: [
        range('2026-11-02T09:00:00+07:00', '2026-11-02T12:00:00+07:00'),
      ],
      blockedIntervals: [],
    });

    expect(slots[0].startsAt).toEqual(new Date('2026-11-02T09:15:00+07:00'));
  });

  it('includes the exact 30-day start boundary and excludes later starts', () => {
    const slots = calculateAvailableSlots({
      now: new Date('2026-11-01T09:00:00+07:00'),
      serviceDurationMinutes: 45,
      workingIntervals: [
        range('2026-12-01T09:00:00+07:00', '2026-12-01T12:00:00+07:00'),
      ],
      blockedIntervals: [],
    });

    expect(slots).toEqual([
      {
        startsAt: new Date('2026-12-01T09:00:00+07:00'),
        serviceEndsAt: new Date('2026-12-01T09:45:00+07:00'),
        occupiedEndsAt: new Date('2026-12-01T10:00:00+07:00'),
      },
    ]);
  });

  it('returns no slots when the whole working interval is blocked', () => {
    const working = range(
      '2026-11-02T09:00:00+07:00',
      '2026-11-02T18:00:00+07:00',
    );

    expect(
      calculateAvailableSlots({
        now,
        serviceDurationMinutes: 45,
        workingIntervals: [working],
        blockedIntervals: [working],
      }),
    ).toEqual([]);
  });

  it('rejects an invalid service duration', () => {
    expect(() =>
      calculateAvailableSlots({
        now,
        serviceDurationMinutes: 0,
        workingIntervals: [],
        blockedIntervals: [],
      }),
    ).toThrow('Invalid availability calculation input');
  });
});
