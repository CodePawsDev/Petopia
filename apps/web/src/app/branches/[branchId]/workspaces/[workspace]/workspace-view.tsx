'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Workspace = 'manager' | 'groomer' | 'payment';

type WorkspaceData = {
  workspace: Workspace;
  branch: {
    id: string;
    code: string;
    name: string;
  };
};

const workspaceTitles: Record<Workspace, string> = {
  manager: 'ผู้จัดการสาขา',
  groomer: 'งานของช่าง',
  payment: 'รับชำระเงิน',
};

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (typeof value !== 'object' || value === null) return false;

  if (
    !('workspace' in value) ||
    (value.workspace !== 'manager' &&
      value.workspace !== 'groomer' &&
      value.workspace !== 'payment') ||
    !('branch' in value) ||
    typeof value.branch !== 'object' ||
    value.branch === null
  ) {
    return false;
  }

  const branch = value.branch;

  return (
    'id' in branch &&
    typeof branch.id === 'string' &&
    'code' in branch &&
    typeof branch.code === 'string' &&
    'name' in branch &&
    typeof branch.name === 'string'
  );
}

export default function WorkspaceView({
  branchId,
  workspace,
}: {
  branchId: string;
  workspace: Workspace;
}) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      try {
        const response = await fetch(
          `/api/branches/${encodeURIComponent(branchId)}/workspaces/${workspace}`,
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
          router.replace('/login');
          return;
        }

        if (response.status === 403) {
          setError('คุณไม่มีสิทธิ์เข้าพื้นที่ทำงานนี้ในสาขาที่เลือก');
          return;
        }

        if (response.status === 400 || response.status === 404) {
          setError('ไม่พบพื้นที่ทำงานหรือสาขาที่ระบุ');
          return;
        }

        if (!response.ok) {
          throw new Error('Workspace request failed');
        }

        const result: unknown = await response.json();

        if (
          !isWorkspaceData(result) ||
          result.workspace !== workspace ||
          result.branch.id !== branchId
        ) {
          throw new Error('Invalid workspace response');
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('โหลดพื้นที่ทำงานไม่สำเร็จ กรุณาลองอีกครั้ง');
          setCanRetry(true);
        }
      }
    }

    void loadWorkspace();

    return () => controller.abort();
  }, [branchId, workspace, router]);

  return (
    <>
      <Link
        href="/account"
        className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true">←</span>
        กลับบัญชีของฉัน
      </Link>

      <section
        aria-labelledby="workspace-heading"
        className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10"
      >
        <p className="mb-3 text-lg font-bold text-primary">Petopia</p>

        <p className="mb-2 text-sm text-muted">พื้นที่ทำงาน</p>
        <h1 id="workspace-heading" className="text-2xl font-bold sm:text-3xl">
          {workspaceTitles[workspace]}
        </h1>

        {error ? (
          <div className="mt-7 rounded-2xl border border-danger/30 bg-surface-soft p-5">
            <p role="alert" className="text-sm leading-7 text-danger">
              {error}
            </p>

            {canRetry && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 min-h-12 rounded-xl border border-primary bg-surface px-5 py-3 text-sm font-semibold text-primary hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ลองอีกครั้ง
              </button>
            )}
          </div>
        ) : data ? (
          <div className="mt-7">
            <div className="rounded-2xl bg-surface-soft p-5 sm:p-6">
              <p className="text-sm text-muted">สาขาที่กำลังใช้งาน</p>
              <h2 className="mt-2 break-words text-xl font-semibold">
                {data.branch.name}
              </h2>
              <p className="mt-2 break-all text-sm text-muted">
                {data.branch.code}
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <h2 className="font-semibold">ยังไม่มีรายการในพื้นที่ทำงานนี้</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                ฟังก์ชันการทำงานส่วนนี้อยู่ระหว่างพัฒนา
              </p>
            </div>
          </div>
        ) : (
          <p
            role="status"
            className="mt-7 rounded-2xl bg-surface-soft p-5 text-sm text-muted"
          >
            กำลังตรวจสอบสิทธิ์…
          </p>
        )}
      </section>
    </>
  );
}
