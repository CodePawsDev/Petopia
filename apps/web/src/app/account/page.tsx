'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Account = {
  id: string;
  email: string;
  displayName: string;
};

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'email' in value &&
    typeof value.email === 'string' &&
    'displayName' in value &&
    typeof value.displayName === 'string'
  );
}

export default function AccountPage() {
  const router = useRouter();
  const logoutInProgress = useRef(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setAccount(null);
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Account request failed');
        }

        const data: unknown = await response.json();

        if (!isAccount(data)) {
          throw new Error('Invalid account response');
        }

        if (!controller.signal.aborted) {
          setLoadError('');
          setAccount(data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAccount(null);
          setLoadError('โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง');
        }
      }
    }

    void loadAccount();

    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    if (logoutInProgress.current) return;

    logoutInProgress.current = true;
    setIsLoggingOut(true);
    setLogoutError('');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setAccount(null);
      window.location.replace('/login');
    } catch {
      setLogoutError('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      logoutInProgress.current = false;
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section
        aria-labelledby="account-heading"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="mb-2 text-sm font-semibold text-teal-700">Petopia</p>
        <h1 id="account-heading" className="mb-6 text-2xl font-bold">
          บัญชีของฉัน
        </h1>

        {loadError ? (
          <div>
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : account ? (
          <>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-600">ชื่อที่แสดง</dt>
                <dd className="mt-1 font-medium">{account.displayName}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">อีเมล</dt>
                <dd className="mt-1 break-all">{account.email}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-8 w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
            </button>

            {logoutError && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {logoutError}
              </p>
            )}
          </>
        ) : (
          <p role="status" className="text-sm text-slate-600">
            กำลังตรวจสอบบัญชี…
          </p>
        )}
      </section>
    </main>
  );
}
