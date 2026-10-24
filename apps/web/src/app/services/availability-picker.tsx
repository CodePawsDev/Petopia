'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  isAvailabilityResult,
  type AvailabilityResult,
  type AvailabilitySlot,
} from './availability-types';
import type { ServiceQuote } from './quote-types';
import BookingReview from './booking-review';
import BookingConfirmation from './booking-confirmation';
import { useBookingFlow } from './booking-flow';

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const reasonMessages = {
  AVAILABLE: '',
  NO_AVAILABLE_SLOTS: 'ไม่มีเวลาว่างในวันที่เลือก กรุณาลองวันอื่น',
  NO_ELIGIBLE_GROOMERS:
    'ยังไม่มีช่างที่รองรับบริการที่เลือกครบ กรุณาติดต่อสาขา',
  ASSESSMENT_REQUIRED: 'บริการนี้ต้องให้เจ้าหน้าที่ประเมินก่อน กรุณาติดต่อสาขา',
};

type Selection = {
  groomerId: string | undefined;
  groomerName: string;
  slot: AvailabilitySlot;
};

export default function AvailabilityPicker({ quote }: { quote: ServiceQuote }) {
  const { phase } = useBookingFlow();
  const bookingLocked = phase !== 'idle';
  const dateId = useId();
  const [date, setDate] = useState('');
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  async function search() {
    if (requestRef.current || sessionExpired || bookingLocked) return;

    setError('');
    setSelected(null);
    setResult(null);

    if (!date) {
      setError('กรุณาเลือกวันที่ต้องการใช้บริการ');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setIsPending(true);

    try {
      const response = await fetch('/api/availability/search', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: quote.branch.id,
          petId: quote.pet.id,
          serviceIds: quote.items.map((item) => item.serviceId),
          date,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setSessionExpired(true);
        setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
        return;
      }

      if (response.status === 400 || response.status === 404) {
        setError(
          'กรุณาตรวจสอบวันที่ หากข้อมูลสัตว์เลี้ยงหรือบริการเปลี่ยน กรุณาโหลดหน้าใหม่',
        );
        return;
      }

      if (!response.ok) {
        throw new Error('Availability request failed');
      }

      const data: unknown = await response.json();
      const serviceIds = new Set(quote.items.map((item) => item.serviceId));

      if (
        !isAvailabilityResult(data) ||
        data.date !== date ||
        data.quote.branch.id !== quote.branch.id ||
        data.quote.pet.id !== quote.pet.id ||
        data.quote.items.length !== serviceIds.size ||
        !data.quote.items.every((item) => serviceIds.has(item.serviceId))
      ) {
        throw new Error('Invalid availability response');
      }

      if (!controller.signal.aborted) {
        setResult(data);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError('ค้นหาเวลาว่างไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;

        if (!controller.signal.aborted) {
          setIsPending(false);
        }
      }
    }
  }
  const anySlots = [
    ...new Map(
      (result?.groomers ?? []).flatMap((groomer) =>
        groomer.slots.map((slot): [string, AvailabilitySlot] => [
          slot.startsAt,
          slot,
        ]),
      ),
    ).values(),
  ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <section className="mt-6 border-t border-border pt-6">
      <h3 className="text-xl font-bold">เลือกวันและเวลา</h3>
      <p className="mt-2 text-sm text-muted">
        จองล่วงหน้าอย่างน้อย 2 ชั่วโมง และไม่เกิน 30 วัน
        เวลาทั้งหมดแสดงตามเวลาประเทศไทย
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={dateId} className="mb-2 block font-medium">
            วันที่ใช้บริการ
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            disabled={bookingLocked || isPending || sessionExpired}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${dateId}-error` : undefined}
            onChange={(event) => {
              setDate(event.target.value);
              setResult(null);
              setSelected(null);
              setError('');
            }}
            className="min-h-12 rounded-xl border border-input-border bg-surface px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => void search()}
          disabled={bookingLocked || isPending || sessionExpired}
          className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {isPending ? 'กำลังค้นหา…' : 'ค้นหาเวลาว่าง'}
        </button>
      </div>

      {error && (
        <p id={`${dateId}-error`} role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}

      {sessionExpired && (
        <Link
          href="/login"
          className="mt-3 inline-block text-primary underline"
        >
          เข้าสู่ระบบอีกครั้ง
        </Link>
      )}

      {result && result.reason !== 'AVAILABLE' && (
        <p role="status" className="mt-5 text-primary">
          {reasonMessages[result.reason]}
        </p>
      )}

      {result?.reason === 'AVAILABLE' && phase !== 'success' && (
        <div className="mt-6 space-y-5">
          {anySlots.length > 0 && (
            <fieldset className="rounded-2xl border border-primary p-4">
              <legend className="px-2 font-semibold">ไม่ระบุช่าง</legend>

              <p className="mb-4 text-sm leading-7 text-muted">
                ระบบจะจัดช่างที่ทำบริการครบและว่างในเวลาที่เลือก
                ให้เมื่อยืนยันจอง
              </p>

              <div className="flex flex-wrap gap-3">
                {anySlots.map((slot) => {
                  const checked =
                    selected !== null &&
                    selected.groomerId === undefined &&
                    selected.slot.startsAt === slot.startsAt;

                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={checked}
                      disabled={bookingLocked}
                      onClick={() =>
                        setSelected({
                          groomerId: undefined,
                          groomerName: 'ไม่ระบุช่าง — ระบบจัดให้เมื่อยืนยันจอง',
                          slot,
                        })
                      }
                      className={`min-h-12 rounded-xl border px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface hover:border-primary'
                      }`}
                    >
                      {timeFormatter.format(new Date(slot.startsAt))}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {result.groomers.map((groomer) => (
            <fieldset
              key={groomer.id}
              className="rounded-2xl border border-border p-4"
            >
              <legend className="px-2 font-semibold">
                {groomer.displayName}
              </legend>

              {groomer.slots.length === 0 ? (
                <p className="text-sm text-muted">ช่างไม่มีเวลาว่างในวันนี้</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {groomer.slots.map((slot) => {
                    const checked =
                      selected?.groomerId === groomer.id &&
                      selected.slot.startsAt === slot.startsAt;

                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        aria-pressed={checked}
                        disabled={bookingLocked}
                        onClick={() =>
                          setSelected({
                            groomerId: groomer.id,
                            groomerName: groomer.displayName,
                            slot,
                          })
                        }
                        className={`min-h-12 rounded-xl border px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-surface hover:border-primary'
                        }`}
                      >
                        {timeFormatter.format(new Date(slot.startsAt))}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
        </div>
      )}

      {selected && result && (
        <div key={`${selected.groomerId ?? 'ANY'}:${selected.slot.startsAt}`}>
          {phase !== 'success' && (
            <BookingReview
              quote={result.quote}
              groomerName={selected.groomerName}
              slot={selected.slot}
            />
          )}

          <BookingConfirmation
            quote={result.quote}
            groomerId={selected.groomerId}
            groomerName={selected.groomerName}
            slot={selected.slot}
          />
        </div>
      )}
    </section>
  );
}
