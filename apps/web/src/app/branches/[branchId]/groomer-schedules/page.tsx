import { Suspense } from 'react';
import GroomerSchedulesView from './groomer-schedules-view';

export default function GroomerSchedulesPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Suspense
          fallback={
            <p role="status" className="text-muted">
              กำลังโหลดหน้าตารางช่าง…
            </p>
          }
        >
          <GroomerSchedulesContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function GroomerSchedulesContent({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;

  return (
    <GroomerSchedulesView
      key={branchId}
      branchId={branchId}
    />
  );
}