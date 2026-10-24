import Link from 'next/link';
import BookingsView from './bookings-view';

export default function BookingsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← กลับบัญชีของฉัน
        </Link>

        <div className="mt-5">
          <p className="text-sm font-semibold text-primary">Petopia</p>
          <h1 className="mt-2 text-3xl font-bold">การจองของฉัน</h1>
          <p className="mt-3 text-sm text-muted">
            ดูนัดหมายและรายละเอียดบริการของสัตว์เลี้ยง
            เวลาทั้งหมดแสดงตามเวลาประเทศไทย
          </p>
        </div>

        <BookingsView />
      </div>
    </main>
  );
}
