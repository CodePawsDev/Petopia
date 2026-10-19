import type { Metadata } from 'next';
import LoginForm from '@/app/login/login-form';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10"
      >
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-2xl bg-surface-soft text-primary"
          >
            <svg viewBox="0 0 32 32" className="size-8" fill="currentColor">
              <ellipse
                cx="7"
                cy="12"
                rx="3"
                ry="4"
                transform="rotate(-25 7 12)"
              />
              <ellipse cx="13" cy="7" rx="3" ry="4" />
              <ellipse cx="21" cy="7" rx="3" ry="4" />
              <ellipse
                cx="27"
                cy="12"
                rx="3"
                ry="4"
                transform="rotate(25 27 12)"
              />
              <path d="M9 23c0-4 4-10 8-10s8 6 8 10c0 3-2 5-5 4l-3-1-3 1c-3 1-5-1-5-4Z" />
            </svg>
          </span>
          <span className="text-2xl font-bold">Petopia</span>
        </div>

        <p className="mb-2 text-sm font-medium text-primary">
          ยินดีต้อนรับกลับมา
        </p>
        <h1 id="login-heading" className="text-3xl font-bold">
          เข้าสู่ระบบ
        </h1>
        <p className="mb-8 mt-3 text-sm leading-7 text-muted">
          พื้นที่สำหรับคุณและสัตว์เลี้ยงที่คุณรัก
          <br />
          เข้าสู่ระบบด้วยบัญชี Petopia ของคุณ
        </p>

        <LoginForm />
      </section>
    </main>
  );
}
