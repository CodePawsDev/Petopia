import { isBooking, type Booking } from '../../../../../bookings/booking-types';

export type BranchBooking = Omit<Booking, 'branch'> & {
  owner: {
    id: string;
    displayName: string;
  };
  occupiedEndsAt: string;
};

export type BranchBookingList = {
  date: string;
  timezone: 'Asia/Bangkok';
  branch: {
    id: string;
    code: string;
    name: string;
    timezone: 'Asia/Bangkok';
  };
  items: BranchBooking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
}

function isBranchBooking(
  value: unknown,
  branch: BranchBookingList['branch'],
): value is BranchBooking {
  if (
    !isRecord(value) ||
    !isBooking({ ...value, branch }) ||
    !isRecord(value.owner) ||
    typeof value.owner.id !== 'string' ||
    typeof value.owner.displayName !== 'string' ||
    typeof value.occupiedEndsAt !== 'string' ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(value.occupiedEndsAt) ||
    !Number.isFinite(Date.parse(value.occupiedEndsAt)) ||
    typeof value.serviceEndsAt !== 'string'
  ) {
    return false;
  }

  return (
    Date.parse(value.occupiedEndsAt) ===
    Date.parse(value.serviceEndsAt) + 15 * 60_000
  );
}

export function isBranchBookingList(
  value: unknown,
): value is BranchBookingList {
  if (
    !isRecord(value) ||
    typeof value.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    value.timezone !== 'Asia/Bangkok' ||
    !isRecord(value.branch) ||
    typeof value.branch.id !== 'string' ||
    typeof value.branch.code !== 'string' ||
    typeof value.branch.name !== 'string' ||
    value.branch.timezone !== 'Asia/Bangkok' ||
    !Array.isArray(value.items) ||
    !isRecord(value.pagination)
  ) {
    return false;
  }

  const branch: BranchBookingList['branch'] = {
    id: value.branch.id,
    code: value.branch.code,
    name: value.branch.name,
    timezone: 'Asia/Bangkok',
  };

  if (!value.items.every((item) => isBranchBooking(item, branch))) {
    return false;
  }

  const pagination = value.pagination;

  return (
    isInteger(pagination.page, 1) &&
    isInteger(pagination.limit, 1) &&
    pagination.limit <= 100 &&
    isInteger(pagination.total, 0) &&
    isInteger(pagination.totalPages, 0) &&
    pagination.totalPages === Math.ceil(pagination.total / pagination.limit) &&
    value.items.length <= pagination.limit &&
    new Set(value.items.map((item) => item.id)).size === value.items.length
  );
}
