'use client';

import { useEffect, useRef, useState } from 'react';

type CancelState =
  | 'idle'
  | 'confirming'
  | 'pending'
  | 'uncertain'
  | 'expired'
  | 'rejected'
  | 'success';

function isCancellation(value: unknown, bookingId: string): boolean {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'id' in value &&
    value.id === bookingId &&
    'status' in value &&
    value.status === 'CANCELLED' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

const buttonClass =
  'min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60';

export default function CancelBooking({
  bookingId,
  petName,
  startsAt,
  onCancelled,
}: {
  bookingId: string;
  petName: string;
  startsAt: string;
  onCancelled: () => void;
}) {
  const [state, setState] = useState<CancelState>('idle');
  const [message, setMessage] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  async function cancelBooking() {
    if (
      requestRef.current ||
      (state !== 'confirming' && state !== 'uncertain')
    ) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setState('pending');
    setMessage('');

    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20_000),
          ]),
        },
      );

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setState('expired');
        setMessage(
          'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง แล้วตรวจสอบสถานะการจอง',
        );
        return;
      }

      if (
        response.status === 400 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 409
      ) {
        setState('rejected');
        setMessage(
          response.status === 409
            ? 'รายการอาจเริ่มรับบริการแล้วหรือสถานะเปลี่ยนไป กรุณาโหลดข้อมูลล่าสุด'
            : 'ไม่สามารถยกเลิกรายการนี้ได้ กรุณาโหลดข้อมูลล่าสุด',
        );
        return;
      }

      if (!response.ok) {
        throw new Error('Cancellation result is unknown');
      }

      const result: unknown = await response.json();

      if (!isCancellation(result, bookingId)) {
        throw new Error('Invalid cancellation response');
      }

      if (!controller.signal.aborted) {
        setState('success');
        onCancelled();
      }
    } catch {
      if (!controller.signal.aborted) {
        setState('uncertain');
        setMessage(
          'ยังยืนยันผลการยกเลิกไม่ได้ กดลองยกเลิกอีกครั้งได้ ระบบจะตรวจสอบรายการเดิม',
        );
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  if (state === 'success') {
    return (
      <p role="status" className="mt-5 text-sm font-semibold text-primary">
        ยกเลิกการจองแล้ว
      </p>
    );
  }

  if (state === 'idle') {
    return (
      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            if (Date.parse(startsAt) <= Date.now()) {
              setState('rejected');
              setMessage(
                'ถึงเวลาเริ่มนัดหมายแล้ว ไม่สามารถยกเลิกได้ กรุณาโหลดข้อมูลล่าสุด',
              );
              return;
            }

            setState('confirming');
          }}
          className={`${buttonClass} border-danger text-danger hover:bg-surface-soft`}
        >
          ยกเลิกการจอง
        </button>
        <p className="mt-2 text-xs text-muted">
          ยกเลิกได้ก่อนเวลาเริ่มนัดหมาย
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={`ยืนยันยกเลิกการจองของ ${petName}`}
      className="mt-5 rounded-xl border border-danger/30 bg-surface-soft p-4"
    >
      <h3 className="font-semibold">
        ต้องการยกเลิกการจองของ {petName} ใช่ไหม?
      </h3>
      <p className="mt-2 text-sm text-muted">
        เมื่อยกเลิกสำเร็จ ช่องเวลานี้จะเปิดให้ผู้อื่นจอง
        หากต้องการรับบริการภายหลัง ต้องทำรายการจองใหม่
      </p>

      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {(state === 'confirming' ||
          state === 'pending' ||
          state === 'uncertain') && (
          <button
            type="button"
            onClick={() => void cancelBooking()}
            disabled={state === 'pending'}
            className={`${buttonClass} border-danger bg-danger text-white`}
          >
            {state === 'pending'
              ? 'กำลังยกเลิก…'
              : state === 'uncertain'
                ? 'ลองยกเลิกอีกครั้ง'
                : 'ยืนยันยกเลิกการจอง'}
          </button>
        )}

        {state === 'confirming' && (
          <button
            type="button"
            onClick={() => setState('idle')}
            className={`${buttonClass} border-border bg-surface text-foreground hover:border-primary`}
          >
            เก็บการจองไว้
          </button>
        )}

        {(state === 'uncertain' || state === 'rejected') && (
          <button
            type="button"
            onClick={onCancelled}
            className={`${buttonClass} border-primary text-primary hover:bg-background`}
          >
            โหลดข้อมูลล่าสุด
          </button>
        )}

        {state === 'expired' && (
          <a
            href="/login"
            className={`${buttonClass} inline-flex items-center border-primary text-primary`}
          >
            เข้าสู่ระบบ
          </a>
        )}
      </div>
    </section>
  );
}