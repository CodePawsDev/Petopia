'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  bookingStatusLabels,
  paymentStatusLabels,
} from '../../../../../bookings/booking-types';
import {
  isBranchBookingList,
  type BranchBookingList,
} from './branch-booking-types';

type Workspace = 'manager' | 'groomer';

const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 font-semibold text-primary hover:border-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

export default function BranchBookingsView({
  branchId,
  workspace,
}: {
  branchId: string;
  workspace: Workspace;
}) {
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  function changeDate(value: string) {
    setDate(value);
    setPage(1);
  }

  return (
    <>
      <Link
        href={`/branches/${encodeURIComponent(branchId)}/workspaces/${workspace}`}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <span aria-hidden="true">←</span>
        กลับพื้นที่ทำงาน
      </Link>

      <section
        aria-labelledby="branch-bookings-heading"
        className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10"
      >
        <p className="mb-3 text-lg font-bold text-primary">Petopia</p>

        <h1
          id="branch-bookings-heading"
          className="text-2xl font-bold sm:text-3xl"
        >
          {workspace === 'manager' ? 'นัดหมายของสาขา' : 'นัดหมายของฉัน'}
        </h1>

        <p className="mt-2 text-sm leading-7 text-muted">
          {workspace === 'manager'
            ? 'ดูนัดหมายของช่างทุกคนในสาขาตามวันที่เลือก'
            : 'ดูเฉพาะนัดหมายที่คุณเป็นช่างผู้ให้บริการในสาขานี้'}{' '}
          เวลาแสดงตามประเทศไทย
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            วันที่นัดหมาย
            <input
              type="date"
              value={date}
              onChange={(event) => changeDate(event.target.value)}
              className="min-h-12 rounded-xl border border-border bg-surface px-3 text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </label>

          <button
            type="button"
            className={buttonClass}
            onClick={() => changeDate(bangkokToday())}
          >
            วันนี้
          </button>

          {date && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => setAttempt((value) => value + 1)}
            >
              โหลดใหม่
            </button>
          )}
        </div>

        {date ? (
          <BookingResults
            key={`${date}:${page}:${attempt}`}
            branchId={branchId}
            workspace={workspace}
            date={date}
            page={page}
            onPageChange={setPage}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        ) : (
          <p className="mt-7 rounded-2xl bg-surface-soft p-5 text-sm text-muted">
            เลือกวันที่ หรือกด “วันนี้” เพื่อดูนัดหมาย
          </p>
        )}
      </section>
    </>
  );
}

function BookingResults({
  branchId,
  workspace,
  date,
  page,
  onPageChange,
  onRetry,
}: {
  branchId: string;
  workspace: Workspace;
  date: string;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const [data, setData] = useState<BranchBookingList | null>(null);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const endpoint = workspace === 'manager' ? 'bookings' : 'my-bookings';
        const query = new URLSearchParams({
          date,
          page: String(page),
          limit: '10',
        });

        const response = await fetch(
          `/api/branches/${encodeURIComponent(branchId)}/${endpoint}?${query}`,
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
          setExpired(true);
          setError('กรุณาเข้าสู่ระบบเพื่อดูนัดหมาย');
          return;
        }

        if (response.status === 403) {
          setError('คุณไม่มีสิทธิ์ดูนัดหมายในพื้นที่ทำงานนี้');
          return;
        }

        if (response.status === 400 || response.status === 404) {
          setError('ไม่พบสาขาหรือข้อมูลวันที่ที่รองรับ กรุณาตรวจสอบอีกครั้ง');
          return;
        }

        if (!response.ok) {
          throw new Error('Booking request failed');
        }

        const result: unknown = await response.json();

        if (
          !isBranchBookingList(result) ||
          result.branch.id !== branchId ||
          result.date !== date ||
          result.pagination.page !== page ||
          result.pagination.limit !== 10
        ) {
          throw new Error('Invalid branch booking response');
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('โหลดนัดหมายไม่สำเร็จ กรุณาลองอีกครั้ง');
          setCanRetry(true);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [branchId, workspace, date, page]);

  if (error) {
    return (
      <div className="mt-7 rounded-2xl border border-danger/30 p-5">
        <p role="alert" className="text-sm leading-7 text-danger">
          {error}
        </p>

        {expired && (
          <a
            href="/login"
            className="mt-4 inline-flex min-h-11 items-center text-primary underline"
          >
            เข้าสู่ระบบ
          </a>
        )}

        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`${buttonClass} mt-4`}
          >
            ลองอีกครั้ง
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <p role="status" className="mt-7 text-sm text-muted">
        กำลังโหลดนัดหมาย…
      </p>
    );
  }

  return (
    <div className="mt-7">
      <h2 className="text-lg font-semibold">{data.branch.name}</h2>
      <p role="status" className="mt-2 text-sm text-muted">
        พบ {data.pagination.total} รายการ
      </p>

      {data.items.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-surface-soft p-5 text-sm text-muted">
          {data.pagination.total === 0
            ? 'ยังไม่มีรายการนัดหมายในวันที่เลือก'
            : 'ไม่มีรายการในหน้านี้ กรุณากลับไปหน้าแรก'}
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {data.items.map((booking) => (
            <li
              key={booking.id}
              className="rounded-2xl border border-border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="break-words text-lg font-semibold">
                    {booking.petName}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {formatTime(booking.startsAt)}–
                    {formatTime(booking.serviceEndsAt)} น.
                  </p>
                </div>
                <span className="rounded-lg bg-surface-soft px-3 py-2 text-sm font-medium">
                  {bookingStatusLabels[booking.status]}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">เจ้าของ</dt>
                  <dd className="mt-1 break-words">
                    {booking.owner.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ช่างผู้ให้บริการ</dt>
                  <dd className="mt-1 break-words">
                    {booking.groomer.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ระยะเวลาบริการ</dt>
                  <dd className="mt-1">{booking.totalDurationMinutes} นาที</dd>
                </div>

                <div>
                  <dt className="text-muted">สถานะชำระเงิน</dt>
                  <dd className="mt-1 font-semibold">
                    {paymentStatusLabels[booking.paymentStatus]}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted">สิ้นสุดช่วงเผื่อเวลา</dt>
                  <dd className="mt-1">
                    {formatTime(booking.occupiedEndsAt)} น.
                  </dd>
                </div>
              </dl>

              <details className="mt-4 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  รายละเอียดบริการ
                </summary>
                <ul className="mt-3 space-y-2">
                  {booking.items.map((item) => (
                    <li
                      key={item.serviceId}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="break-words">
                        {item.name} · {item.durationMinutes} นาที
                      </span>
                      <span className="shrink-0">
                        {priceFormatter.format(item.priceSatang / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>

              <p className="mt-4 text-right font-semibold">
                รวม {priceFormatter.format(booking.totalPriceSatang / 100)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {data.pagination.totalPages > 0 && (
        <nav
          aria-label="หน้ารายการนัดหมาย"
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            aria-label="หน้าก่อนหน้า"
            className={buttonClass}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </button>

          <span className="text-sm">
            หน้า {page} / {data.pagination.totalPages}
          </span>

          <button
            type="button"
            aria-label="หน้าถัดไป"
            className={buttonClass}
            disabled={page >= data.pagination.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </button>

          {page > data.pagination.totalPages && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => onPageChange(1)}
            >
              กลับหน้าแรก
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
