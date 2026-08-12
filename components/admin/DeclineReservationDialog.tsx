"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquareWarning, X } from "lucide-react";

const SUGGESTED_REASONS = [
  "The requested time slot is fully booked.",
  "The restaurant is unavailable at the requested time.",
  "We are closed for a private event.",
];

type Props = {
  open: boolean;
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export default function DeclineReservationDialog({ open, count, busy = false, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isValid = reason.trim().length >= 5;

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  function submit() {
    setAttempted(true);
    if (isValid) onConfirm(reason.trim());
  }

  return (
    <div
      className="confirm-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section className="confirm-dialog decline-dialog" role="dialog" aria-modal="true" aria-labelledby="decline-dialog-title">
        <button type="button" className="confirm-dialog__close" onClick={onCancel} disabled={busy} aria-label="Close decline dialog">
          <X size={18} />
        </button>

        <div className="confirm-dialog__icon" aria-hidden="true">
          <MessageSquareWarning size={24} />
        </div>
        <h2 id="decline-dialog-title" className="confirm-dialog__title">
          Decline {count === 1 ? "reservation" : `${count} reservations`}?
        </h2>
        <p className="confirm-dialog__description decline-dialog__intro">
          Tell the customer why their request cannot be accepted. This message will appear in their reservation details.
        </p>

        <div className="decline-dialog__suggestions" aria-label="Suggested reasons">
          {SUGGESTED_REASONS.map((suggestion) => (
            <button key={suggestion} type="button" className="decline-dialog__suggestion" onClick={() => setReason(suggestion)} disabled={busy}>
              {suggestion}
            </button>
          ))}
        </div>

        <label className="decline-dialog__label" htmlFor="decline-reason">Message to customer</label>
        <textarea
          ref={textareaRef}
          id="decline-reason"
          className={`decline-dialog__textarea${attempted && !isValid ? " decline-dialog__textarea--error" : ""}`}
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 500))}
          placeholder="Example: We are fully booked at your requested time. Please choose another slot."
          rows={4}
          maxLength={500}
          disabled={busy}
          aria-describedby="decline-reason-help"
          aria-invalid={attempted && !isValid}
        />
        <div id="decline-reason-help" className="decline-dialog__help">
          <span>{attempted && !isValid ? "Please enter at least 5 characters." : "Be clear, polite, and helpful."}</span>
          <span>{reason.length}/500</span>
        </div>

        <div className="confirm-dialog__actions decline-dialog__actions">
          <button type="button" className="confirm-dialog__button confirm-dialog__button--cancel" onClick={onCancel} disabled={busy}>
            Keep reservation
          </button>
          <button type="button" className="confirm-dialog__button confirm-dialog__button--danger" onClick={submit} disabled={busy}>
            {busy && <Loader2 size={16} className="confirm-dialog__spinner" />}
            {busy ? "Declining…" : count === 1 ? "Decline & send" : `Decline ${count} & send`}
          </button>
        </div>
      </section>
    </div>
  );
}
