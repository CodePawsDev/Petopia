import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import BranchBookingsView from './branch-bookings-view';

type RouteParams = {
  branchId: string;
  workspace: string;
};

export default function BranchBookingsPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Suspense
          fallback={
            <p role="status" className="rounded-3xl bg-surface p-8 text-muted">
              กำลังโหลดหน้านัดหมาย…
            </p>
          }
        >
          <BranchBookingsContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function BranchBookingsContent({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { branchId, workspace } = await params;

  if (workspace !== 'manager' && workspace !== 'groomer') {
    notFound();
  }

  return (
    <BranchBookingsView
      key={`${branchId}:${workspace}`}
      branchId={branchId}
      workspace={workspace}
    />
  );
}
