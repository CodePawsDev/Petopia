'use client';

import { useRef, useState, type FormEvent } from 'react';
import { isPet, speciesLabels, type Pet } from './pet-types';

type Props = {
  pet?: Pet;
  onSaved: (pet: Pet) => void;
  onCancel: () => void;
};

const inputClass =
  'mt-2 min-h-12 w-full rounded-xl border border-input-border bg-surface px-4 py-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function PetForm({ pet, onSaved, onCancel }: Props) {
  const submitting = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const species = String(formData.get('species') ?? '');
    const breed = String(formData.get('breed') ?? '').trim();
    const birthDate = String(formData.get('birthDate') ?? '');
    const weightText = String(formData.get('weightKg') ?? '').trim();
    const careNotes = String(formData.get('careNotes') ?? '').trim();

    setError('');
    setFieldErrors({});

    const errors: Record<string, string> = {};

    if (!name) {
      errors.name = 'กรุณาระบุชื่อสัตว์เลี้ยง';
    }

    if (!['DOG', 'CAT', 'RABBIT'].includes(species)) {
      errors.species = 'กรุณาเลือกประเภทสัตว์เลี้ยง';
    }

    if (birthDate) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());

      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;
      const day = parts.find((part) => part.type === 'day')?.value;
      const today = `${year}-${month}-${day}`;

      if (birthDate > today) {
        errors.birthDate = 'วันเกิดต้องไม่เกินวันนี้';
      }
    }

    const weightKg = weightText === '' ? null : Number(weightText);

    if (weightKg !== null) {
      if (
        !Number.isFinite(weightKg) ||
        weightKg < 0.001 ||
        weightKg > 999.999
      ) {
        errors.weightKg = 'กรุณาระบุน้ำหนักระหว่าง 0.001–999.999 กก.';
      } else if (!/^\d+(?:\.\d{1,3})?$/.test(weightText)) {
        errors.weightKg = 'ระบุน้ำหนักเป็นทศนิยมได้ไม่เกิน 3 ตำแหน่ง';
      }
    }

    const birthDateInput = event.currentTarget.elements.namedItem('birthDate');
    const weightInput = event.currentTarget.elements.namedItem('weightKg');

    if (
      birthDateInput instanceof HTMLInputElement &&
      birthDateInput.validity.badInput
    ) {
      errors.birthDate = 'กรุณาระบุวันเกิดให้ครบและถูกต้อง';
    }

    if (
      weightInput instanceof HTMLInputElement &&
      weightInput.validity.badInput
    ) {
      errors.weightKg = 'กรุณาระบุน้ำหนักเป็นตัวเลข';
    }

    if (name.length > 100) {
      errors.name = 'ชื่อต้องไม่เกิน 100 ตัวอักษร';
    }

    if (breed.length > 100) {
      errors.breed = 'สายพันธุ์ต้องไม่เกิน 100 ตัวอักษร';
    }

    if (careNotes.length > 2000) {
      errors.careNotes = 'ข้อควรดูแลต้องไม่เกิน 2,000 ตัวอักษร';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);

      const firstField = Object.keys(errors)[0];
      const control = event.currentTarget.elements.namedItem(firstField);

      if (control instanceof HTMLElement) {
        control.focus();
      }

      return;
    }

    submitting.current = true;
    setIsPending(true);

    try {
      const response = await fetch(
        pet ? `/api/pets/${encodeURIComponent(pet.id)}` : '/api/pets',
        {
          method: pet ? 'PATCH' : 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            species,
            breed: breed || null,
            birthDate: birthDate || null,
            weightKg,
            careNotes: careNotes || null,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }

      if (response.status === 400) {
        const body: unknown = await response.json();
        const errors: Record<string, string> = {};

        if (typeof body === 'object' && body !== null && 'message' in body) {
          const rawMessages = body.message;
          const messages = Array.isArray(rawMessages)
            ? rawMessages.filter(
                (message: unknown): message is string =>
                  typeof message === 'string',
              )
            : typeof rawMessages === 'string'
              ? [rawMessages]
              : [];

          for (const message of messages) {
            if (/birthDate|birth date/i.test(message)) {
              errors.birthDate = 'กรุณาระบุวันเกิดที่ถูกต้องและไม่เกินวันนี้';
            } else if (/weightKg/i.test(message)) {
              errors.weightKg =
                'น้ำหนักต้องอยู่ระหว่าง 0.001–999.999 กก. และมีทศนิยมไม่เกิน 3 ตำแหน่ง';
            } else if (/^name\b/i.test(message)) {
              errors.name = 'กรุณาระบุชื่อสัตว์เลี้ยงไม่เกิน 100 ตัวอักษร';
            } else if (/species/i.test(message)) {
              errors.species = 'กรุณาเลือกสุนัข แมว หรือกระต่าย';
            } else if (/breed/i.test(message)) {
              errors.breed = 'สายพันธุ์ต้องไม่เกิน 100 ตัวอักษร';
            } else if (/careNotes/i.test(message)) {
              errors.careNotes = 'ข้อควรดูแลต้องไม่เกิน 2,000 ตัวอักษร';
            }
          }
        }

        setFieldErrors(errors);

        if (Object.keys(errors).length === 0) {
          setError('ข้อมูลบางส่วนไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง');
        }

        return;
      }

      if (response.status === 404) {
        setError('ไม่พบสัตว์เลี้ยงนี้ กรุณากลับไปตรวจสอบรายการ');
        return;
      }

      if (!response.ok) {
        throw new Error('Pet save failed');
      }

      const result: unknown = await response.json();

      if (!isPet(result) || (pet && result.id !== pet.id)) {
        throw new Error('Invalid pet response');
      }

      onSaved(result);
    } catch {
      setError('ยืนยันผลการบันทึกไม่ได้ กรุณากลับไปตรวจสอบรายการก่อนบันทึกซ้ำ');
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isPending} noValidate>
      <fieldset disabled={isPending} className="space-y-5">
        <legend className="mb-6 text-2xl font-bold">
          {pet ? 'แก้ไขสัตว์เลี้ยง' : 'เพิ่มสัตว์เลี้ยง'}
        </legend>

        <p className="text-sm text-muted">
          ชื่อและประเภทจำเป็นต้องระบุ ข้อมูลอื่นเว้นว่างได้
        </p>

        <div>
          <label htmlFor="pet-name" className="text-sm font-medium">
            ชื่อสัตว์เลี้ยง
          </label>
          <input
            id="pet-name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={pet?.name ?? ''}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'pet-name-error' : undefined}
          />
          {fieldErrors.name && (
            <p id="pet-name-error" className="mt-1 text-sm text-danger">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pet-species" className="text-sm font-medium">
            ประเภท
          </label>
          <div className="relative mt-2">
            <select
              id="pet-species"
              name="species"
              required
              defaultValue={pet?.species ?? ''}
              aria-invalid={Boolean(fieldErrors.species)}
              aria-describedby={
                fieldErrors.species ? 'pet-species-error' : undefined
              }
              className="min-h-12 w-full appearance-none rounded-xl border border-input-border bg-surface py-3 pl-4 pr-12 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="" disabled>
                เลือกประเภทสัตว์เลี้ยง
              </option>
              <option value="DOG">{speciesLabels.DOG}</option>
              <option value="CAT">{speciesLabels.CAT}</option>
              <option value="RABBIT">{speciesLabels.RABBIT}</option>
            </select>

            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {fieldErrors.species && (
            <p id="pet-species-error" className="mt-1 text-sm text-danger">
              {fieldErrors.species}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pet-breed" className="text-sm font-medium">
            สายพันธุ์
          </label>
          <input
            id="pet-breed"
            name="breed"
            type="text"
            maxLength={100}
            defaultValue={pet?.breed ?? ''}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.breed)}
            aria-describedby={fieldErrors.breed ? 'pet-breed-error' : undefined}
          />
          {fieldErrors.breed && (
            <p id="pet-breed-error" className="mt-1 text-sm text-danger">
              {fieldErrors.breed}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="pet-birth-date" className="text-sm font-medium">
              วันเกิด
            </label>
            <input
              id="pet-birth-date"
              name="birthDate"
              type="date"
              defaultValue={pet?.birthDate ?? ''}
              className={`${inputClass} min-w-0`}
              aria-invalid={Boolean(fieldErrors.birthDate)}
              aria-describedby={
                fieldErrors.birthDate ? 'pet-birth-date-error' : undefined
              }
            />
            {fieldErrors.birthDate && (
              <p id="pet-birth-date-error" className="mt-1 text-sm text-danger">
                {fieldErrors.birthDate}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pet-weight" className="text-sm font-medium">
              น้ำหนัก (กิโลกรัม)
            </label>
            <input
              id="pet-weight"
              name="weightKg"
              type="number"
              min="0.001"
              max="999.999"
              step="0.001"
              defaultValue={pet?.weightKg ?? ''}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.weightKg)}
              aria-describedby={
                fieldErrors.weightKg ? 'pet-weight-error' : undefined
              }
            />
            {fieldErrors.weightKg && (
              <p id="pet-weight-error" className="mt-1 text-sm text-danger">
                {fieldErrors.weightKg}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="pet-care-notes" className="text-sm font-medium">
            ข้อควรดูแล
          </label>
          <textarea
            id="pet-care-notes"
            name="careNotes"
            rows={4}
            maxLength={2000}
            defaultValue={pet?.careNotes ?? ''}
            placeholder="เช่น กลัวเสียงไดร์ หรือบริเวณที่ควรระมัดระวัง"
            className={`${inputClass} resize-y`}
            aria-invalid={Boolean(fieldErrors.careNotes)}
            aria-describedby={
              fieldErrors.careNotes ? 'pet-care-notes-error' : undefined
            }
          />
          {fieldErrors.careNotes && (
            <p id="pet-care-notes-error" className="mt-1 text-sm text-danger">
              {fieldErrors.careNotes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-border px-5 py-3 font-semibold hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            กลับไปรายการ
          </button>

          <button
            type="submit"
            className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
