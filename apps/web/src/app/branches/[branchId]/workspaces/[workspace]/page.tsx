import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import WorkspaceView from './workspace-view';

type RouteParams = {
  branchId: string;
  workspace: string;
};

export default function WorkspacePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<p role="status">กำลังโหลดหน้าทำงาน…</p>}>
          <WorkspaceContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function WorkspaceContent({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { branchId, workspace } = await params;

  if (
    workspace !== 'manager' &&
    workspace !== 'groomer' &&
    workspace !== 'payment'
  ) {
    notFound();
  }

  return (
    <WorkspaceView
      key={`${branchId}:${workspace}`}
      branchId={branchId}
      workspace={workspace}
    />
  );
}