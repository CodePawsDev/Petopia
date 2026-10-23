'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type TimeOff = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: TimeOff[] };

type FieldErrors = {
  start?: string;
  end?: string;
};

const inputClass =
  'min-h-12 w-full rounded-xl border border-input-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const secondaryButton =
  'min-h-11 rounded-xl border border-border px-4 py-2 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60';

function isTimeOff(value: unknown): value is TimeOff {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'startsAt' in value &&
    typeof value.startsAt === 'string' &&
    Number.isFinite(Date.parse(value.startsAt)) &&
    'endsAt' in value &&
    typeof value.endsAt === 'string' &&
    Number.isFinite(Date.parse(value.endsAt)) &&
    Date.parse(value.startsAt) < Date.parse(value.endsAt) &&
    'reason' in value &&
    (value.reason === null || typeof value.reason === 'string')
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function toBangkokIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;

  const result = `${value}:00+07:00`;

  return Number.isFinite(Date.parse(result)) ? result : null;
}

function requestError(status: number): string {
  if (status === 403) return 'คุณไม่มีสิทธิ์จัดการวันหยุดนี้';
  if (status === 404) return 'ไม่พบช่างหรือรายการวันหยุด กรุณาโหลดข้อมูลใหม่';
  if (status === 400) return 'ข้อมูลวันหยุดไม่ถูกต้อง กรุณาตรวจสอบวันและเวลา';

  return 'ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง';
}

export default function TimeOffEditor({
  branchId,
  groomerId,
  onStatusChange,
}: {
  branchId: string;
  groomerId: string;
  onStatusChange: (status: { dirty: boolean; busy: boolean }) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<'create' | 'delete' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeOff | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const requestRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const dirty = start !== '' || end !== '' || reason !== '';

  useEffect(() => {
    onStatusChange({
      dirty,
      busy: pending !== null,
    });
  }, [dirty, pending, onStatusChange]);

  const url = `/api/branches/${encodeURIComponent(
    branchId,
  )}/groomers/${encodeURIComponent(groomerId)}/time-offs`;

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (deleteTarget) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [deleteTarget]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }

        if (!response.ok) {
          setState({
            status: 'error',
            message: requestError(response.status),
          });
          return;
        }

        const result: unknown = await response.json();

        if (!Array.isArray(result) || !result.every(isTimeOff)) {
          throw new Error('Invalid time-off response');
        }

        if (!controller.signal.aborted) {
          setState({ status: 'success', items: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: 'โหลดวันหยุดไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [url, attempt]);

  function reload() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }

  function clearFeedback() {
    setFieldErrors({});
    setError('');
    setMessage('');
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestRef.current) return;

    clearFeedback();

    const startsAt = toBangkokIso(start);
    const endsAt = toBangkokIso(end);
    const errors: FieldErrors = {};

    if (!startsAt) errors.start = 'กรุณาระบุวันและเวลาเริ่ม';
    if (!endsAt) errors.end = 'กรุณาระบุวันและเวลาสิ้นสุด';

    if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
      errors.end = 'วันและเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setPending('create');

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt,
          endsAt,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }

      if (!response.ok) {
        setError(requestError(response.status));
        return;
      }

      const result: unknown = await response.json();

      if (!isTimeOff(result)) {
        throw new Error('Invalid created time off');
      }

      if (!controller.signal.aborted) {
        setStart('');
        setEnd('');
        setReason('');
        setMessage('เพิ่มวันหยุดแล้ว');
        reload();
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(
          'ยังยืนยันผลเพิ่มวันหยุดไม่ได้ กรุณาโหลดรายการใหม่ก่อนเพิ่มซ้ำ',
        );
        reload();
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }

      if (!controller.signal.aborted) setPending(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setPending('delete');
    setDeleteError('');
    setMessage('');

    try {
      const response = await fetch(
        `${url}/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        },
      );

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }

      if (!response.ok) {
        setDeleteError(requestError(response.status));
        return;
      }

      setDeleteTarget(null);
      setMessage('ลบวันหยุดแล้ว');
      reload();
    } catch {
      if (!controller.signal.aborted) {
        setDeleteError('ยังยืนยันผลลบไม่ได้ กรุณาปิดกล่องนี้และโหลดรายการใหม่');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }

      if (!controller.signal.aborted) setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="time-off-heading"
      className="mt-10 border-t border-border pt-8"
    >
      <h2 id="time-off-heading" className="text-xl font-bold">
        วันหยุดและช่วงไม่รับงาน
      </h2>

      <p className="mt-2 text-sm leading-7 text-muted">
        ระบุเวลาไทย เพิ่มได้ทั้งบางช่วงและหลายวัน
        รายการหน้านี้เป็นรายการที่จัดการโดยสาขานี้
        ช่วงหยุดของช่างจะใช้บล็อกการรับงานทุกสาขาเมื่อเชื่อมระบบจอง
      </p>

      <form
        onSubmit={handleCreate}
        noValidate
        aria-busy={pending === 'create'}
        className="mt-5 rounded-2xl bg-surface-soft p-5"
      >
        <fieldset disabled={pending !== null} className="min-w-0">
          <legend className="font-semibold">เพิ่มช่วงไม่รับงาน</legend>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="time-off-start" className="mb-2 block text-sm">
                เริ่ม
              </label>
              <input
                id="time-off-start"
                type="datetime-local"
                step={60}
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  clearFeedback();
                }}
                aria-invalid={Boolean(fieldErrors.start)}
                aria-describedby={
                  fieldErrors.start ? 'time-off-start-error' : undefined
                }
                className={inputClass}
              />
              {fieldErrors.start && (
                <p
                  id="time-off-start-error"
                  className="mt-2 text-sm text-danger"
                >
                  {fieldErrors.start}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="time-off-end" className="mb-2 block text-sm">
                สิ้นสุด
              </label>
              <input
                id="time-off-end"
                type="datetime-local"
                step={60}
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value);
                  clearFeedback();
                }}
                aria-invalid={Boolean(fieldErrors.end)}
                aria-describedby={
                  fieldErrors.end ? 'time-off-end-error' : undefined
                }
                className={inputClass}
              />
              {fieldErrors.end && (
                <p id="time-off-end-error" className="mt-2 text-sm text-danger">
                  {fieldErrors.end}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="time-off-reason" className="mb-2 block text-sm">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              id="time-off-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                clearFeedback();
              }}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="mt-4 min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            {pending === 'create' ? 'กำลังเพิ่ม…' : 'เพิ่มวันหยุด'}
          </button>
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      <p role="status" className="mt-4 font-medium text-primary">
        {message}
      </p>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">รายการวันหยุด</h3>
          <button
            type="button"
            disabled={pending !== null || state.status === 'loading'}
            onClick={reload}
            className={secondaryButton}
          >
            โหลดรายการใหม่
          </button>
        </div>

        {state.status === 'loading' ? (
          <p role="status" className="mt-4 text-muted">
            กำลังโหลดวันหยุด…
          </p>
        ) : state.status === 'error' ? (
          <p role="alert" className="mt-4 text-danger">
            {state.message}
          </p>
        ) : state.items.length === 0 ? (
          <p className="mt-4 text-muted">
            ยังไม่มีรายการวันหยุดที่บันทึกในสาขานี้
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {state.items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-border p-5"
              >
                <p className="font-medium">{formatDateTime(item.startsAt)}</p>
                <p className="mt-1 text-sm text-muted">
                  ถึง {formatDateTime(item.endsAt)}
                </p>

                {item.reason && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                    {item.reason}
                  </p>
                )}

                <button
                  type="button"
                  disabled={pending !== null}
                  className={`${secondaryButton} mt-4`}
                  aria-label={`ลบวันหยุดเริ่ม ${formatDateTime(item.startsAt)}`}
                  onClick={() => {
                    setDeleteError('');
                    setDeleteTarget(item);
                  }}
                >
                  ลบวันหยุด
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-time-off-heading"
        aria-describedby="delete-time-off-description"
        onCancel={(event) => {
          if (requestRef.current) {
            event.preventDefault();
          } else {
            setDeleteTarget(null);
          }
        }}
        onClose={() => setDeleteTarget(null)}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 id="delete-time-off-heading" className="text-xl font-bold">
          ลบวันหยุดนี้?
        </h2>
        <p
          id="delete-time-off-description"
          className="mt-3 text-sm leading-7 text-muted"
        >
          ช่วงนี้จะไม่ถูกบล็อกด้วยรายการวันหยุดนี้อีก
          ตารางทำงานและวันหยุดรายการอื่นยังมีผลตามเดิม
        </p>

        {deleteTarget && (
          <p className="mt-4 text-sm font-medium">
            {formatDateTime(deleteTarget.startsAt)}
            <br />
            ถึง {formatDateTime(deleteTarget.endsAt)}
          </p>
        )}

        {deleteError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {deleteError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            autoFocus
            disabled={pending !== null}
            onClick={() => setDeleteTarget(null)}
            className={secondaryButton}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void handleDelete()}
            className="min-h-11 rounded-xl bg-danger px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
          >
            {pending === 'delete' ? 'กำลังลบ…' : 'ยืนยันลบ'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
