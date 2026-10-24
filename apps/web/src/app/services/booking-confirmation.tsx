'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AvailabilitySlot } from './availability-types';
import type { ServiceQuote } from './quote-types';
import { useBookingFlow } from './booking-flow';

type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

type BookingReceipt = {
  id: string;
  status: BookingStatus;
  paymentStatus: 'UNPAID' | 'PAID';
  petName: string;
  groomerId: string;
  groomerName: string;
  startsAt: string;
  serviceEndsAt: string;
  totalPriceSatang: number;
};

type BookingPayload = {
  branchId: string;
  petId: string;
  groomerId?: string;
  startsAt: string;
  serviceIds: string[];
  requestKey: string;
};

type SavedAttempt = {
  ownerId: string;
  payload: BookingPayload;
};

type State =
  'idle' | 'submitting' | 'uncertain' | 'rejected' | 'expired' | 'success';

const statusLabels: Record<BookingStatus, string> = {
  CONFIRMED: 'ยืนยันการจองแล้ว',
  CANCELLED: 'รายการจองนี้ถูกยกเลิกแล้ว',
  COMPLETED: 'รายการจองนี้ให้บริการเสร็จแล้ว',
  NO_SHOW: 'รายการจองนี้มีสถานะไม่มาตามนัด',
};

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

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

const buttonClass =
  'min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    value === 'CANCELLED' ||
    value === 'COMPLETED' ||
    value === 'NO_SHOW'
  );
}

function isSavedAttempt(value: unknown): value is SavedAttempt {
  if (
    !isRecord(value) ||
    typeof value.ownerId !== 'string' ||
    !isRecord(value.payload)
  ) {
    return false;
  }

  const payload = value.payload;

  return (
    typeof payload.branchId === 'string' &&
    typeof payload.petId === 'string' &&
    (payload.groomerId === undefined ||
      typeof payload.groomerId === 'string') &&
    isDateTime(payload.startsAt) &&
    typeof payload.requestKey === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.requestKey,
    ) &&
    Array.isArray(payload.serviceIds) &&
    payload.serviceIds.length > 0 &&
    payload.serviceIds.every((item: unknown) => typeof item === 'string')
  );
}

function readReceipt(
  value: unknown,
  payload: BookingPayload,
): BookingReceipt | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    !isBookingStatus(value.status) ||
    (value.paymentStatus !== 'UNPAID' && value.paymentStatus !== 'PAID') ||
    value.branchId !== payload.branchId ||
    value.petId !== payload.petId ||
    typeof value.groomerId !== 'string' ||
    value.groomerId.length === 0 ||
    (payload.groomerId !== undefined &&
      value.groomerId !== payload.groomerId) ||
    !isRecord(value.groomer) ||
    value.groomer.id !== value.groomerId ||
    typeof value.groomer.displayName !== 'string' ||
    typeof value.petName !== 'string' ||
    !isDateTime(value.startsAt) ||
    !isDateTime(value.serviceEndsAt) ||
    Date.parse(value.startsAt) !== Date.parse(payload.startsAt) ||
    Date.parse(value.serviceEndsAt) <= Date.parse(value.startsAt) ||
    typeof value.totalPriceSatang !== 'number' ||
    !Number.isSafeInteger(value.totalPriceSatang) ||
    value.totalPriceSatang < 0 ||
    !Array.isArray(value.items) ||
    value.items.length !== payload.serviceIds.length
  ) {
    return null;
  }

  const returnedIds: string[] = [];
  let totalPriceSatang = 0;

  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.serviceId !== 'string' ||
      !payload.serviceIds.includes(item.serviceId) ||
      typeof item.priceSatang !== 'number' ||
      !Number.isSafeInteger(item.priceSatang) ||
      item.priceSatang < 0
    ) {
      return null;
    }

    returnedIds.push(item.serviceId);
    totalPriceSatang += item.priceSatang;
  }

  if (
    new Set(returnedIds).size !== payload.serviceIds.length ||
    totalPriceSatang !== value.totalPriceSatang
  ) {
    return null;
  }

  return {
    id: value.id,
    status: value.status,
    paymentStatus: value.paymentStatus,
    petName: value.petName,
    groomerId: value.groomerId,
    groomerName: value.groomer.displayName,
    startsAt: value.startsAt,
    serviceEndsAt: value.serviceEndsAt,
    totalPriceSatang: value.totalPriceSatang,
  };
}

export default function BookingConfirmation({
  quote,
  groomerId,
  slot,
}: {
  quote: ServiceQuote;
  groomerId: string | undefined;
  groomerName: string;
  slot: AvailabilitySlot;
}) {
  const { setPhase } = useBookingFlow();
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const attemptRef = useRef<SavedAttempt | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (state !== 'submitting' && state !== 'uncertain') return;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', warnBeforeLeaving);

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [state]);

  function changeState(next: State) {
    setState(next);

    if (next === 'submitting') {
      setPhase('busy');
    } else if (next === 'uncertain') {
      setPhase('uncertain');
    } else if (next === 'success') {
      setPhase('success');
    } else {
      setPhase('idle');
    }
  }

  async function confirmBooking() {
    if (requestRef.current || (state !== 'idle' && state !== 'uncertain')) {
      return;
    }

    const previousState = state;
    const controller = new AbortController();
    requestRef.current = controller;
    changeState('submitting');
    setMessage('');

    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(20_000),
    ]);

    let storageKey: string | null = null;
    let submitted = false;

    function clearAttempt() {
      if (!storageKey) return;

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Keeping the old key is safer than generating a new retry key.
      }
    }

    try {
      // Identify the account before loading a saved request.
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });

      if (controller.signal.aborted) return;

      if (userResponse.status === 401) {
        changeState('expired');
        setMessage(
          'เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้จอง แล้วกลับมาลองอีกครั้ง',
        );
        return;
      }

      if (!userResponse.ok) {
        throw new Error('Cannot verify the current account');
      }

      const user: unknown = await userResponse.json();

      if (!isRecord(user) || typeof user.id !== 'string') {
        throw new Error('Invalid current user response');
      }

      if (attemptRef.current && attemptRef.current.ownerId !== user.id) {
        changeState('rejected');
        setMessage(
          'บัญชีที่เข้าสู่ระบบเปลี่ยนไป กรุณากลับเข้าสู่ระบบด้วยบัญชีที่ใช้ส่งคำขอเดิม',
        );
        return;
      }

      const details = {
        branchId: quote.branch.id,
        petId: quote.pet.id,
        groomerId,
        startsAt: new Date(slot.startsAt).toISOString(),
        serviceIds: quote.items.map((item) => item.serviceId).sort(),
      };

      storageKey = `petopia:booking-request:v2:${JSON.stringify([
        user.id,
        details,
      ])}`;

      let attempt = attemptRef.current;

      if (!attempt) {
        const raw = sessionStorage.getItem(storageKey);

        if (raw !== null) {
          const saved: unknown = JSON.parse(raw);

          if (
            !isSavedAttempt(saved) ||
            saved.ownerId !== user.id ||
            saved.payload.branchId !== details.branchId ||
            saved.payload.petId !== details.petId ||
            saved.payload.groomerId !== details.groomerId ||
            saved.payload.startsAt !== details.startsAt ||
            JSON.stringify([...saved.payload.serviceIds].sort()) !==
              JSON.stringify(details.serviceIds)
          ) {
            changeState('rejected');
            setMessage(
              'ข้อมูลคำขอที่เก็บไว้ไม่สมบูรณ์ กรุณาตรวจสอบรายการจองกับสาขาก่อนเริ่มคำขอใหม่',
            );
            return;
          }

          attempt = saved;
        } else {
          attempt = {
            ownerId: user.id,
            payload: {
              ...details,
              requestKey: crypto.randomUUID(),
            },
          };
        }

        // Store the exact payload and key before sending the booking.
        sessionStorage.setItem(storageKey, JSON.stringify(attempt));
        attemptRef.current = attempt;
      }

      submitted = true;

      const response = await fetch('/api/bookings', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.payload),
        signal,
      });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        // Keep the key: a previous attempt may already have succeeded.
        changeState('expired');
        setMessage(
          'เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วยบัญชีเดิม แล้วกลับมาลองอีกครั้ง',
        );
        return;
      }

      if (
        response.status === 400 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 409
      ) {
        if (response.status === 409) {
          const errorBody: unknown = await response.json();

          if (
            isRecord(errorBody) &&
            errorBody.code === 'BOOKING_REQUEST_REUSED'
          ) {
            changeState('rejected');
            setMessage(
              'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาตรวจสอบรายการจองก่อนเริ่มใหม่',
            );
            return;
          }
        }

        clearAttempt();
        changeState('rejected');
        setMessage(
          response.status === 409
            ? 'เวลานี้ไม่สามารถจองได้แล้ว กรุณาค้นหาเวลาว่างและเลือกใหม่'
            : 'ไม่สามารถจองด้วยข้อมูลปัจจุบันได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบข้อมูลและเลือกอีกครั้ง',
        );
        return;
      }

      if (response.status !== 201) {
        throw new Error('Uncertain booking response');
      }

      const data: unknown = await response.json();
      const saved = readReceipt(data, attempt.payload);

      if (!saved) {
        throw new Error('Invalid booking response');
      }

      setReceipt(saved);
      changeState('success');
      clearAttempt();
    } catch {
      if (!controller.signal.aborted) {
        if (submitted || previousState === 'uncertain') {
          changeState('uncertain');
          setMessage(
            'ยังไม่ได้รับผลยืนยัน รายการอาจถูกบันทึกแล้ว เมื่อเชื่อมต่อได้ให้กดลองยืนยันอีกครั้ง ระบบจะใช้คำขอเดิม',
          );
        } else {
          changeState('idle');
          setMessage(
            'ยังไม่ได้ส่งคำขอจอง กรุณาตรวจสอบการเชื่อมต่อและการอนุญาตจัดเก็บข้อมูลเว็บไซต์ แล้วลองอีกครั้ง',
          );
        }
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  if (state === 'success' && receipt) {
    return (
      <div className="mt-5 rounded-2xl border border-primary bg-surface p-5">
        <p role="status" className="text-lg font-bold text-primary">
          {statusLabels[receipt.status]}
        </p>

        {receipt.status !== 'CONFIRMED' && (
          <p className="mt-3 text-sm text-muted">
            นี่คือสถานะปัจจุบันของรายการเดิม ระบบไม่ได้สร้างการจองใหม่
          </p>
        )}

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted">เลขการจอง</dt>
            <dd className="mt-1 break-all font-medium">{receipt.id}</dd>
          </div>

          <div>
            <dt className="text-muted">สัตว์เลี้ยงและสาขา</dt>
            <dd className="mt-1">
              {receipt.petName} · {quote.branch.name}
            </dd>
          </div>

          <div>
            <dt className="text-muted">ช่างผู้ให้บริการ</dt>
            <dd className="mt-1">{receipt.groomerName}</dd>
          </div>

          <div>
            <dt className="text-muted">วันและเวลาใช้บริการ</dt>
            <dd className="mt-1">
              {dateFormatter.format(new Date(receipt.startsAt))}
              <br />
              {timeFormatter.format(new Date(receipt.startsAt))}
              {' – '}
              {timeFormatter.format(new Date(receipt.serviceEndsAt))} น.
            </dd>
          </div>

          <div>
            <dt className="text-muted">ยอดรวมตามรายการจอง</dt>

            <dd className="mt-1 text-lg font-bold text-primary">
              {priceFormatter.format(receipt.totalPriceSatang / 100)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">สถานะชำระเงิน</dt>
            <dd className="mt-1 font-semibold">
              {receipt.paymentStatus === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
            </dd>
          </div>
        </dl>

        <a
          href="/services"
          className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-primary px-5 py-3 font-semibold text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          จองบริการอีกครั้ง
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {(state === 'idle' ||
        state === 'uncertain' ||
        state === 'submitting') && (
        <button
          type="button"
          disabled={state === 'submitting'}
          className={buttonClass}
          onClick={() => void confirmBooking()}
        >
          {state === 'submitting'
            ? 'กำลังยืนยันการจอง…'
            : state === 'uncertain'
              ? 'ลองยืนยันอีกครั้ง'
              : 'ยืนยันจองและชำระเงินที่สาขา'}
        </button>
      )}

      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}

      {state === 'expired' && (
        <Link
          href="/login"
          className="mt-3 inline-block text-primary underline underline-offset-4"
        >
          เข้าสู่ระบบ
        </Link>
      )}
    </div>
  );
}
