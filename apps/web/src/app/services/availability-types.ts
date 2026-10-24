import { isServiceQuote, type ServiceQuote } from './quote-types';

export type AvailabilitySlot = {
  startsAt: string;
  serviceEndsAt: string;
  occupiedEndsAt: string;
};

export type AvailableGroomer = {
  id: string;
  displayName: string;
  slots: AvailabilitySlot[];
};

export type AvailabilityResult = {
  date: string;
  timezone: 'Asia/Bangkok';
  quote: ServiceQuote;
  reason:
    | 'AVAILABLE'
    | 'NO_AVAILABLE_SLOTS'
    | 'NO_ELIGIBLE_GROOMERS'
    | 'ASSESSMENT_REQUIRED';
  groomers: AvailableGroomer[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /Z$|[+-]\d{2}:\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isSlot(value: unknown): value is AvailabilitySlot {
  return (
    isRecord(value) &&
    isDateTime(value.startsAt) &&
    isDateTime(value.serviceEndsAt) &&
    isDateTime(value.occupiedEndsAt) &&
    Date.parse(value.startsAt) < Date.parse(value.serviceEndsAt) &&
    Date.parse(value.serviceEndsAt) <= Date.parse(value.occupiedEndsAt)
  );
}

function isGroomer(value: unknown): value is AvailableGroomer {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.slots) &&
    value.slots.every(isSlot)
  );
}

export function isAvailabilityResult(
  value: unknown,
): value is AvailabilityResult {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    value.timezone === 'Asia/Bangkok' &&
    isServiceQuote(value.quote) &&
    (value.reason === 'AVAILABLE' ||
      value.reason === 'NO_AVAILABLE_SLOTS' ||
      value.reason === 'NO_ELIGIBLE_GROOMERS' ||
      value.reason === 'ASSESSMENT_REQUIRED') &&
    Array.isArray(value.groomers) &&
    value.groomers.every(isGroomer)
  );
}
