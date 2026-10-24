'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { isSavedAttempt, readReceipt } from './booking-confirmation';

const STORAGE_PREFIX = 'petopia:booking-request:v2:';

type SavedAttempt = Extract<Parameters<typeof readReceipt>[1], object>;

type PendingRequest = {
  storageKey: string;
  ownerId: string;
  payload: SavedAttempt;
};

type Receipt = NonNullable<ReturnType<typeof readReceipt>>;

type RecoveryState =
  | 'checking'
  | 'ready'
  | 'pending'
  | 'submitting'
  | 'success'
  | 'expired'
  | 'blocked';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'long',
  timeStyle: 'short',
});

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

const statusLabels = {
  CONFIRMED: 'ยืนยันการจองแล้ว',
  CANCELLED: 'รายการเดิมถูกยกเลิกแล้ว',
  COMPLETED: 'รายการเดิมรับบริการเสร็จแล้ว',
  NO_SHOW: 'รายการเดิมมีสถานะไม่มาตามนัด',
};

const buttonClass =
  'min-h-12 rounded-xl border border-primary bg-surface px-5 py-3 font-semibold text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function currentOwner(signal: AbortSignal): Promise<string | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });

  if (response.status === 401) return null;

  if (!response.ok) {
    throw new Error('Cannot verify current account');
  }

  const user: unknown = await response.json();

  if (!isRecord(user) || typeof user.id !== 'string') {
    throw new Error('Invalid account response');
  }

  return user.id;
}

function readPendingRequests(ownerId: string): PendingRequest[] {
  const pending: PendingRequest[] = [];

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const storageKey = sessionStorage.key(index);

    if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;

    // The storage key starts with [ownerId, details].
    const identity: unknown = JSON.parse(
      storageKey.slice(STORAGE_PREFIX.length),
    );

    if (
      !Array.isArray(identity) ||
      identity.length !== 2 ||
      typeof identity[0] !== 'string'
    ) {
      throw new Error('Invalid pending request identity');
    }

    // Never load another account's booking payload.
    if (identity[0] !== ownerId) continue;

    const raw = sessionStorage.getItem(storageKey);

    if (raw === null) continue;

    const saved: unknown = JSON.parse(raw);

    if (!isSavedAttempt(saved) || saved.ownerId !== ownerId) {
      throw new Error('Invalid pending booking data');
    }

    pending.push({
      storageKey,
      ownerId,
      payload: saved.payload,
    });
  }

  return pending;
}

export default function BookingRecovery({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecoveryState>('checking');
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function checkPendingRequests() {
      try {
        const ownerId = await currentOwner(
          AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        );

        if (controller.signal.aborted) return;

        if (ownerId === null) {
          setState('ready');
          return;
        }

        const requests = readPendingRequests(ownerId);

        if (!controller.signal.aborted) {
          setPending(requests);
          setState(requests.length > 0 ? 'pending' : 'ready');
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage(
            'ตรวจสอบคำขอจองเดิมไม่สำเร็จ กรุณาลองตรวจสอบอีกครั้ง หากยังพบปัญหา ให้ตรวจรายการจองและติดต่อสาขาก่อนเริ่มคำขอใหม่',
          );
          setState('blocked');
        }
      }
    }

    void checkPendingRequests();

    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  async function recover() {
    const saved = pending[0];

    if (!saved || requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setState('submitting');
    setMessage('');

    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(20_000),
    ]);

    try {
      const ownerId = await currentOwner(signal);

      if (controller.signal.aborted) return;

      if (ownerId === null || ownerId !== saved.ownerId) {
        setState('expired');
        setMessage(
          'กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้ส่งคำขอเดิม แล้วกลับมาหน้าบริการเพื่อตรวจสอบอีกครั้ง',
        );
        return;
      }

      // Reuse the exact original payload, including key and quote hash.
      const response = await fetch('/api/bookings', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved.payload),
        signal,
      });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setState('expired');
        setMessage('เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วยบัญชีเดิม');
        return;
      }

      if (response.status === 201) {
        const body: unknown = await response.json();
        const recovered = readReceipt(body, saved.payload);

        if (!recovered) {
          throw new Error('Invalid recovered booking');
        }

        // Remove only after validating the booking returned by the API.
        sessionStorage.removeItem(saved.storageKey);
        setPending((requests) =>
          requests.filter((request) => request.storageKey !== saved.storageKey),
        );
        setReceipt(recovered);
        setState('success');
        return;
      }

      if (
        response.status === 400 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 409
      ) {
        const body: unknown = await response.json();

        if (!isRecord(body) || body.statusCode !== response.status) {
          // Custom conflict responses may contain a code instead.
          if (
            response.status !== 409 ||
            !isRecord(body) ||
            (body.code !== 'QUOTE_CHANGED' &&
              body.code !== 'BOOKING_REQUEST_REUSED')
          ) {
            throw new Error('Unrecognized rejection response');
          }
        }

        if (isRecord(body) && body.code === 'BOOKING_REQUEST_REUSED') {
          setState('blocked');
          setMessage(
            'รหัสคำขอเดิมมีข้อมูลไม่ตรงกัน กรุณาตรวจรายการจองและติดต่อสาขาก่อนเริ่มคำขอใหม่',
          );
          return;
        }

        // This retry was rejected; the transaction created no booking.
        sessionStorage.removeItem(saved.storageKey);
        setPending((requests) =>
          requests.filter((request) => request.storageKey !== saved.storageKey),
        );
        setReceipt(null);
        setMessage(
          isRecord(body) && body.code === 'QUOTE_CHANGED'
            ? 'ข้อมูลบริการเปลี่ยนแปลง คำขอเดิมไม่ได้สร้างการจอง กรุณาเลือกรายการและเวลาใหม่เพื่อยืนยันข้อมูลล่าสุด'
            : 'คำขอเดิมไม่สามารถจองได้ด้วยข้อมูลปัจจุบัน กรุณาตรวจสอบข้อมูลและเลือกเวลาใหม่',
        );
        setState('success');
        return;
      }

      throw new Error('Uncertain recovery response');
    } catch {
      if (!controller.signal.aborted) {
        setState('pending');
        setMessage(
          'ยังไม่ทราบผลคำขอเดิม กรุณาลองตรวจสอบอีกครั้ง ระบบจะใช้รหัสเดิมเพื่อป้องกันการจองซ้ำ',
        );
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  if (state === 'ready') return children;

  return (
    <section className="rounded-3xl border border-primary bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-bold">ตรวจสอบคำขอจองเดิม</h2>

      {state === 'checking' ? (
        <p role="status" className="mt-4 text-muted">
          กำลังตรวจสอบคำขอที่ยังไม่ทราบผล…
        </p>
      ) : state === 'success' ? (
        <>
          {receipt && (
            <div className="mt-4 space-y-3">
              <p role="status" className="font-semibold text-primary">
                {statusLabels[receipt.status]}
              </p>
              <p className="break-all text-sm">เลขการจอง: {receipt.id}</p>
              <p>สัตว์เลี้ยง: {receipt.petName}</p>
              <p>ช่าง: {receipt.groomerName}</p>
              <p>
                {dateFormatter.format(new Date(receipt.startsAt))}
                {' น. ตามเวลาประเทศไทย'}
              </p>
              <p>
                ยอดรวม: {priceFormatter.format(receipt.totalPriceSatang / 100)}
              </p>
              <p>
                {receipt.paymentStatus === 'PAID' ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
              </p>
              {receipt.status !== 'CONFIRMED' && (
                <p className="text-sm text-muted">
                  นี่คือสถานะปัจจุบันของรายการเดิม ระบบไม่ได้สร้างการจองใหม่
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            className={`${buttonClass} mt-5`}
            onClick={() => {
              setReceipt(null);
              setMessage('');
              setState(pending.length > 0 ? 'pending' : 'ready');
            }}
          >
            {pending.length > 0 ? 'ตรวจสอบคำขอที่เหลือ' : 'กลับไปเลือกบริการ'}
          </button>
        </>
      ) : (
        <>
          {(state === 'pending' || state === 'submitting') && (
            <>
              <p className="mt-4 text-sm leading-7 text-muted">
                พบคำขอที่ยังไม่ได้รับผลยืนยัน กรุณาตรวจสอบคำขอเดิมก่อน
                หากยังไม่เคยบันทึกสำเร็จ
                การกดปุ่มนี้จะลองยืนยันการจองเดิมอีกครั้ง
              </p>

              <button
                type="button"
                className={`${buttonClass} mt-5`}
                disabled={state === 'submitting'}
                onClick={() => void recover()}
              >
                {state === 'submitting'
                  ? 'กำลังตรวจสอบ…'
                  : 'ตรวจสอบและยืนยันคำขอเดิม'}
              </button>
            </>
          )}

          {state === 'blocked' && (
            <button
              type="button"
              className={`${buttonClass} mt-5`}
              onClick={() => {
                setMessage('');
                setState('checking');
                setAttempt((value) => value + 1);
              }}
            >
              ลองตรวจสอบอีกครั้ง
            </button>
          )}

          {state === 'expired' && (
            <Link
              href="/login"
              className="mt-5 inline-block text-primary underline"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </>
      )}

      {message && (
        <p role="alert" className="mt-4 text-sm leading-7 text-danger">
          {message}
        </p>
      )}

      {state !== 'checking' && (
        <Link
          href="/bookings"
          className="mt-5 block text-primary underline underline-offset-4"
        >
          ดูรายการจองของฉัน
        </Link>
      )}
    </section>
  );
}
