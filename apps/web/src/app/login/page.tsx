import LoginForm from '@/app/login/login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="mb-2 text-sm font-semibold text-teal-700">Petopia</p>
        <h1 id="login-heading" className="text-2xl font-bold">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-2 mb-8 text-sm text-slate-600">
          ใช้บัญชีของคุณเพื่อเข้าใช้งาน Petopia
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
