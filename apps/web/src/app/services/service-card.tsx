import type { CatalogService } from './catalog-types';

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
});

const weightFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 3,
});

export default function ServiceCard({
  service,
  weight,
  hasWeightError,
}: {
  service: CatalogService;
  weight: number | null;
  hasWeightError: boolean;
}) {
  const matchingRates =
    weight === null
      ? []
      : service.rates.filter(
          (rate) => weight > rate.minWeightKg && weight <= rate.maxWeightKg,
        );

  const matchingRate = matchingRates.length === 1 ? matchingRates[0] : null;

  const startingPrice = Math.min(
    ...service.rates.map((rate) => rate.priceSatang),
  );

  return (
    <article className="h-full rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <h3 className="text-xl font-bold">{service.name}</h3>

      {service.description && (
        <p className="mt-2 whitespace-pre-line text-sm text-muted">
          {service.description}
        </p>
      )}

      <div className="mt-5 rounded-2xl bg-surface-soft p-4">
        {hasWeightError ? (
          <p className="text-sm text-muted">กรุณาตรวจสอบน้ำหนักเพื่อดูราคา</p>
        ) : weight === null ? (
          <>
            <p className="text-sm text-muted">ราคาเริ่มต้น</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              {priceFormatter.format(startingPrice / 100)}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              ระบุน้ำหนักเพื่อดูราคาและระยะเวลาที่ตรงกับสัตว์เลี้ยง
            </p>
          </>
        ) : matchingRate ? (
          <>
            <p className="text-sm text-muted">
              สำหรับน้ำหนัก {weightFormatter.format(weight)} กก.
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">
              {priceFormatter.format(matchingRate.priceSatang / 100)}
            </p>
            <p className="mt-2 text-sm text-muted">
              ระยะเวลาประมาณ {matchingRate.durationMinutes} นาที
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-primary">
            กรุณาติดต่อสาขาเพื่อประเมินราคา
          </p>
        )}
      </div>

      {service.rates.some((rate) => rate.requiresAssessment) && (
        <p className="mt-4 text-sm font-medium text-primary">
          ต้องให้เจ้าหน้าที่ประเมินก่อนยืนยันการจอง
        </p>
      )}
    </article>
  );
}
