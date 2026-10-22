import type { Metadata } from 'next';
import Link from 'next/link';
import CatalogView from './catalog-view';

export const metadata: Metadata = {
  title: 'บริการดูแลสัตว์เลี้ยง | Petopia',
  description: 'ดูบริการ ราคา และช่างประจำสาขาของ Petopia Grooming',
};

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <span className="text-2xl font-bold">
            <span aria-hidden="true" className="mr-2 text-primary">
              ✦
            </span>
            Petopia
          </span>

          <Link
            href="/account"
            className="rounded-lg px-3 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            บัญชีของฉัน
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="mb-2 font-medium text-primary">Petopia Grooming</p>
          <h1 className="text-3xl font-bold leading-relaxed sm:text-4xl">
            ดูแลเพื่อนตัวน้อยให้สดใส
          </h1>
          <p className="mt-3 text-muted">
            เลือกสาขาที่สะดวก แล้วดูบริการสำหรับสัตว์เลี้ยงของคุณ
          </p>
          <p className="mt-3 text-sm text-muted">
            ราคาและระยะเวลาบนหน้านี้เป็นข้อมูลสมมติสำหรับเดโม
            ขณะนี้ยังไม่เปิดจองผ่านเว็บไซต์
          </p>
        </div>

        <CatalogView />
      </main>
    </div>
  );
}
