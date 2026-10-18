'use client';

import { useRef, useState, type FormEvent } from 'react';


export default function LoginForm() {
  const submitting = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    submitting.current = true;
    setIsPending(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: String(formData.get('email') ?? '').trim(),
          password: String(formData.get('password') ?? ''),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        } else if (response.status === 400) {
          setError('กรุณาตรวจสอบอีเมลและรหัสผ่าน');
        } else {
          setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
        }
        return;
      }

      form.reset();
      window.location.replace('/account');
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isPending}>
      <fieldset disabled={isPending} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
