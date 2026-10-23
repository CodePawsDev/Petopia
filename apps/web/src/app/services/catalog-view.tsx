'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  isBranchOptions,
  isGroomerCatalog,
  isServiceCatalog,
  speciesLabels,
  type PetSpecies,
} from './catalog-types';
import { isQuotePets, type QuotePet } from './quote-types';
import QuoteBuilder from './quote-builder';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'error' }
  | { status: 'success'; data: T };

const buttonClassName =
  'min-h-12 rounded-xl border border-primary px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function useApiData<T>(
  url: string,
  validate: (value: unknown) => value is T,
) {
  const [state, setState] = useState<LoadState<T>>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

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
          setState({ status: 'unauthenticated' });
          return;
        }

        if (!response.ok) {
          throw new Error('Request failed');
        }

        const result: unknown = await response.json();

        if (!validate(result)) {
          throw new Error('Invalid response');
        }

        if (!controller.signal.aborted) {
          setState({ status: 'success', data: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: 'error' });
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [url, validate, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }

  return { state, retry };
}

function RetryMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4">
      <p role="alert" className="text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`${buttonClassName} mt-4`}
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}

export default function CatalogView() {
  return (
    <Suspense fallback={<p role="status">กำลังโหลดบริการ…</p>}>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const branches = useApiData('/api/catalog/branches', isBranchOptions);
  const pets = useApiData('/api/pets', isQuotePets);

  const [selectedBranchId, setSelectedBranchId] = useState(
    searchParams.get('branchId') ?? '',
  );
  const [selectedPetId, setSelectedPetId] = useState(
    searchParams.get('petId') ?? '',
  );
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const [weightInput, setWeightInput] = useState('');

  if (branches.state.status === 'loading') {
    return <p role="status">กำลังโหลดสาขา…</p>;
  }

  if (branches.state.status !== 'success') {
    return (
      <RetryMessage
        message="โหลดสาขาไม่สำเร็จ กรุณาลองอีกครั้ง"
        onRetry={branches.retry}
      />
    );
  }

  if (branches.state.data.length === 0) {
    return <p role="status">ยังไม่มีสาขาที่เปิดให้บริการ</p>;
  }

  const branchId = branches.state.data.some(
    (branch) => branch.id === selectedBranchId,
  )
    ? selectedBranchId
    : branches.state.data[0].id;

  const activePets =
    pets.state.status === 'success'
      ? pets.state.data.filter((pet) => pet.archivedAt === null)
      : [];

  const selectedPet = activePets.find((pet) => pet.id === selectedPetId);
  const isGuest = pets.state.status === 'unauthenticated';

  const trimmedWeight = weightInput.trim();

  const hasWeightError =
    trimmedWeight !== '' &&
    (!/^\d+(?:\.\d{1,3})?$/.test(trimmedWeight) ||
      !Number.isFinite(Number(trimmedWeight)) ||
      Number(trimmedWeight) <= 0);

  const guestWeight =
    trimmedWeight === '' || hasWeightError
      ? null
      : Number(trimmedWeight);

  const displayedSpecies = selectedPet?.species ?? species;
  const displayedWeight = selectedPet
    ? selectedPet.weightKg
    : guestWeight;

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="catalog-filter-heading"
        className="rounded-3xl border border-border bg-surface p-6 sm:p-8"
      >
        <h2 id="catalog-filter-heading" className="text-xl font-bold">
          เลือกสาขาและสัตว์เลี้ยง
        </h2>

        <div className="mt-6">
          <label
            htmlFor="catalog-branch"
            className="mb-2 block font-medium"
          >
            สาขา
          </label>

          <div className="relative">
            <select
              id="catalog-branch"
              value={branchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="min-h-12 w-full appearance-none rounded-xl border border-input-border bg-surface py-3 pr-12 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {branches.state.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <SelectArrow />
          </div>
        </div>

        {pets.state.status === 'loading' ? (
          <p role="status" className="mt-6 text-muted">
            กำลังโหลดสัตว์เลี้ยง…
          </p>
        ) : pets.state.status === 'error' ? (
          <RetryMessage
            message="โหลดสัตว์เลี้ยงไม่สำเร็จ กรุณาลองอีกครั้ง"
            onRetry={pets.retry}
          />
        ) : isGuest ? (
          <div className="mt-6">
            <p className="text-sm font-medium text-primary">
              เลือกประเภทและระบุน้ำหนักสัตว์เลี้ยงเพื่อดูราคาเบื้องต้น
            </p>

            <fieldset className="mt-5">
              <legend className="font-medium">
                ประเภทสัตว์เลี้ยง
              </legend>

              <div className="mt-3 flex flex-wrap gap-3">
                {(['DOG', 'CAT', 'RABBIT'] as const).map((option) => (
                  <label key={option} className="cursor-pointer">
                    <input
                      type="radio"
                      name="catalog-species"
                      checked={species === option}
                      onChange={() => setSpecies(option)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-12 items-center rounded-xl border border-border px-5 py-3 peer-checked:border-primary peer-checked:bg-surface-soft peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                      {speciesLabels[option]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 max-w-sm">
              <label
                htmlFor="catalog-weight"
                className="mb-2 block font-medium"
              >
                น้ำหนักสัตว์เลี้ยง (กก.)
              </label>

              <input
                id="catalog-weight"
                type="text"
                inputMode="decimal"
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder="เช่น 5.5"
                aria-invalid={hasWeightError}
                aria-describedby="catalog-weight-hint"
                className="min-h-12 w-full rounded-xl border border-input-border bg-surface px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />

              <p
                id="catalog-weight-hint"
                className={`mt-2 text-sm ${
                  hasWeightError ? 'text-danger' : 'text-muted'
                }`}
              >
                {hasWeightError
                  ? 'กรุณาระบุน้ำหนักมากกว่า 0 และใช้ทศนิยมไม่เกิน 3 ตำแหน่ง'
                  : 'เว้นว่างเพื่อดูราคาเริ่มต้น'}
              </p>
            </div>
          </div>
        ) : activePets.length === 0 ? (
          <div className="mt-6">
            <p className="text-muted">
              เพิ่มสัตว์เลี้ยงก่อนเลือกบริการ
            </p>
            <Link
              href="/pets"
              className="mt-3 inline-block font-semibold text-primary underline underline-offset-4"
            >
              เพิ่มสัตว์เลี้ยง
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <label
              htmlFor="catalog-pet"
              className="mb-2 block font-medium"
            >
              สัตว์เลี้ยงของฉัน
            </label>

            <div className="relative">
              <select
                id="catalog-pet"
                value={selectedPet?.id ?? ''}
                onChange={(event) => setSelectedPetId(event.target.value)}
                className="min-h-12 w-full appearance-none rounded-xl border border-input-border bg-surface py-3 pr-12 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="">เลือกสัตว์เลี้ยง</option>
                {activePets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                  </option>
                ))}
              </select>
              <SelectArrow />
            </div>

            {selectedPet && (
              <div className="mt-4 rounded-2xl bg-surface-soft p-4">
                <p className="font-semibold">
                  {selectedPet.name} · {speciesLabels[selectedPet.species]} ·{' '}
                  {selectedPet.weightKg === null
                    ? 'ยังไม่ระบุน้ำหนัก'
                    : `${selectedPet.weightKg} กก.`}
                </p>

                <p className="mt-1 text-sm text-muted">
                  ใช้ข้อมูลจากประวัติสัตว์เลี้ยง ·{' '}
                  <Link
                    href={`/pets/${encodeURIComponent(selectedPet.id)}/edit?branchId=${encodeURIComponent(branchId)}`}
                    className="text-primary underline underline-offset-4"
                  >
                    แก้ไขประวัติ
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {(isGuest || selectedPet) && (
        <BranchServices
          key={`${branchId}:${selectedPet?.id ?? 'guest'}:${displayedSpecies}`}
          branchId={branchId}
          species={displayedSpecies}
          weight={displayedWeight}
          hasWeightError={isGuest && hasWeightError}
          pet={selectedPet}
        />
      )}

      {isGuest && (
        <div className="rounded-2xl border border-primary bg-surface-soft p-5">
          <h2 className="text-xl font-bold">
            สนใจบริการสำหรับสัตว์เลี้ยงของคุณ?
          </h2>
          <p className="mt-2 text-sm text-muted">
            เข้าสู่ระบบเพื่อเลือกสัตว์เลี้ยง เลือกหลายบริการ
            และคำนวณราคารวม
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            เข้าสู่ระบบเพื่อใช้บริการ
          </Link>
        </div>
      )}

      <BranchGroomers key={branchId} branchId={branchId} />
    </div>
  );
}

function SelectArrow() {
  return (
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
  );
}

function BranchServices({
  branchId,
  species,
  weight,
  hasWeightError,
  pet,
}: {
  branchId: string;
  species: PetSpecies;
  weight: number | null;
  hasWeightError: boolean;
  pet?: QuotePet;
}) {
  const services = useApiData(
    `/api/catalog/branches/${encodeURIComponent(branchId)}/services`,
    isServiceCatalog,
  );

  if (services.state.status === 'loading') {
    return <p role="status">กำลังโหลดบริการ…</p>;
  }

  if (
    services.state.status !== 'success' ||
    services.state.data.branch.id !== branchId
  ) {
    return (
      <RetryMessage
        message="โหลดบริการไม่สำเร็จ กรุณาลองอีกครั้ง"
        onRetry={services.retry}
      />
    );
  }

  return (
    <QuoteBuilder
      branchId={branchId}
      services={services.state.data.services}
      species={species}
      weight={weight}
      hasWeightError={hasWeightError}
      pet={pet}
    />
  );
}

function BranchGroomers({ branchId }: { branchId: string }) {
  const groomers = useApiData(
    `/api/catalog/branches/${encodeURIComponent(branchId)}/groomers`,
    isGroomerCatalog,
  );

  return (
    <section className="rounded-3xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">ช่างประจำสาขา</h2>

      {groomers.state.status === 'loading' ? (
        <p role="status" className="mt-4 text-muted">
          กำลังโหลดรายชื่อช่าง…
        </p>
      ) : groomers.state.status !== 'success' ||
        groomers.state.data.branch.id !== branchId ? (
        <RetryMessage
          message="โหลดรายชื่อช่างไม่สำเร็จ"
          onRetry={groomers.retry}
        />
      ) : groomers.state.data.groomers.length === 0 ? (
        <p className="mt-4 text-muted">
          ยังไม่มีรายชื่อช่างในสาขานี้
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {groomers.state.data.groomers.map((groomer) => (
            <li
              key={groomer.id}
              className="rounded-2xl bg-surface-soft p-4 font-medium"
            >
              {groomer.displayName}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
        รายชื่อช่างไม่ได้แสดงเวลาว่างสำหรับการจอง
      </p>
    </section>
  );
}