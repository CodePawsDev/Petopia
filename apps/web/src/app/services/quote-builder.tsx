'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  speciesLabels,
  type CatalogService,
  type PetSpecies,
} from './catalog-types';
import {
  isServiceQuote,
  type QuotePet,
  type ServiceQuote,
} from './quote-types';
import ServiceCard from './service-card';

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

export default function QuoteBuilder({
  branchId,
  services,
  species,
  weight,
  hasWeightError,
  pet,
}: {
  branchId: string;
  services: CatalogService[];
  species: PetSpecies;
  weight: number | null;
  hasWeightError: boolean;
  pet?: QuotePet;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quote, setQuote] = useState<ServiceQuote | null>(null);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  const visibleServices = services
    .map((service) => ({
      ...service,
      rates: service.rates.filter((rate) => rate.species === species),
    }))
    .filter((service) => service.rates.length > 0);

  const selectedKinds = new Set(
    visibleServices
      .filter((service) => selectedIds.includes(service.id))
      .map((service) => service.kind),
  );

  function toggleService(serviceId: string) {
    if (requestController.current) return;

    setQuote(null);
    setError('');
    setSelectedIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function calculateQuote() {
    if (
      !pet ||
      requestController.current ||
      selectedIds.length === 0 ||
      sessionExpired
    ) {
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setIsPending(true);
    setQuote(null);
    setError('');

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          petId: pet.id,
          serviceIds: selectedIds,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });

      if (controller.signal.aborted) return;

      if (!response.ok) {
        if (response.status === 401) {
          setSessionExpired(true);
          setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
        } else if (response.status === 400 || response.status === 404) {
          setError(
            'ข้อมูลสัตว์เลี้ยงหรือบริการอาจเปลี่ยนแปลง กรุณาโหลดหน้าใหม่แล้วเลือกอีกครั้ง',
          );
        } else {
          setError('คำนวณราคาไม่สำเร็จ กรุณาลองอีกครั้ง');
        }
        return;
      }

      const result: unknown = await response.json();

      if (
        !isServiceQuote(result) ||
        result.branch.id !== branchId ||
        result.pet.id !== pet.id ||
        result.items.length !== selectedIds.length ||
        !result.items.every((item) => selectedIds.includes(item.serviceId))
      ) {
        throw new Error('Invalid quote response');
      }

      if (!controller.signal.aborted) {
        setQuote(result);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;

        if (!controller.signal.aborted) {
          setIsPending(false);
        }
      }
    }
  }

  return (
    <section aria-labelledby="services-heading">
      <h2 id="services-heading" className="text-2xl font-bold">
        {pet
          ? `เลือกบริการสำหรับ ${pet.name}`
          : `บริการสำหรับ${speciesLabels[species]}`}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {pet
          ? 'เลือกได้หลายบริการ โดยอาบน้ำกับอาบน้ำพร้อมตัดขนเลือกได้อย่างใดอย่างหนึ่ง'
          : 'ราคาและระยะเวลาแตกต่างตามช่วงน้ำหนัก'}
      </p>

      {pet && weight === null && (
        <p className="mt-4 text-primary">
          กรุณาเพิ่มน้ำหนักที่{' '}
          <Link
            href={`/pets/${encodeURIComponent(pet.id)}/edit?branchId=${encodeURIComponent(branchId)}`}
            className="underline underline-offset-4"
          >
            ประวัติสัตว์เลี้ยง
          </Link>{' '}
          ก่อนเลือกบริการ
        </p>
      )}

      {visibleServices.length === 0 ? (
        <p role="status" className="mt-6 text-muted">
          ยังไม่มีบริการสำหรับ{speciesLabels[species]}ในสาขานี้
        </p>
      ) : (
        <ul className="mt-6 grid items-stretch gap-5 md:grid-cols-2">
          {visibleServices.map((service) => {
            const incompatible =
              (service.kind === 'BATH' &&
                selectedKinds.has('BATH_WITH_HAIRCUT')) ||
              (service.kind === 'BATH_WITH_HAIRCUT' &&
                selectedKinds.has('BATH'));

            const matchingRateCount =
              weight === null
                ? 0
                : service.rates.filter(
                    (rate) =>
                      weight > rate.minWeightKg && weight <= rate.maxWeightKg,
                  ).length;

            const reason =
              weight === null
                ? 'เพิ่มน้ำหนักในประวัติก่อนเลือกบริการ'
                : matchingRateCount !== 1
                  ? 'กรุณาติดต่อสาขาเพื่อประเมินราคา'
                  : incompatible
                    ? 'ยกเลิกบริการอาบน้ำที่เลือกไว้ก่อนเลือกบริการนี้'
                    : undefined;

            return (
              <li key={service.id} className="min-w-0">
                <ServiceCard
                  service={service}
                  weight={weight}
                  hasWeightError={hasWeightError}
                  selection={
                    pet
                      ? {
                          checked: selectedIds.includes(service.id),
                          disabled: isPending || sessionExpired || incompatible,
                          reason,
                          onChange: () => toggleService(service.id),
                        }
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {pet && (
        <div className="mt-8 rounded-3xl border border-border bg-surface p-6">
          <h3 className="text-xl font-bold">รายการที่เลือก</h3>

          {selectedIds.length === 0 ? (
            <p className="mt-3 text-muted">ยังไม่ได้เลือกบริการ</p>
          ) : (
            <ul className="mt-4 list-inside list-disc space-y-2">
              {visibleServices
                .filter((service) => selectedIds.includes(service.id))
                .map((service) => (
                  <li key={service.id}>{service.name}</li>
                ))}
            </ul>
          )}

          <button
            type="button"
            disabled={
              isPending ||
              sessionExpired ||
              weight === null ||
              selectedIds.length === 0
            }
            onClick={() => void calculateQuote()}
            className="mt-6 min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'กำลังคำนวณราคา…' : 'คำนวณราคารวม'}
          </button>

          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}

          {sessionExpired && (
            <Link
              href="/login"
              className="mt-3 inline-block text-primary underline underline-offset-4"
            >
              เข้าสู่ระบบอีกครั้ง
            </Link>
          )}

          {quote && (
            <div role="status" className="mt-6 rounded-2xl bg-surface-soft p-5">
              <p className="font-semibold">
                {quote.pet.name} · {quote.branch.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                คำนวณจากน้ำหนัก {quote.pet.weightKg} กก.
              </p>

              <ul className="mt-4 space-y-3">
                {quote.items.map((item) => (
                  <li
                    key={item.serviceId}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1"
                  >
                    <span className="min-w-0 break-words">{item.name}</span>
                    <span className="font-medium">
                      {priceFormatter.format(item.priceSatang / 100)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-border pt-4">
                <p className="flex flex-wrap justify-between gap-2 text-lg font-bold">
                  <span>รวม</span>
                  <span className="text-primary">
                    {priceFormatter.format(quote.totalPriceSatang / 100)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  ระยะเวลาประมาณ {quote.totalDurationMinutes} นาที
                </p>
              </div>

              {quote.requiresAssessment && (
                <p className="mt-4 font-medium text-primary">
                  ต้องให้เจ้าหน้าที่ประเมินก่อนยืนยันการจอง
                </p>
              )}

              <p className="mt-4 text-sm text-muted">
                การคำนวณราคานี้ยังไม่ใช่การจอง และยังไม่ได้สำรองเวลาให้บริการ
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
