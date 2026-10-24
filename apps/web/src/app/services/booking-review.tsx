import type { AvailabilitySlot } from './availability-types';
import type { ServiceQuote } from './quote-types';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const priceFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
});

export default function BookingReview({
  quote,
  groomerName,
  slot,
}: {
  quote: ServiceQuote;
  groomerName: string;
  slot: AvailabilitySlot;
}) {
  const startsAt = new Date(slot.startsAt);
  const serviceEndsAt = new Date(slot.serviceEndsAt);

  return (
    <section className="mt-6 rounded-2xl border border-primary bg-surface-soft p-5 sm:p-6">
      <h4 className="text-lg font-bold">ตรวจสอบรายการก่อนยืนยันจอง</h4>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">สัตว์เลี้ยง</dt>
          <dd className="mt-1 break-words font-semibold">{quote.pet.name}</dd>
        </div>

        <div>
          <dt className="text-muted">สาขา</dt>
          <dd className="mt-1 break-words font-semibold">
            {quote.branch.name}
          </dd>
        </div>

        <div>
          <dt className="text-muted">ช่างผู้ให้บริการ</dt>
          <dd className="mt-1 break-words font-semibold">{groomerName}</dd>
        </div>

        <div>
          <dt className="text-muted">วันที่ใช้บริการ</dt>
          <dd className="mt-1 font-semibold">
            {dateFormatter.format(startsAt)}
          </dd>
        </div>

        <div>
          <dt className="text-muted">เวลาให้บริการ</dt>
          <dd className="mt-1 font-semibold">
            {timeFormatter.format(startsAt)}
            {' – '}
            {timeFormatter.format(serviceEndsAt)} น.
          </dd>
        </div>

        <div>
          <dt className="text-muted">ระยะเวลาโดยประมาณ</dt>
          <dd className="mt-1 font-semibold">
            {quote.totalDurationMinutes} นาที
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted">วันและเวลาแสดงตามเวลาประเทศไทย</p>

      <ul className="mt-5 space-y-3 border-t border-border pt-4">
        {quote.items.map((item) => (
          <li
            key={item.serviceId}
            className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"
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
          <span>ราคารวม</span>
          <span className="text-primary">
            {priceFormatter.format(quote.totalPriceSatang / 100)}
          </span>
        </p>
        <p className="mt-2 text-sm font-medium">ชำระเงินที่สาขา</p>
      </div>

      <p className="mt-4 text-sm text-muted">
        ยังไม่ได้ยืนยันการจอง เวลาที่เลือกอาจเปลี่ยนแปลงได้จนกว่าจะจองสำเร็จ
      </p>
    </section>
  );
}
