'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
            <section
              aria-labelledby="branch-access-heading"
              className="mt-8 border-t border-slate-200 pt-6"
            >
              <h2 id="branch-access-heading" className="text-lg font-semibold">
                สิทธิ์การทำงานตามสาขา
              </h2>

              {branchAccess.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  บัญชีนี้ใช้งานในฐานะลูกค้า และไม่มีสิทธิ์พนักงาน
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {branchAccess.map((access) => (
                    <li
                      key={access.branch.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <h3 className="font-semibold">{access.branch.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {access.branch.code}
                      </p>

                      <dl className="mt-3 space-y-3 text-sm">
                        <div>
                          <dt className="text-slate-600">บทบาท</dt>
                          <dd className="mt-1">
                            {access.roles.length > 0
                              ? access.roles
                                  .map((role) => roleLabels[role])
                                  .join(' / ')
                              : 'ไม่มีบทบาทพนักงานประจำสาขา'}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-slate-600">สิทธิ์รับชำระเงิน</dt>
                          <dd className="mt-1">
                            {access.canReceivePayment
                              ? 'มีสิทธิ์'
                              : 'ไม่มีสิทธิ์'}
                          </dd>
                        </div>
                      </dl>
                      <nav
                        aria-label={`เมนูทำงาน ${access.branch.name}`}
                        className="mt-4 flex flex-wrap gap-2"
                      >
                        {access.roles.includes('BRANCH_MANAGER') && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/manager`}
                            className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                          >
                            จัดการสาขา
                          </Link>
                        )}

                        {access.roles.includes('GROOMER') && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/groomer`}
                            className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                          >
                            งานของช่าง
                          </Link>
                        )}

                        {access.canReceivePayment && (
                          <Link
                            href={`/branches/${access.branch.id}/workspaces/payment`}
                            className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                          >
                            รับชำระเงิน
                          </Link>
                        )}
                      </nav>
                    </li>
                  ))}
                </ul>
              )}
            </section>

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
