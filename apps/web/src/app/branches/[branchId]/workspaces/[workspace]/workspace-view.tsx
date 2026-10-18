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
  manager: 'จัดการสาขา',
  groomer: 'งานของช่าง',
  payment: 'รับชำระเงิน',
};

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (typeof value !== 'object' || value === null) return false;

  if (
    !('workspace' in value) ||
    !['manager', 'groomer', 'payment'].includes(
      String(value.workspace),
    ) ||
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
          setError('คุณไม่มีสิทธิ์เข้าหน้างานนี้ในสาขาที่เลือก');
          return;
        }

        if (response.status === 400 || response.status === 404) {
          setError('ไม่พบหน้างานหรือสาขาที่ระบุ');
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
          setError('โหลดหน้างานไม่สำเร็จ กรุณาลองอีกครั้ง');
          setCanRetry(true);
        }
      }
    }

    void loadWorkspace();

    return () => controller.abort();
  }, [branchId, workspace, router]);

  return (
    <section
      aria-labelledby="workspace-heading"
      className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <p className="mb-2 text-sm font-semibold text-teal-700">
        Petopia
      </p>

      <h1 id="workspace-heading" className="text-2xl font-bold">
        {workspaceTitles[workspace]}
      </h1>

      {error ? (
        <div className="mt-6">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>

          {canRetry && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              ลองอีกครั้ง
            </button>
          )}
        </div>
      ) : data ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">
            {data.branch.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.branch.code}
          </p>
          <p className="mt-6 text-sm text-slate-600">
            ยังไม่มีรายการให้แสดง ฟังก์ชันการทำงานส่วนนี้อยู่ระหว่างพัฒนา
          </p>
        </div>
      ) : (
        <p role="status" className="mt-6 text-sm text-slate-600">
          กำลังตรวจสอบสิทธิ์…
        </p>
      )}

      <Link
        href="/account"
        className="mt-8 inline-block rounded text-sm font-medium text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        กลับบัญชีของฉัน
      </Link>
    </section>
  );
}