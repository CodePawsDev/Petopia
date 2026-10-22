'use client';

import { useEffect, useState } from 'react';
import {
  isBranchOptions,
  isGroomerCatalog,
  isServiceCatalog,
  speciesLabels,
  type BranchOption,
  type GroomerCatalog,
  type PetSpecies,
  type ServiceCatalog,
} from './catalog-types';
import ServiceCard from './service-card';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

const speciesOptions: PetSpecies[] = ['DOG', 'CAT', 'RABBIT'];

const retryClassName =
  'mt-4 min-h-12 rounded-xl border border-primary px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });

  if (!response.ok) {
    throw new Error(`Catalog request failed: ${response.status}`);
  }

  return response.json();
}

export default function CatalogView() {
  const [branches, setBranches] = useState<LoadState<BranchOption[]>>({
    status: 'loading',
  });
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const [weightInput, setWeightInput] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        const result = await fetchJson(
          '/api/catalog/branches',
          controller.signal,
        );

        if (!isBranchOptions(result)) {
          throw new Error('Invalid branch response');
        }

        if (!controller.signal.aborted) {
          setBranches({ status: 'success', data: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setBranches({
            status: 'error',
            message: 'โหลดรายชื่อสาขาไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void loadBranches();

    return () => controller.abort();
  }, [attempt]);

  if (branches.status === 'loading') {
    return (
      <p role="status" className="text-muted">
        กำลังโหลดสาขา…
      </p>
    );
  }

  if (branches.status === 'error') {
    return (
      <div>
        <p role="alert" className="text-danger">
          {branches.message}
        </p>
        <button
          type="button"
          className={retryClassName}
          onClick={() => {
            setBranches({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  if (branches.data.length === 0) {
    return (
      <p role="status" className="text-muted">
        ยังไม่มีสาขาที่เปิดให้บริการ
      </p>
    );
  }

  const branchId = branches.data.some(
    (branch) => branch.id === selectedBranchId,
  )
    ? selectedBranchId
    : branches.data[0].id;

  const trimmedWeight = weightInput.trim();

  const hasWeightError =
    trimmedWeight !== '' &&
    (!/^\d+(?:\.\d{1,3})?$/.test(trimmedWeight) ||
      !Number.isFinite(Number(trimmedWeight)) ||
      Number(trimmedWeight) <= 0);

  const weight =
    trimmedWeight === '' || hasWeightError ? null : Number(trimmedWeight);

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="catalog-filter-heading"
        className="rounded-3xl border border-border bg-surface p-6 sm:p-8"
      >
        <h2 id="catalog-filter-heading" className="text-xl font-bold">
          ดูบริการสำหรับเพื่อนตัวน้อย
        </h2>

        <div className="mt-6">
          <label htmlFor="catalog-branch" className="mb-2 block font-medium">
            สาขา
          </label>

          <div className="relative">
            <select
              id="catalog-branch"
              value={branchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="min-h-12 w-full appearance-none rounded-xl border border-input-border bg-surface py-3 pr-12 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {branches.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
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
        </div>

        <fieldset className="mt-6">
          <legend className="font-medium">ประเภทสัตว์เลี้ยง</legend>

          <div className="mt-3 flex flex-wrap gap-3">
            {speciesOptions.map((option) => (
              <label key={option} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="catalog-species"
                  value={option}
                  checked={species === option}
                  onChange={() => setSpecies(option)}
                  className="peer sr-only"
                />
                <span className="flex min-h-12 items-center rounded-xl border border-border bg-surface px-6 py-3 font-medium peer-checked:border-primary peer-checked:bg-surface-soft peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  {speciesLabels[option]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 max-w-sm">
          <label htmlFor="catalog-weight" className="mb-2 block font-medium">
            น้ำหนักสัตว์เลี้ยง (กก.)
            <span className="ml-2 text-sm font-normal text-muted">
              ไม่บังคับ
            </span>
          </label>

          <input
            id="catalog-weight"
            type="text"
            inputMode="decimal"
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            placeholder="เช่น 5.5"
            aria-invalid={hasWeightError}
            aria-describedby={
              hasWeightError ? 'catalog-weight-error' : 'catalog-weight-hint'
            }
            className="min-h-12 w-full rounded-xl border border-input-border bg-surface px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />

          {hasWeightError ? (
            <p id="catalog-weight-error" className="mt-2 text-sm text-danger">
              กรุณาระบุน้ำหนักมากกว่า 0 และใช้ทศนิยมไม่เกิน 3 ตำแหน่ง
            </p>
          ) : (
            <p id="catalog-weight-hint" className="mt-2 text-sm text-muted">
              เว้นว่างเพื่อดูราคาเริ่มต้น
            </p>
          )}
        </div>
      </section>

      <BranchCatalog
        key={branchId}
        branchId={branchId}
        species={species}
        weight={weight}
        hasWeightError={hasWeightError}
      />
    </div>
  );
}

function BranchCatalog({
  branchId,
  species,
  weight,
  hasWeightError,
}: {
  branchId: string;
  species: PetSpecies;
  weight: number | null;
  hasWeightError: boolean;
}) {
  const [services, setServices] = useState<LoadState<ServiceCatalog>>({
    status: 'loading',
  });
  const [groomers, setGroomers] = useState<LoadState<GroomerCatalog>>({
    status: 'loading',
  });
  const [servicesAttempt, setServicesAttempt] = useState(0);
  const [groomersAttempt, setGroomersAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      try {
        const result = await fetchJson(
          `/api/catalog/branches/${encodeURIComponent(branchId)}/services`,
          controller.signal,
        );

        if (!isServiceCatalog(result) || result.branch.id !== branchId) {
          throw new Error('Invalid service catalog response');
        }

        if (!controller.signal.aborted) {
          setServices({ status: 'success', data: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setServices({
            status: 'error',
            message: 'โหลดรายการบริการไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void loadServices();

    return () => controller.abort();
  }, [branchId, servicesAttempt]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGroomers() {
      try {
        const result = await fetchJson(
          `/api/catalog/branches/${encodeURIComponent(branchId)}/groomers`,
          controller.signal,
        );

        if (!isGroomerCatalog(result) || result.branch.id !== branchId) {
          throw new Error('Invalid groomer catalog response');
        }

        if (!controller.signal.aborted) {
          setGroomers({ status: 'success', data: result });
        }
      } catch {
        if (!controller.signal.aborted) {
          setGroomers({
            status: 'error',
            message: 'โหลดรายชื่อช่างไม่สำเร็จ กรุณาลองอีกครั้ง',
          });
        }
      }
    }

    void loadGroomers();

    return () => controller.abort();
  }, [branchId, groomersAttempt]);

  const visibleServices =
    services.status === 'success'
      ? services.data.services
          .map((service) => ({
            ...service,
            rates: service.rates
              .filter((rate) => rate.species === species)
              .sort((a, b) => a.minWeightKg - b.minWeightKg),
          }))
          .filter((service) => service.rates.length > 0)
      : [];

  return (
    <div className="space-y-8">
      <section aria-labelledby="services-heading" className="min-w-0">
        <h2 id="services-heading" className="text-2xl font-bold">
          บริการสำหรับ{speciesLabels[species]}
        </h2>
        <p className="mt-2 text-sm text-muted">
          ราคาและระยะเวลาแตกต่างตามช่วงน้ำหนัก
        </p>

        {services.status === 'loading' ? (
          <p role="status" className="mt-6 text-muted">
            กำลังโหลดบริการ…
          </p>
        ) : services.status === 'error' ? (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
            <p role="alert" className="text-danger">
              {services.message}
            </p>
            <button
              type="button"
              className={retryClassName}
              onClick={() => {
                setServices({ status: 'loading' });
                setServicesAttempt((value) => value + 1);
              }}
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : visibleServices.length === 0 ? (
          <p role="status" className="mt-6 text-muted">
            ยังไม่มีบริการสำหรับ{speciesLabels[species]}ในสาขานี้
          </p>
        ) : (
          <ul className="mt-6 grid items-start gap-5 md:grid-cols-2">
            {visibleServices.map((service) => (
              <li key={service.id} className="min-w-0">
                <ServiceCard
                  key={`${service.id}:${species}`}
                  service={service}
                  weight={weight}
                  hasWeightError={hasWeightError}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="groomers-heading"
        className="min-w-0 rounded-3xl border border-border bg-surface p-6"
      >
        <h2 id="groomers-heading" className="text-xl font-bold">
          ช่างประจำสาขา
        </h2>
        <p className="mt-2 text-sm text-muted">รายชื่อช่างของสาขาที่เลือก</p>

        {groomers.status === 'loading' ? (
          <p role="status" className="mt-6 text-sm text-muted">
            กำลังโหลดรายชื่อช่าง…
          </p>
        ) : groomers.status === 'error' ? (
          <div className="mt-6">
            <p role="alert" className="text-sm text-danger">
              {groomers.message}
            </p>
            <button
              type="button"
              className={retryClassName}
              onClick={() => {
                setGroomers({ status: 'loading' });
                setGroomersAttempt((value) => value + 1);
              }}
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : groomers.data.groomers.length === 0 ? (
          <p role="status" className="mt-6 text-sm text-muted">
            ยังไม่มีรายชื่อช่างในสาขานี้
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {groomers.data.groomers.map((groomer) => (
              <li
                key={groomer.id}
                className="flex items-center gap-3 rounded-2xl bg-surface-soft p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface font-bold text-primary"
                >
                  {Array.from(groomer.displayName)[0]}
                </span>
                <span className="min-w-0 break-words font-medium">
                  {groomer.displayName}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
          รายชื่อช่างไม่ได้แสดงเวลาว่างสำหรับการจอง
        </p>
      </section>
    </div>
  );
}
