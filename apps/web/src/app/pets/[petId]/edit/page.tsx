import { Suspense } from 'react';
import EditPetView from './edit-pet-view';

export default function EditPetPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold text-primary">Petopia</p>
        <h1 className="mt-2 text-3xl font-bold">แก้ไขประวัติสัตว์เลี้ยง</h1>

        <Suspense
          fallback={
            <p role="status" className="mt-6 text-muted">
              กำลังโหลด…
            </p>
          }
        >
          <EditPetContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function EditPetContent({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;

  return <EditPetView key={petId} petId={petId} />;
}
