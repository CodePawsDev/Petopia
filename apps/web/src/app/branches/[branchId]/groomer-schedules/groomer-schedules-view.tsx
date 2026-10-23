'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import WeeklyScheduleEditor from './weekly-schedule-editor';
import TimeOffEditor from './time-off-editor';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  code: string;
  name: string;
};

type Groomer = {
  id: string;
  displayName: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; canRetry: boolean }
  | { status: 'success'; branch: Branch; groomers: Groomer[] };

type EditorStatus = {
  dirty: boolean;
  busy: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBranch(value: unknown): value is Branch {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string'
  );
}

function isManagerWorkspace(
  value: unknown,
): value is { workspace: 'manager'; branch: Branch } {
  return (
    isRecord(value) && value.workspace === 'manager' && isBranch(value.branch)
  );
}

function isGroomer(value: unknown): value is Groomer {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string'
  );
}

function isGroomerList(
  value: unknown,
): value is { branch: Branch; groomers: Groomer[] } {
  return (
    isRecord(value) &&
    isBranch(value.branch) &&
    Array.isArray(value.groomers) &&
    value.groomers.every(isGroomer)
  );
}

export default function GroomerSchedulesView({
  branchId,
}: {
  branchId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedGroomerId, setSelectedGroomerId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [weeklyStatus, setWeeklyStatus] = useState<EditorStatus>({
    dirty: false,
    busy: false,
  });
  const [timeOffStatus, setTimeOffStatus] = useState<EditorStatus>({
    dirty: false,
    busy: false,
  });
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  const managerPath = `/branches/${encodeURIComponent(branchId)}/workspaces/manager`;
  const [pendingGroomerId, setPendingGroomerId] = useState('');

  const switchDialogRef = useRef<HTMLDialogElement | null>(null);

  const handleWeeklyStatus = useCallback((status: EditorStatus) => {
    setWeeklyStatus(status);
  }, []);

  const handleTimeOffStatus = useCallback((status: EditorStatus) => {
    setTimeOffStatus(status);
  }, []);

  const hasUnsavedChanges = weeklyStatus.dirty || timeOffStatus.dirty;
  const isBusy = weeklyStatus.busy || timeOffStatus.busy;

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  function switchGroomer(nextId: string) {
    setWeeklyStatus({ dirty: false, busy: false });
    setTimeOffStatus({ dirty: false, busy: false });
    setSelectedGroomerId(nextId);
  }

  function requestGroomerChange(nextId: string) {
    if (isBusy || nextId === selectedGroomerId) return;

    if (hasUnsavedChanges) {
      setIsLeaving(false);
      setPendingGroomerId(nextId);
      switchDialogRef.current?.showModal();
      return;
    }

    switchGroomer(nextId);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const options: RequestInit = {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      };

      try {
        const accessResponse = await fetch(
          `/api/branches/${encodeURIComponent(branchId)}/workspaces/manager`,
          options,
        );

        if (controller.signal.aborted) return;

        if (accessResponse.status === 401) {
          window.location.replace('/login');
          return;
        }

        if (accessResponse.status === 403) {
          setState({
            status: 'error',
            message: 'คุณไม่มีสิทธิ์จัดการตารางช่างในสาขานี้',
            canRetry: false,
          });
          return;
        }

        if (accessResponse.status === 400 || accessResponse.status === 404) {
          setState({
            status: 'error',
            message: 'ไม่พบสาขาที่ระบุหรือสาขาไม่พร้อมใช้งาน',
            canRetry: false,
          });
          return;
        }

        if (!accessResponse.ok) {
          throw new Error('Workspace request failed');
        }

        const access: unknown = await accessResponse.json();

        if (!isManagerWorkspace(access) || access.branch.id !== branchId) {
          throw new Error('Invalid workspace response');
        }

        const groomersResponse = await fetch(
          `/api/catalog/branches/${encodeURIComponent(branchId)}/groomers`,
          options,
        );

        if (!groomersResponse.ok) {
          throw new Error('Groomers request failed');
        }

        const result: unknown = await groomersResponse.json();

        if (!isGroomerList(result) || result.branch.id !== branchId) {
          throw new Error('Invalid groomers response');
        }

        if (!controller.signal.aborted) {
          setState({
            status: 'success',
            branch: access.branch,
            groomers: result.groomers,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
            canRetry: true,
          });
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [branchId, attempt]);

  const selectedGroomer =
    state.status === 'success'
      ? state.groomers.find((groomer) => groomer.id === selectedGroomerId)
      : undefined;

  return (
    <>
      <Link
        href={managerPath}
        aria-disabled={isBusy}
        onClick={(event) => {
          if (isBusy) {
            event.preventDefault();
            return;
          }

          if (hasUnsavedChanges) {
            event.preventDefault();
            setIsLeaving(true);
            switchDialogRef.current?.showModal();
          }
        }}
        className={`mb-6 inline-flex min-h-11 items-center rounded-lg font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          isBusy ? 'cursor-wait opacity-60' : ''
        }`}
      >
        กลับพื้นที่ผู้จัดการ
      </Link>

      <section
        aria-labelledby="schedule-heading"
        className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold text-primary">Petopia</p>

        <h1
          id="schedule-heading"
          className="mt-2 text-2xl font-bold sm:text-3xl"
        >
          ตารางช่างและวันหยุด
        </h1>

        {state.status === 'loading' ? (
          <p role="status" className="mt-6 text-muted">
            กำลังตรวจสอบสิทธิ์และโหลดรายชื่อช่าง…
          </p>
        ) : state.status === 'error' ? (
          <div className="mt-6">
            <p role="alert" className="text-danger">
              {state.message}
            </p>

            {state.canRetry && (
              <button
                type="button"
                onClick={() => {
                  setState({ status: 'loading' });
                  setAttempt((value) => value + 1);
                }}
                className="mt-4 min-h-12 rounded-xl border border-primary px-5 py-3 font-semibold text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ลองอีกครั้ง
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <div className="rounded-2xl bg-surface-soft p-5">
              <h2 className="break-words text-lg font-semibold">
                {state.branch.name}
              </h2>
              <p className="mt-1 break-all text-sm text-muted">
                {state.branch.code}
              </p>
            </div>

            {state.groomers.length === 0 ? (
              <p className="mt-6 text-muted">
                ยังไม่มีช่างที่พร้อมใช้งานในสาขานี้
              </p>
            ) : (
              <div className="mt-6">
                <label
                  htmlFor="schedule-groomer"
                  className="mb-2 block font-semibold"
                >
                  เลือกช่าง
                </label>

                <div className="relative">
                  <select
                    id="schedule-groomer"
                    value={selectedGroomerId}
                    onChange={(event) =>
                      requestGroomerChange(event.target.value)
                    }
                    disabled={isBusy}
                    className="min-h-12 w-full appearance-none rounded-xl border border-input-border bg-surface py-3 pr-12 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
                  >
                    <option value="">กรุณาเลือกช่าง</option>
                    {state.groomers.map((groomer) => (
                      <option key={groomer.id} value={groomer.id}>
                        {groomer.displayName}
                      </option>
                    ))}
                  </select>

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>

                {selectedGroomer && (
                  <div className="mt-6 border-t border-border pt-6">
                    <h2 className="text-xl font-bold">
                      ตารางของ {selectedGroomer.displayName}
                    </h2>

                    <p className="mt-2 text-sm text-muted">
                      เวลาทำการ 09:00–18:00 ตามเวลาไทย
                    </p>

                    <WeeklyScheduleEditor
                      key={`weekly:${branchId}:${selectedGroomer.id}`}
                      branchId={branchId}
                      groomerId={selectedGroomer.id}
                      onStatusChange={handleWeeklyStatus}
                    />

                    <TimeOffEditor
                      key={`time-off:${branchId}:${selectedGroomer.id}`}
                      branchId={branchId}
                      groomerId={selectedGroomer.id}
                      onStatusChange={handleTimeOffStatus}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      <dialog
        ref={switchDialogRef}
        aria-labelledby="switch-groomer-heading"
        aria-describedby="switch-groomer-description"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 id="switch-groomer-heading" className="text-xl font-bold">
          {isLeaving ? 'ออกจากหน้าโดยไม่บันทึก?' : 'เปลี่ยนช่างโดยไม่บันทึก?'}
        </h2>

        <p
          id="switch-groomer-description"
          className="mt-3 text-sm leading-7 text-muted"
        >
          มีข้อมูลตารางหรือแบบฟอร์มวันหยุดที่ยังไม่บันทึก หากดำเนินการต่อ
          ข้อมูลส่วนนี้จะถูกทิ้ง
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => switchDialogRef.current?.close()}
            className="min-h-12 rounded-xl border border-border px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            แก้ไขต่อ
          </button>

          <button
            type="button"
            onClick={() => {
              switchDialogRef.current?.close();

              if (isLeaving) {
                router.push(managerPath);
                return;
              }

              switchGroomer(pendingGroomerId);
            }}
            className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isLeaving ? 'ทิ้งข้อมูลและออกจากหน้า' : 'ทิ้งข้อมูลและเปลี่ยนช่าง'}
          </button>
        </div>
      </dialog>
    </>
  );
}
