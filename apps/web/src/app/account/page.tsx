'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

type Branch = {
  id: string;
  code: string;
  name: string;
};

type StaffRole = 'GROOMER' | 'BRANCH_MANAGER';

type StaffAssignment = {
  role: StaffRole;
  branch: Branch;
};

type PermissionGrant = {
  permission: 'RECEIVE_PAYMENT';
  branch: Branch;
};

type Account = {
  id: string;
  email: string;
  displayName: string;
  staffAssignments: StaffAssignment[];
  permissionGrants: PermissionGrant[];
};

type BranchAccess = {
  branch: Branch;
  roles: StaffRole[];
  canReceivePayment: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBranch(value: unknown): value is Branch {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string'
  );
}

function isStaffAssignment(value: unknown): value is StaffAssignment {
  return (
    isRecord(value) &&
    (value.role === 'GROOMER' || value.role === 'BRANCH_MANAGER') &&
    isBranch(value.branch)
  );
}

function isPermissionGrant(value: unknown): value is PermissionGrant {
  return (
    isRecord(value) &&
    value.permission === 'RECEIVE_PAYMENT' &&
    isBranch(value.branch)
  );
}

function isAccount(value: unknown): value is Account {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.staffAssignments) &&
    value.staffAssignments.every(isStaffAssignment) &&
    Array.isArray(value.permissionGrants) &&
    value.permissionGrants.every(isPermissionGrant)
  );
}

const roleLabels: Record<StaffRole, string> = {
  GROOMER: 'ช่างอาบน้ำตัดขน',
  BRANCH_MANAGER: 'ผู้จัดการสาขา',
};

function getBranchAccess(account: Account): BranchAccess[] {
  const branches = new Map<string, BranchAccess>();

  function getOrCreate(branch: Branch): BranchAccess {
    const existing = branches.get(branch.id);
    if (existing) return existing;

    const access: BranchAccess = {
      branch,
      roles: [],
      canReceivePayment: false,
    };

    branches.set(branch.id, access);
    return access;
  }

  for (const assignment of account.staffAssignments) {
    const access = getOrCreate(assignment.branch);

    if (!access.roles.includes(assignment.role)) {
      access.roles.push(assignment.role);
    }

    if (assignment.role === 'BRANCH_MANAGER') {
      access.canReceivePayment = true;
    }
  }

  for (const grant of account.permissionGrants) {
    getOrCreate(grant.branch).canReceivePayment = true;
  }

  return [...branches.values()].sort((a, b) =>
    a.branch.code.localeCompare(b.branch.code),
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

  const branchAccess = account ? getBranchAccess(account) : [];

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
          <span className="text-sm text-muted">บัญชีของฉัน</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-primary">
              พื้นที่สำหรับคุณและสัตว์เลี้ยงที่คุณรัก
            </p>
            <h1 className="break-words text-3xl font-bold leading-relaxed sm:text-4xl">
              {account ? `สวัสดี คุณ${account.displayName}` : 'บัญชีของฉัน'}
            </h1>
            <p className="mt-2 text-muted">ยินดีต้อนรับสู่ Petopia</p>
          </div>

          <Image
            src="/images/petopia-companions.png"
            alt=""
            width={1536}
            height={1024}
            sizes="(min-width: 640px) 288px, 224px"
            className="h-auto w-56 shrink-0 self-center sm:w-72"
          />
        </div>

        {loadError ? (
          <section className="rounded-3xl border border-border bg-surface p-8">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลบัญชี</h2>
            <p role="alert" className="text-danger">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-12 rounded-xl border border-primary px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ลองอีกครั้ง
            </button>
          </section>
        ) : account ? (
          <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section
              aria-labelledby="profile-heading"
              className="min-w-0 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"
            >
              <h2 id="profile-heading" className="text-xl font-bold">
                บัญชีของฉัน
              </h2>

              <div
                aria-hidden="true"
                className="mx-auto my-7 flex size-24 items-center justify-center rounded-full bg-surface-soft text-4xl font-bold text-primary"
              >
                {Array.from(account.displayName)[0]}
              </div>

              <dl className="space-y-5">
                <div>
                  <dt className="text-sm text-muted">ชื่อที่แสดง</dt>
                  <dd className="mt-1 break-words text-lg font-semibold">
                    {account.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">อีเมล</dt>
                  <dd className="mt-1 break-all">{account.email}</dd>
                </div>
              </dl>

              <div className="mt-7 border-t border-border pt-6">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="min-h-12 w-full rounded-xl border border-primary px-4 py-3 font-semibold text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
                </button>

                {logoutError && (
                  <p role="alert" className="mt-4 text-sm text-danger">
                    {logoutError}
                  </p>
                )}
              </div>
            </section>

            <section
              aria-labelledby="branch-access-heading"
              className="min-w-0 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"
            >
              <h2 id="branch-access-heading" className="text-xl font-bold">
                พื้นที่ทำงานของคุณ
              </h2>
              <p className="mt-2 text-sm text-muted">
                พื้นที่ทำงานที่คุณมีสิทธิ์เข้าใช้งานในแต่ละสาขา
              </p>

              {branchAccess.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-surface-soft p-6">
                  <p className="font-semibold">คุณกำลังใช้งานในฐานะลูกค้า</p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    บัญชีนี้ไม่มีสิทธิ์พนักงาน จึงไม่มีเมนูพื้นที่ทำงานของสาขา
                  </p>
                </div>
              ) : (
                <ul className="mt-6 space-y-6">
                  {branchAccess.map((access) => (
                    <li
                      key={access.branch.id}
                      className="rounded-2xl border border-border p-5"
                    >
                      <h3 className="break-words text-lg font-semibold">
                        {access.branch.name}
                      </h3>
                      <p className="mt-1 break-all text-xs text-muted">
                        {access.branch.code}
                      </p>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-muted">บทบาท</dt>
                          <dd className="mt-1 font-medium">
                            {access.roles.length > 0
                              ? access.roles
                                  .map((role) => roleLabels[role])
                                  .join(' / ')
                              : 'ไม่มีบทบาทพนักงานประจำสาขา'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">สิทธิ์รับชำระเงิน</dt>
                          <dd className="mt-1 font-medium">
                            {access.canReceivePayment
                              ? 'มีสิทธิ์'
                              : 'ไม่มีสิทธิ์'}
                          </dd>
                        </div>
                      </dl>

                      <nav
                        aria-label={`เมนูทำงาน ${access.branch.name}`}
                        className="mt-5 grid gap-3"
                      >
                        {access.roles.includes('BRANCH_MANAGER') && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/manager`}
                            className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-surface-soft px-4 py-3 font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <span>ผู้จัดการสาขา</span>
                            <span aria-hidden="true" className="text-primary">
                              →
                            </span>
                          </Link>
                        )}

                        {access.roles.includes('GROOMER') && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/groomer`}
                            className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-surface-soft px-4 py-3 font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <span>งานของช่าง</span>
                            <span aria-hidden="true" className="text-primary">
                              →
                            </span>
                          </Link>
                        )}

                        {access.canReceivePayment && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/payment`}
                            className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-surface-soft px-4 py-3 font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <span>รับชำระเงิน</span>
                            <span aria-hidden="true" className="text-primary">
                              →
                            </span>
                          </Link>
                        )}
                      </nav>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <p
            role="status"
            className="rounded-3xl border border-border bg-surface p-8 text-muted"
          >
            กำลังตรวจสอบบัญชี…
          </p>
        )}
      </main>
    </div>
  );
}
