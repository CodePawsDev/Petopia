'use client';

import { useEffect, useRef } from 'react';

type Props = {
  petName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ArchivePetDialog({
  petName,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    cancelRef.current?.focus();

    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="archive-dialog-heading"
      aria-describedby="archive-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40 sm:p-8"
    >
      <p className="text-sm font-semibold text-primary">Petopia</p>

      <h2
        id="archive-dialog-heading"
        className="mt-2 break-words text-2xl font-bold"
      >
        เก็บถาวรสัตว์เลี้ยง?
      </h2>

      <p
        id="archive-dialog-description"
        className="mt-4 break-words leading-7 text-muted"
      >
        “{petName}” จะย้ายไปอยู่ในรายการเก็บถาวร
        โดยข้อมูลยังคงอยู่ และคุณสามารถนำกลับมาใช้งานได้ภายหลัง
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-xl border border-border px-5 py-3 font-semibold hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ยกเลิก
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="min-h-12 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          เก็บถาวร
        </button>
      </div>
    </dialog>
  );
}