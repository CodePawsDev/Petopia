'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Interval = {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

type Row = {
  key: string;
  weekday: number;
  start: string;
  end: string;
};

type EditorStatus = {
  dirty: boolean;
  busy: boolean;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; intervals: Interval[] };

const days = [
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
  'อาทิตย์',
];

const inputClass =
  'min-h-12 w-full rounded-xl border border-input-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const secondaryButton =
  'min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInterval(value: unknown): value is Interval {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.weekday === 'number' &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 1 &&
    value.weekday <= 7 &&
    typeof value.startMinute === 'number' &&
    Number.isInteger(value.startMinute) &&
    value.startMinute >= 540 &&
    typeof value.endMinute === 'number' &&
    Number.isInteger(value.endMinute) &&
    value.endMinute <= 1080 &&
    value.startMinute < value.endMinute
  );
}

function readIntervals(
  value: unknown,
  branchId: string,
  groomerId: string,
): Interval[] {
  if (
    !isRecord(value) ||
    !isRecord(value.branch) ||
    value.branch.id !== branchId ||
    !isRecord(value.groomer) ||
    value.groomer.id !== groomerId ||
    !Array.isArray(value.intervals) ||
    !value.intervals.every(isInterval)
  ) {
    throw new Error('Invalid weekly schedule response');
  }

  return value.intervals;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60,
  ).padStart(2, '0')}`;
}

function parseTime(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(':').map(Number);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function toRows(intervals: Interval[]): Row[] {
  return intervals.map((interval) => ({
    key: interval.id,
    weekday: interval.weekday,
    start: formatTime(interval.startMinute),
    end: formatTime(interval.endMinute),
  }));
}

export default function WeeklyScheduleEditor({
  branchId,
  groomerId,
  onStatusChange,
}: {
  branchId: string;
  groomerId: string;
  onStatusChange: (status: EditorStatus) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const url = `/api/branches/${encodeURIComponent(
    branchId,
  )}/groomers/${encodeURIComponent(groomerId)}/weekly-schedule`;

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
            message:
              response.status === 403
                ? 'คุณไม่มีสิทธิ์จัดการตารางช่างนี้'
                : response.status === 404
                  ? 'ไม่พบช่างที่พร้อมใช้งานในสาขานี้'
                  : 'โหลดตารางไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
          return;
        }

        const result: unknown = await response.json();
        const intervals = readIntervals(result, branchId, groomerId);

        if (!controller.signal.aborted) {
          setState({ status: 'success', intervals });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: 'โหลดตารางไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [url, branchId, groomerId, attempt]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="mt-6 text-muted">
        กำลังโหลดตารางรายสัปดาห์…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-6">
        <p role="alert" className="text-danger">
          {state.message}
        </p>
        <button
          type="button"
          className={`${secondaryButton} mt-3`}
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <WeeklyScheduleForm
      url={url}
      branchId={branchId}
      groomerId={groomerId}
      initialIntervals={state.intervals}
      onStatusChange={onStatusChange}
    />
  );
}

function WeeklyScheduleForm({
  url,
  branchId,
  groomerId,
  initialIntervals,
  onStatusChange,
}: {
  url: string;
  branchId: string;
  groomerId: string;
  initialIntervals: Interval[];
  onStatusChange: (status: EditorStatus) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialIntervals));
  const [savedRows, setSavedRows] = useState<Row[]>(() =>
    toRows(initialIntervals),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const dirty =
    JSON.stringify(
      rows.map(({ weekday, start, end }) => ({ weekday, start, end })),
    ) !==
    JSON.stringify(
      savedRows.map(({ weekday, start, end }) => ({ weekday, start, end })),
    );

  useEffect(() => {
    onStatusChange({ dirty, busy: isSaving });
  }, [dirty, isSaving, onStatusChange]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  function clearFeedback() {
    setErrors({});
    setError('');
    setMessage('');
  }

  function updateRow(key: string, field: 'start' | 'end', value: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
    clearFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestRef.current) return;

    clearFeedback();

    const nextErrors: Record<string, string> = {};
    const intervals: Array<{
      weekday: number;
      startMinute: number;
      endMinute: number;
    }> = [];

    for (const row of rows) {
      const start = parseTime(row.start);
      const end = parseTime(row.end);

      if (start === null || end === null) {
        nextErrors[row.key] = 'กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด';
      } else if (start < 540 || end > 1080 || start >= 1080 || end <= 540) {
        nextErrors[row.key] = 'กรุณาระบุเวลาภายใน 09:00–18:00';
      } else if (start >= end) {
        nextErrors[row.key] = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
      } else {
        intervals.push({
          weekday: row.weekday,
          startMinute: start,
          endMinute: end,
        });
      }
    }

    for (const row of rows) {
      const start = parseTime(row.start);
      const end = parseTime(row.end);

      if (start === null || end === null || nextErrors[row.key]) continue;

      const overlaps = rows.some((other) => {
        if (other.key === row.key || other.weekday !== row.weekday) {
          return false;
        }

        const otherStart = parseTime(other.start);
        const otherEnd = parseTime(other.end);

        return (
          otherStart !== null &&
          otherEnd !== null &&
          otherStart < otherEnd &&
          start < otherEnd &&
          otherStart < end
        );
      });

      if (overlaps) {
        nextErrors[row.key] = 'ช่วงเวลานี้ทับกับช่วงอื่นในวันเดียวกัน';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError('กรุณาตรวจสอบช่วงเวลาที่มีข้อความแจ้งเตือน');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setIsSaving(true);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervals }),
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
        setError(
          response.status === 409
            ? 'ช่วงเวลาทับกับตารางของช่างในอีกสาขา กรุณาปรับเวลาแล้วบันทึกใหม่'
            : response.status === 403
              ? 'คุณไม่มีสิทธิ์บันทึกตารางนี้ กรุณาโหลดหน้าใหม่'
              : response.status === 404
                ? 'ช่างหรือสาขานี้ไม่พร้อมใช้งาน กรุณาโหลดหน้าใหม่'
                : response.status === 400
                  ? 'ข้อมูลตารางไม่ถูกต้อง กรุณาตรวจสอบช่วงเวลา'
                  : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
        );
        return;
      }

      const result: unknown = await response.json();
      const saved = toRows(readIntervals(result, branchId, groomerId));

      if (!controller.signal.aborted) {
        setRows(saved);
        setSavedRows(saved);
        setMessage('บันทึกตารางรายสัปดาห์แล้ว');
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(
          'ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบตารางล่าสุด',
        );
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }

      if (!controller.signal.aborted) {
        setIsSaving(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isSaving}>
      <fieldset disabled={isSaving} className="mt-6 min-w-0">
        <legend className="text-xl font-bold">ตารางรายสัปดาห์</legend>

        <p id="weekly-help" className="mt-2 text-sm leading-7 text-muted">
          เพิ่มช่วงที่ช่างรับงานได้ โดยเว้นช่วงพักระหว่างเวลา
          วันที่ไม่มีช่วงเวลาถือเป็นวันไม่รับงาน
          การบันทึกจะแทนที่ตารางทั้งสัปดาห์ของช่างในสาขานี้
        </p>

        <div className="mt-5 space-y-4">
          {days.map((day, index) => {
            const weekday = index + 1;
            const dayRows = rows.filter((row) => row.weekday === weekday);

            return (
              <section
                key={weekday}
                aria-labelledby={`day-${weekday}`}
                className="rounded-2xl border border-border p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id={`day-${weekday}`} className="font-semibold">
                    วัน{day}
                  </h3>

                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={rows.length >= 100}
                    onClick={() => {
                      setRows((current) => [
                        ...current,
                        {
                          key: crypto.randomUUID(),
                          weekday,
                          start: '',
                          end: '',
                        },
                      ]);
                      clearFeedback();
                    }}
                  >
                    + เพิ่มช่วงเวลา
                  </button>
                </div>

                {dayRows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">ไม่รับงาน</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {dayRows.map((row, rowIndex) => (
                      <div key={row.key}>
                        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                          <div>
                            <label
                              htmlFor={`start-${row.key}`}
                              className="mb-1 block text-sm font-medium"
                            >
                              เริ่ม ช่วงที่ {rowIndex + 1}
                            </label>
                            <input
                              id={`start-${row.key}`}
                              type="time"
                              min="09:00"
                              max="18:00"
                              step={60}
                              value={row.start}
                              onChange={(event) =>
                                updateRow(row.key, 'start', event.target.value)
                              }
                              aria-invalid={Boolean(errors[row.key])}
                              aria-describedby={
                                errors[row.key] ? `error-${row.key}` : undefined
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`end-${row.key}`}
                              className="mb-1 block text-sm font-medium"
                            >
                              สิ้นสุด ช่วงที่ {rowIndex + 1}
                            </label>
                            <input
                              id={`end-${row.key}`}
                              type="time"
                              min="09:00"
                              max="18:00"
                              step={60}
                              value={row.end}
                              onChange={(event) =>
                                updateRow(row.key, 'end', event.target.value)
                              }
                              aria-invalid={Boolean(errors[row.key])}
                              aria-describedby={
                                errors[row.key] ? `error-${row.key}` : undefined
                              }
                              className={inputClass}
                            />
                          </div>

                          <button
                            type="button"
                            className={secondaryButton}
                            aria-label={`ลบช่วงที่ ${rowIndex + 1} วัน${day}`}
                            onClick={() => {
                              setRows((current) =>
                                current.filter((item) => item.key !== row.key),
                              );
                              clearFeedback();
                            }}
                          >
                            ลบช่วง
                          </button>
                        </div>

                        {errors[row.key] && (
                          <p
                            id={`error-${row.key}`}
                            className="mt-2 text-sm text-danger"
                          >
                            {errors[row.key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            aria-describedby="weekly-help"
            className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? 'กำลังบันทึก…' : 'บันทึกตารางรายสัปดาห์'}
          </button>

          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setRows(savedRows.map((row) => ({ ...row })));
              clearFeedback();
            }}
          >
            คืนค่าที่บันทึกล่าสุด
          </button>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <p role="status" className="mt-4 text-sm font-medium text-primary">
        {message}
      </p>
    </form>
  );
}
