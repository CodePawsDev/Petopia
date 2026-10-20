'use client';

import { useEffect, useState, useRef } from 'react';
import ArchivePetDialog from './archive-pet-dialog';
import { isPet, speciesLabels, type Pet } from './pet-types';
import PetForm from './pet-form';

export default function PetsView() {
  const [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<{ pet?: Pet } | null>(null);
  const [revision, setRevision] = useState(0);
  const [saveNotice, setSaveNotice] = useState('');

  if (editor !== null) {
    return (
      <section className="mt-8 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <PetForm
          key={editor.pet?.id ?? 'new'}
          pet={editor.pet}
          onCancel={() => {
            setEditor(null);
            setRevision((current) => current + 1);
          }}
          onSaved={(savedPet) => {
            setSaveNotice(
              editor.pet
                ? `บันทึกข้อมูล "${savedPet.name}" แล้ว`
                : `เพิ่ม "${savedPet.name}" แล้ว`,
            );
            setArchived(savedPet.archivedAt !== null);
            setRevision((current) => current + 1);
            setEditor(null);
          }}
        />
      </section>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="สถานะสัตว์เลี้ยง"
          className="flex flex-wrap gap-3"
        >
          <button
            type="button"
            aria-pressed={!archived}
            onClick={() => {
              setArchived(false);
              setSaveNotice('');
            }}
            className={`min-h-12 rounded-xl border px-5 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              !archived
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground hover:bg-surface-soft'
            }`}
          >
            ใช้งานอยู่
          </button>

          <button
            type="button"
            aria-pressed={archived}
            onClick={() => {
              setArchived(true);
              setSaveNotice('');
            }}
            className={`min-h-12 rounded-xl border px-5 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              archived
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground hover:bg-surface-soft'
            }`}
          >
            เก็บถาวร
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setSaveNotice('');
            setEditor({});
          }}
          className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          + เพิ่มสัตว์เลี้ยง
        </button>
      </div>

      <p role="status" className="mt-5 text-sm text-primary">
        {saveNotice}
      </p>

      <PetList
        key={`${archived ? 'archived' : 'active'}:${revision}`}
        archived={archived}
        onEdit={(pet) => {
          setSaveNotice('');
          setEditor({ pet });
        }}
      />
    </div>
  );
}

function PetList({
  archived,
  onEdit,
}: {
  archived: boolean;
  onEdit: (pet: Pet) => void;
}) {
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [error, setError] = useState('');
  const mutationInProgress = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [petToArchive, setPetToArchive] = useState<Pet | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPets() {
      try {
        const response = await fetch(`/api/pets?archived=${archived}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          window.location.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Pet request failed');
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data) || !data.every(isPet)) {
          throw new Error('Invalid pet response');
        }

        if (!controller.signal.aborted) {
          setPets(data);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('โหลดข้อมูลสัตว์เลี้ยงไม่สำเร็จ กรุณาลองอีกครั้ง');
        }
      }
    }

    void loadPets();

    return () => controller.abort();
  }, [archived]);
  async function handleArchiveChange(pet: Pet) {
    if (mutationInProgress.current) return;

    const action = archived ? 'restore' : 'archive';

    mutationInProgress.current = true;
    setPendingId(pet.id);
    setActionError('');
    setNotice('');

    try {
      const response = await fetch(
        `/api/pets/${encodeURIComponent(pet.id)}/${action}`,
        {
          method: 'POST',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (response.status === 401) {
        window.location.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Pet status update failed');
      }

      const result: unknown = await response.json();

      if (
        !isPet(result) ||
        result.id !== pet.id ||
        (archived ? result.archivedAt !== null : result.archivedAt === null)
      ) {
        throw new Error('Invalid pet status response');
      }

      setPets((current) =>
        current === null ? null : current.filter((item) => item.id !== pet.id),
      );

      setNotice(
        archived
          ? `นำ "${pet.name}" กลับมาใช้งานแล้ว`
          : `เก็บถาวร "${pet.name}" แล้ว`,
      );
    } catch {
      setActionError(
        'ยืนยันผลการเปลี่ยนสถานะไม่ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบก่อนลองอีกครั้ง',
      );
    } finally {
      mutationInProgress.current = false;
      setPendingId(null);
    }
  }
  if (error) {
    return (
      <section className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <p role="alert" className="text-danger">
          {error}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-12 rounded-xl border border-primary px-5 py-3 font-medium text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ลองอีกครั้ง
        </button>
      </section>
    );
  }

  if (pets === null) {
    return (
      <p
        role="status"
        className="mt-8 rounded-3xl border border-border bg-surface p-8 text-muted"
      >
        กำลังโหลดสัตว์เลี้ยง…
      </p>
    );
  }

  const feedback = (
    <>
      {actionError && (
        <p role="alert" className="mt-5 text-sm text-danger">
          {actionError}
        </p>
      )}
      <p role="status" className="mt-5 text-sm text-primary">
        {notice}
      </p>
    </>
  );

  if (pets.length === 0) {
    return (
      <section className="mt-8 rounded-3xl border border-border bg-surface p-8 text-center">
        {feedback}
        <span aria-hidden="true" className="text-4xl">
          🐾
        </span>
        <h2 className="mt-4 text-xl font-bold">
          {archived
            ? 'ยังไม่มีสัตว์เลี้ยงที่เก็บถาวร'
            : 'ยังไม่มีสัตว์เลี้ยงที่ใช้งานอยู่'}
        </h2>
        <p className="mt-2 text-muted">
          {archived
            ? 'สัตว์เลี้ยงที่เก็บถาวรจะแสดงในรายการนี้'
            : 'เมื่อเพิ่มสัตว์เลี้ยงหรือนำกลับมาใช้งาน ข้อมูลจะแสดงที่นี่'}
        </p>
      </section>
    );
  }

  return (
    <>
      {petToArchive && (
        <ArchivePetDialog
          petName={petToArchive.name}
          onCancel={() => setPetToArchive(null)}
          onConfirm={() => {
            const selectedPet = petToArchive;
            setPetToArchive(null);
            void handleArchiveChange(selectedPet);
          }}
        />
      )}
      {feedback}
      <ul
        aria-label="รายการสัตว์เลี้ยง"
        className="mt-8 grid gap-5 md:grid-cols-2"
      >
        {pets.map((pet) => (
          <li
            key={pet.id}
            className="min-w-0 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8"
          >
            <p className="text-sm font-medium text-primary">
              {speciesLabels[pet.species]}
            </p>
            <h2 className="mt-2 break-words text-2xl font-bold">{pet.name}</h2>

            <dl className="mt-6 grid grid-cols-2 gap-5 text-sm">
              <div>
                <dt className="text-muted">สายพันธุ์</dt>
                <dd className="mt-1 break-words font-medium">
                  {pet.breed ?? 'ยังไม่ระบุ'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">น้ำหนัก</dt>
                <dd className="mt-1 font-medium">
                  {pet.weightKg === null ? 'ยังไม่ระบุ' : `${pet.weightKg} กก.`}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">วันเกิด (ปี ค.ศ.)</dt>
                <dd className="mt-1 font-medium">
                  {pet.birthDate ?? 'ยังไม่ระบุ'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">ข้อควรดูแล</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words leading-7">
                  {pet.careNotes ?? 'ยังไม่ระบุ'}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => onEdit(pet)}
              disabled={pendingId !== null}
              className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              แก้ไขข้อมูล
            </button>
            <button
              type="button"
              onClick={() => {
                if (archived) {
                  void handleArchiveChange(pet);
                } else {
                  setPetToArchive(pet);
                }
              }}
              disabled={pendingId !== null}
              className="mt-6 min-h-12 w-full rounded-xl border border-primary px-4 py-3 font-semibold text-primary hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              {pendingId === pet.id
                ? 'กำลังบันทึก…'
                : archived
                  ? 'นำกลับมาใช้งาน'
                  : 'เก็บถาวร'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
