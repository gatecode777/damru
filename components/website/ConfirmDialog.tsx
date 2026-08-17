"use client";

import { useEffect, useRef } from "react";

export interface WebsiteConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Single, reusable delete/destructive-action confirmation modal for the
 * customer website — replaces one-off native `confirm()` popups so every
 * "are you sure?" flow (notifications, addresses, account, …) looks and
 * behaves the same way, matching the admin panel's ConfirmDialog pattern.
 */
export default function ConfirmDialog({
  open, title, description, confirmLabel = "Delete", cancelLabel = "Cancel",
  busy = false, busyLabel = "Deleting…", onConfirm, onCancel,
}: WebsiteConfirmDialogProps) {
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
    <div className="website-confirm__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="website-confirm" role="alertdialog" aria-modal="true" aria-labelledby="website-confirm-title" aria-describedby="website-confirm-desc">
        <button type="button" className="website-confirm__close" onClick={onCancel} disabled={busy} aria-label="Close">&times;</button>
        <div className="website-confirm__icon" aria-hidden="true">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 id="website-confirm-title" className="website-confirm__title">{title}</h2>
        <p id="website-confirm-desc" className="website-confirm__desc">{description}</p>
        <div className="website-confirm__actions">
          <button ref={cancelRef} type="button" className="website-confirm__btn website-confirm__btn--cancel" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="website-confirm__btn website-confirm__btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </section>
      <style>{`
        .website-confirm__backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(30,20,12,.5);backdrop-filter:blur(4px);animation:website-confirm-backdrop-in .16s ease-out}
        .website-confirm{position:relative;width:min(100%,400px);padding:26px;border:1px solid #f3e8df;border-radius:18px;background:#fff;box-shadow:0 20px 60px rgba(30,20,12,.22);font-family:Poppins,sans-serif;animation:website-confirm-in .18s cubic-bezier(.2,.8,.2,1)}
        .website-confirm__close{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#aaa;font-size:20px;line-height:1;cursor:pointer}
        .website-confirm__close:hover:not(:disabled){background:#f5f1ec;color:#333}
        .website-confirm__icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:14px;border-radius:12px;color:#c92d2d;background:#fef2f2;font-size:19px}
        .website-confirm__title{margin:0;color:#1a1a1a;font-size:1.1rem;font-weight:700}
        .website-confirm__desc{margin:8px 0 22px;color:#777;font-size:.86rem;line-height:1.55}
        .website-confirm__actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .website-confirm__btn{min-height:42px;border-radius:10px;font-family:Poppins,sans-serif;font-size:.85rem;font-weight:600;cursor:pointer;transition:background .15s,opacity .15s}
        .website-confirm__btn--cancel{border:1px solid #e5e0da;color:#444;background:#fff}
        .website-confirm__btn--cancel:hover:not(:disabled){background:#faf8f5}
        .website-confirm__btn--danger{border:none;color:#fff;background:#c92d2d}
        .website-confirm__btn--danger:hover:not(:disabled){background:#a92222}
        .website-confirm__btn:disabled{opacity:.6;cursor:not-allowed}
        @keyframes website-confirm-backdrop-in{from{opacity:0}to{opacity:1}}
        @keyframes website-confirm-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:480px){.website-confirm__actions{grid-template-columns:1fr}.website-confirm__btn--danger{order:-1}}
        @media(prefers-reduced-motion:reduce){.website-confirm__backdrop,.website-confirm{animation:none}}
      `}</style>
    </div>
  );
}
