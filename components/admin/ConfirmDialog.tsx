"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  confirmDisabled?: boolean;
  confirmIcon?: ReactNode;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  busyLabel = "Processing…",
  confirmDisabled = false,
  confirmIcon,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancelRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, open]);

  if (!open) return null;
  return (
    <div className="confirm-dialog__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <button type="button" className="confirm-dialog__close" onClick={onCancel} disabled={busy} aria-label="Close confirmation"><X size={18} /></button>
        <div className="confirm-dialog__icon" aria-hidden="true"><AlertTriangle size={24} /></div>
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">{title}</h2>
        <p id="confirm-dialog-description" className="confirm-dialog__description">{description}</p>
        {children}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="confirm-dialog__button confirm-dialog__button--cancel" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="confirm-dialog__button confirm-dialog__button--danger" onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? <Loader2 size={16} className="confirm-dialog__spinner" /> : (confirmIcon ?? <TrashIcon />)}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>;
}
