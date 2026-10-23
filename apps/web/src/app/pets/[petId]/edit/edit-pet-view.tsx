'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PetForm from '../../pet-form';
import { isPet, type Pet } from '../../pet-types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; pet: Pet };

function returnToServices(petId: string) {
  const currentParams = new URLSearchParams(window.location.search);
  const returnParams = new URLSearchParams({ petId });
  const branchId = currentParams.get('branchId');

  if (branchId) {
    returnParams.set('branchId', branchId);
  }

  window.location.replace(`/services?${returnParams.toString()}`);
}
export default function EditPetView({ petId }: { petId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPet() {
      try {
        const response = await fetch(`/api/pets/${encodeURIComponent(petId)}`, {
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

        if (response.status === 400 || response.status === 404) {
          setState({
            status: 'error',
            message: 'ไม่พบสัตว์เลี้ยงที่ระบุ',
          });
          return;
        }

        if (!response.ok) {
          throw new Error('Pet request failed');
        }

        const result: unknown = await response.json();

        if (!isPet(result) || result.id !== petId) {
          throw new Error('Invalid pet response');
        }

        if (!controller.signal.aborted) {
          setState({ status: 'success', pet: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: 'โหลดประวัติไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void loadPet();

    return () => controller.abort();
  }, [petId, attempt]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="mt-6 text-muted">
        กำลังโหลดประวัติสัตว์เลี้ยง…
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
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
          className="mt-4 min-h-12 rounded-xl border border-primary px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ลองอีกครั้ง
        </button>
        <Link
          href="/services"
          className="mt-4 block text-primary underline underline-offset-4"
        >
          กลับหน้าเลือกบริการ
        </Link>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-6 sm:p-8">
      <PetForm
        pet={state.pet}
        onCancel={() => returnToServices(petId)}
        onSaved={() => returnToServices(petId)}
      />
    </section>
  );
}
