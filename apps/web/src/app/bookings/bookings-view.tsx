'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CancelBooking from './cancel-booking';
import {
  bookingStatusLabels,
  paymentStatusLabels,
  isBookingList,
  type BookingList,
} from './booking-types';

const PAGE_SIZE = 10;

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

const buttonClass =
  'min-h-12 rounded-xl border border-primary px-4 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'expired' }
  | { status: 'success'; data: BookingList };

export default function BookingsView() {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  return (
    <BookingResults
      key={`${page}:${attempt}`}
      page={page}
      onPageChange={setPage}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function BookingResults({
  page,
  onPageChange,
  onRetry,
}: {
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function loadBookings() {
      try {
        const response = await fetch(
          `/api/bookings?page=${page}&limit=${PAGE_SIZE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15_000),
            ]),
          },
        );

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setState({ status: 'expired' });
          return;
        }

        if (!response.ok) {
          throw new Error('Booking list request failed');
        }

        const result: unknown = await response.json();

        if (
          !isBookingList(result) ||
          result.pagination.page !== page ||
          result.pagination.limit !== PAGE_SIZE
        ) {
          throw new Error('Invalid booking list response');
        }

        if (!controller.signal.aborted) {
          setState({ status: 'success', data: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: 'error' });
        }
      }
    }

    void loadBookings();

    return () => controller.abort();
  }, [page]);

  if (state.status === 'loading') {
    return (
      <p
        role="status"
        className="mt-7 rounded-2xl bg-surface-soft p-6 text-muted"
      >
        กำลังโหลดรายการจอง…
      </p>
    );
  }

  if (state.status === 'expired') {
    return (
      <section className="mt-7 rounded-2xl border border-border bg-surface p-6">
        <p role="alert">กรุณาเข้าสู่ระบบเพื่อดูการจองของคุณ</p>
        <Link href="/login" className={`${buttonClass} mt-4 inline-flex`}>
          เข้าสู่ระบบ
        </Link>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="mt-7 rounded-2xl border border-border bg-surface p-6">
        <p role="alert" className="text-danger">
          โหลดรายการจองไม่สำเร็จ กรุณาลองอีกครั้ง
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={`${buttonClass} mt-4`}
        >
          ลองอีกครั้ง
        </button>
      </section>
    );
  }

  const { items, pagination } = state.data;

  if (pagination.total === 0) {
    return (
      <section className="mt-7 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-bold">ยังไม่มีรายการจอง</h2>
        <p className="mt-2 text-sm text-muted">
          เลือกสาขาและบริการสำหรับสัตว์เลี้ยงเพื่อเริ่มจอง
        </p>
        <Link href="/services" className={`${buttonClass} mt-5 inline-flex`}>
          เลือกสาขาและบริการ
        </Link>
      </section>
    );
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">
          ทั้งหมด {pagination.total} รายการ
        </p>
        <button type="button" onClick={onRetry} className={buttonClass}>
          โหลดข้อมูลล่าสุด
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-surface-soft p-6">
          ไม่มีรายการในหน้านี้ กรุณากลับไปหน้าก่อนหน้า
        </p>
      ) : (
        <ul className="mt-5 space-y-5">
          {items.map((booking) => (
            <li
              key={booking.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-bold">
                    {booking.petName}
                  </h2>
                  <p className="mt-1 break-words text-sm text-muted">
                    {booking.branch.name}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    booking.status === 'CONFIRMED'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-soft text-foreground'
                  }`}
                >
                  {bookingStatusLabels[booking.status]}
                </span>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">วันที่นัดหมาย</dt>
                  <dd className="mt-1 font-semibold">
                    {dateFormatter.format(new Date(booking.startsAt))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">เวลารับบริการ</dt>
                  <dd className="mt-1 font-semibold">
                    {timeFormatter.format(new Date(booking.startsAt))}
                    {' – '}
                    {timeFormatter.format(new Date(booking.serviceEndsAt))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ช่างที่เลือก</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {booking.groomer.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ราคารวม</dt>
                  <dd className="mt-1 font-semibold text-primary">
                    {moneyFormatter.format(booking.totalPriceSatang / 100)}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted">สถานะชำระเงิน</dt>
                  <dd className="mt-1 font-semibold">
                    {paymentStatusLabels[booking.paymentStatus]}
                  </dd>
                </div>
              </dl>

              <details className="mt-5 border-t border-border pt-4">
                <summary className="cursor-pointer rounded-lg py-2 font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  รายละเอียดบริการ
                </summary>

                <ul className="mt-3 space-y-3">
                  {booking.items.map((item) => (
                    <li
                      key={item.serviceId}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.name}</p>
                        <p className="mt-1 text-muted">
                          {item.durationMinutes} นาที
                        </p>
                      </div>
                      <span className="shrink-0">
                        {moneyFormatter.format(item.priceSatang / 100)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm text-muted">
                  ระยะเวลารับบริการรวม {booking.totalDurationMinutes} นาที
                </p>
                <p className="mt-2 break-all text-xs text-muted">
                  รหัสการจอง: {booking.id}
                </p>
              </details>

              {booking.status === 'CONFIRMED' && (
                <>
                  {booking.paymentStatus === 'UNPAID' && (
                    <p className="mt-4 text-sm text-muted">
                      ชำระค่าบริการที่สาขา
                    </p>
                  )}

                  <CancelBooking
                    bookingId={booking.id}
                    petName={booking.petName}
                    startsAt={booking.startsAt}
                    onCancelled={onRetry}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <nav
        aria-label="หน้ารายการจอง"
        className="mt-6 flex items-center justify-center gap-3"
      >
        <button
          type="button"
          aria-label="หน้าก่อนหน้า"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:border-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true" className="text-2xl">
            ‹
          </span>
        </button>

        <p className="text-sm text-muted">
          หน้า {page} จาก {pagination.totalPages}
        </p>

        <button
          type="button"
          aria-label="หน้าถัดไป"
          disabled={page >= pagination.totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:border-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true" className="text-2xl">
            ›
          </span>
        </button>
      </nav>
    </div>
  );
}
