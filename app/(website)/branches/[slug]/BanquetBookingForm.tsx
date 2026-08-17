"use client";

import { useState } from "react";
import { useToast } from "@/components/website/Toast";
import { getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

interface Props {
  branchSlug?: string;
  branchName?: string;
  ctaTitle?:   string;
  ctaSubtitle?: string;
}

type FormField = "fullName" | "phone" | "email" | "eventType" | "eventDate" | "guestCount" | "message";
type FieldErrors = Partial<Record<FormField, string>>;

function getIndiaDateInputValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function BanquetBookingForm({ branchSlug, branchName, ctaTitle, ctaSubtitle }: Props) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: "", phone: "", email: "",
    eventType: "", eventDate: "", guestCount: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [err,        setErr]        = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function upd(k: FormField, v: string) {
    setForm(p => ({ ...p, [k]: v }));
    setFieldErrors(current => {
      if (!current[k]) return current;
      const next = { ...current };
      delete next[k];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(""); setFieldErrors({});
    try {
      const res = await fetch("/api/banquet-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branchSlug, branchName }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const serverFieldErrors = data?.fieldErrors && typeof data.fieldErrors === "object"
          ? data.fieldErrors as FieldErrors
          : {};
        const message = getUserResponseError(res, data, "Unable to submit your request.");
        setFieldErrors(serverFieldErrors);
        if (Object.keys(serverFieldErrors).length === 0) setErr(message);
        return;
      }
      setDone(true);
      toast.success("Request submitted", "Our event team will contact you shortly.", { id: "banquet-request" });
    } catch (error) { const message=getUserErrorMessage(error,"Unable to submit your request.");setErr(message);toast.error("Request not submitted",message,{id:"banquet-request"}); }
    finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <section className="banqplace__booking">
        <div className="banqplace__booking-inner">
          <div className="banqplace__form-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 className="banqplace__booking-title" style={{ opacity: 1 }}>
              Booking Request Received!
            </h2>
            <p className="banqplace__booking-sub" style={{ opacity: 1, marginBottom: 0 }}>
              Thank you! Our team will contact you shortly to confirm your event details.
            </p>
            <button className="banqplace__btn" style={{ opacity: 1, marginTop: 24 }}
              onClick={() => { setDone(false); setForm({ fullName:"", phone:"", email:"", eventType:"", eventDate:"", guestCount:"", message:"" }); }}>
              Submit Another Request
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="banqplace__booking">
      <div className="banqplace__booking-inner">
        <h2 className="banqplace__booking-title">{ctaTitle || "Plan Your Special Event"}</h2>
        <p className="banqplace__booking-sub">
          {ctaSubtitle || "Fill in your details and let us make your celebration truly special."}
        </p>

        <div className="banqplace__form-card">
          {err && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
              padding: "10px 16px", borderRadius: 6, marginBottom: 16,
              fontFamily: "var(--font-body)", fontSize: 13 }}>
              {err}
            </div>
          )}

          <form onSubmit={handleSubmit} className="banqplace__form" noValidate>
            {/* Row 1: Name, Phone, Email */}
            <div className={`banqplace__field${fieldErrors.fullName ? " has-error" : ""}`}>
              <input type="text" placeholder="Full Name *" value={form.fullName} aria-invalid={Boolean(fieldErrors.fullName)}
                onChange={e => upd("fullName", e.target.value)} />
              {fieldErrors.fullName && <span className="banqplace__field-error">{fieldErrors.fullName}</span>}
            </div>
            <div className={`banqplace__field${fieldErrors.phone ? " has-error" : ""}`}>
              <input type="tel" placeholder="Phone (10 digits) *" value={form.phone} aria-invalid={Boolean(fieldErrors.phone)}
                onChange={e => upd("phone", e.target.value)} />
              {fieldErrors.phone && <span className="banqplace__field-error">{fieldErrors.phone}</span>}
            </div>
            <div className={`banqplace__field${fieldErrors.email ? " has-error" : ""}`}>
              <input type="email" placeholder="Email Address *" value={form.email} aria-invalid={Boolean(fieldErrors.email)}
                onChange={e => upd("email", e.target.value)} />
              {fieldErrors.email && <span className="banqplace__field-error">{fieldErrors.email}</span>}
            </div>

            {/* Row 2: Event type, Date, Guests */}
            <div className={`banqplace__field${fieldErrors.eventType ? " has-error" : ""}`}>
            <select className={`banqplace__select${form.eventType ? " has-value" : ""}`}
              value={form.eventType} aria-invalid={Boolean(fieldErrors.eventType)} onChange={e => upd("eventType", e.target.value)}>
              <option value="">Event Type (optional)</option>
              <option>Birthday Party</option>
              <option>Wedding / Pre-Wedding</option>
              <option>Corporate Event</option>
              <option>Anniversary</option>
              <option>Baby Shower</option>
              <option>Cultural Event</option>
              <option>Social Gathering</option>
              <option>Other</option>
            </select>
            {fieldErrors.eventType && <span className="banqplace__field-error">{fieldErrors.eventType}</span>}
            </div>
            <div className={`banqplace__field${fieldErrors.eventDate ? " has-error" : ""}`}>
            <input type="date" placeholder="Event Date" value={form.eventDate} aria-invalid={Boolean(fieldErrors.eventDate)}
              min={getIndiaDateInputValue()}
              onChange={e => upd("eventDate", e.target.value)} />
            {fieldErrors.eventDate && <span className="banqplace__field-error">{fieldErrors.eventDate}</span>}
            </div>
            <div className={`banqplace__field${fieldErrors.guestCount ? " has-error" : ""}`}>
            <select className={`banqplace__select${form.guestCount ? " has-value" : ""}`}
              value={form.guestCount} aria-invalid={Boolean(fieldErrors.guestCount)} onChange={e => upd("guestCount", e.target.value)}>
              <option value="">Expected Guests</option>
              <option>Upto 25</option>
              <option>25 – 50</option>
              <option>50 – 100</option>
              <option>100 – 200</option>
              <option>200 – 500</option>
              <option>500+</option>
            </select>
            {fieldErrors.guestCount && <span className="banqplace__field-error">{fieldErrors.guestCount}</span>}
            </div>

            {/* Message */}
            <div className={`banqplace__form-message banqplace__field${fieldErrors.message ? " has-error" : ""}`}>
              <textarea placeholder="Additional message or requirements (optional)" aria-invalid={Boolean(fieldErrors.message)}
                value={form.message} onChange={e => upd("message", e.target.value)}
                rows={3} />
              {fieldErrors.message && <span className="banqplace__field-error">{fieldErrors.message}</span>}
            </div>

            <button type="submit" className="banqplace__btn" disabled={submitting}
              style={{ opacity: 1 }}>
              {submitting ? "Submitting…" : "Book Now"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
