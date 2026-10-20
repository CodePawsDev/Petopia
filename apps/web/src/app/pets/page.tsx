import type { Metadata } from 'next';
import Link from 'next/link';
import PetsView from './pets-view';

export const metadata: Metadata = {
  title: 'สัตว์เลี้ยงของฉัน',
};

export default function PetsPage() {
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
            className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            บัญชีของฉัน
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="mb-2 text-sm font-medium text-primary">
          เพื่อนตัวเล็กของคุณ
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          สัตว์เลี้ยงของฉัน
        </h1>
        <p className="mt-3 text-muted">
          ดูข้อมูลและบันทึกสิ่งที่ควรรู้เกี่ยวกับสัตว์เลี้ยงของคุณ
        </p>

        <PetsView />
      </main>
    </div>
  );
}