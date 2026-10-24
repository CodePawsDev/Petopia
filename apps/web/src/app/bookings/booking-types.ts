export type BookingStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type Booking = {
  id: string;
  status: BookingStatus;
  petName: string;
  startsAt: string;
  serviceEndsAt: string;
  timezone: 'Asia/Bangkok';
  currency: 'THB';
  totalPriceSatang: number;
  totalDurationMinutes: number;
  branch: {
    id: string;
    name: string;
  };
  groomer: {
    id: string;
    displayName: string;
  };
  items: {
    serviceId: string;
    name: string;
    priceSatang: number;
    durationMinutes: number;
  }[];
};

export type BookingList = {
  items: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const bookingStatusLabels: Record<BookingStatus, string> = {
  CONFIRMED: 'ยืนยันการจองแล้ว',
  COMPLETED: 'รับบริการเรียบร้อยแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาตามนัด',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    value === 'CONFIRMED' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED' ||
    value === 'NO_SHOW'
  );
}

function isBookingItem(value: unknown): value is Booking['items'][number] {
  return (
    isRecord(value) &&
    typeof value.serviceId === 'string' &&
    typeof value.name === 'string' &&
    isInteger(value.priceSatang, 0) &&
    isInteger(value.durationMinutes, 1)
  );
}

export function isBooking(value: unknown): value is Booking {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isBookingStatus(value.status) ||
    typeof value.petName !== 'string' ||
    !isDateTime(value.startsAt) ||
    !isDateTime(value.serviceEndsAt) ||
    Date.parse(value.serviceEndsAt) <= Date.parse(value.startsAt) ||
    value.timezone !== 'Asia/Bangkok' ||
    value.currency !== 'THB' ||
    !isInteger(value.totalPriceSatang, 0) ||
    !isInteger(value.totalDurationMinutes, 1) ||
    !isRecord(value.branch) ||
    typeof value.branch.id !== 'string' ||
    typeof value.branch.name !== 'string' ||
    !isRecord(value.groomer) ||
    typeof value.groomer.id !== 'string' ||
    typeof value.groomer.displayName !== 'string' ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    !value.items.every(isBookingItem)
  ) {
    return false;
  }

  return (
    new Set(value.items.map((item) => item.serviceId)).size ===
      value.items.length &&
    value.items.reduce((sum, item) => sum + item.priceSatang, 0) ===
      value.totalPriceSatang &&
    value.items.reduce((sum, item) => sum + item.durationMinutes, 0) ===
      value.totalDurationMinutes
  );
}

export function isBookingList(value: unknown): value is BookingList {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isBooking) ||
    !isRecord(value.pagination)
  ) {
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
