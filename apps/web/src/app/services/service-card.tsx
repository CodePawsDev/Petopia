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
  selection,
}: {
  service: CatalogService;
  weight: number | null;
  hasWeightError: boolean;
  selection?: {
    checked: boolean;
    disabled: boolean;
    reason?: string;
    onChange: () => void;
  };
}) {
  const matchingRates =
    weight === null
      ? []
      : service.rates.filter(
          (rate) => weight > rate.minWeightKg && weight <= rate.maxWeightKg,
        );

  const matchingRate = matchingRates.length === 1 ? matchingRates[0] : null;

  const startingPrice =
    service.rates.length > 0
      ? Math.min(...service.rates.map((rate) => rate.priceSatang))
      : null;

  const requiresAssessment = matchingRate
    ? matchingRate.requiresAssessment
    : service.rates.some((rate) => rate.requiresAssessment);

  const canSelect =
    !hasWeightError &&
    matchingRate !== null &&
    selection !== undefined &&
    !selection.disabled;

  return (
    <article
      className={`h-full rounded-3xl border bg-surface p-6 shadow-sm ${
        selection?.checked ? 'border-primary' : 'border-border'
      }`}
    >
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
          startingPrice === null ? (
            <p className="text-sm text-muted">ยังไม่มีราคาสำหรับบริการนี้</p>
          ) : (
            <>
              <p className="text-sm text-muted">ราคาเริ่มต้น</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {priceFormatter.format(startingPrice / 100)}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted">
                ราคาขึ้นอยู่กับน้ำหนักสัตว์เลี้ยง
              </p>
            </>
          )
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

      {requiresAssessment && (
        <p className="mt-4 text-sm font-medium text-primary">
          ต้องให้เจ้าหน้าที่ประเมินก่อนยืนยันการจอง
        </p>
      )}

      {selection && (
        <div className="mt-5 border-t border-border pt-4">
          <label
            className={`flex min-h-12 items-center gap-3 rounded-xl ${
              canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={selection.checked}
              disabled={!canSelect}
              onChange={selection.onChange}
              aria-describedby={
                selection.reason ? `service-${service.id}-hint` : undefined
              }
              className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-semibold">
              {selection.checked ? 'เลือกแล้ว' : 'เลือกบริการนี้'}
              <span className="sr-only"> {service.name}</span>
            </span>
          </label>

          {selection.reason && (
            <p
              id={`service-${service.id}-hint`}
              className="mt-1 text-sm text-muted"
            >
              {selection.reason}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
