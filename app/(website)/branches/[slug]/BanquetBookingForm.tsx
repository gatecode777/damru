"use client";

import { useState } from "react";

interface Props {
  branchSlug?: string;
  branchName?: string;
  ctaTitle?:   string;
  ctaSubtitle?: string;
}

export default function BanquetBookingForm({ branchSlug, branchName, ctaTitle, ctaSubtitle }: Props) {
  const [form, setForm] = useState({
    fullName: "", phone: "", email: "",
    eventType: "", eventDate: "", guestCount: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [err,        setErr]        = useState("");

  function upd(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim()) {
      setErr("Please fill in your name, phone and email."); return;
    }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/banquet-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branchSlug, branchName }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); return; }
      setDone(true);
    } catch { setErr("Failed to submit. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <section className="banqplace__booking">
        <div className="banqplace__booking-inner">
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 className="banqplace__booking-title" style={{ opacity: 1 }}>
              Booking Request Received!
            </h2>
            <p className="banqplace__booking-sub" style={{ opacity: 1 }}>
              Thank you! Our team will contact you shortly to confirm your event details.
            </p>
            <button className="banqplace__btn" style={{ opacity: 1, marginTop: 16 }}
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
        <h2 className="banqplace__booking-title reveal">{ctaTitle || "Plan Your Special Event"}</h2>
        <p className="banqplace__booking-sub reveal">
          {ctaSubtitle || "Fill in your details and let us make your celebration truly special."}
        </p>

        {err && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
            padding: "10px 16px", borderRadius: 6, marginBottom: 16,
            fontFamily: "Jost, sans-serif", fontSize: 13 }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="banqplace__form reveal" style={{ flexDirection: "column", alignItems: "center" }}>
          {/* Row 1: Name, Phone, Email */}
          <div className="banqplace__form-row">
            <input type="text" placeholder="Full Name *" value={form.fullName}
              onChange={e => upd("fullName", e.target.value)} required />
            <input type="tel" placeholder="Phone *" value={form.phone}
              onChange={e => upd("phone", e.target.value)} required />
            <input type="email" placeholder="Email Address *" value={form.email}
              onChange={e => upd("email", e.target.value)} required />
          </div>

          {/* Row 2: Event type, Date, Guests */}
          <div className="banqplace__form-row">
            <select value={form.eventType} onChange={e => upd("eventType", e.target.value)}
              style={{ flex:"1 1 220px", maxWidth:280, padding:"0.85rem 1rem",
                border:"1.5px solid var(--bp-border)", borderRadius:"var(--radius-sm)",
                background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color: form.eventType ? "var(--bp-dark)" : "#b0a89e",
                outline:"none" }}>
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
            <input type="date" placeholder="Event Date" value={form.eventDate}
              onChange={e => upd("eventDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{ flex:"1 1 180px", maxWidth:220, padding:"0.85rem 1rem",
                border:"1.5px solid var(--bp-border)", borderRadius:"var(--radius-sm)",
                background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color:"var(--bp-dark)", outline:"none" }} />
            <select value={form.guestCount} onChange={e => upd("guestCount", e.target.value)}
              style={{ flex:"1 1 180px", maxWidth:200, padding:"0.85rem 1rem",
                border:"1.5px solid var(--bp-border)", borderRadius:"var(--radius-sm)",
                background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color: form.guestCount ? "var(--bp-dark)" : "#b0a89e",
                outline:"none" }}>
              <option value="">Expected Guests</option>
              <option>Upto 25</option>
              <option>25 – 50</option>
              <option>50 – 100</option>
              <option>100 – 200</option>
              <option>200 – 500</option>
              <option>500+</option>
            </select>
          </div>

          {/* Message */}
          <div style={{ width: "100%", maxWidth: 860 }}>
            <textarea placeholder="Additional message or requirements (optional)"
              value={form.message} onChange={e => upd("message", e.target.value)}
              rows={3}
              style={{ width:"100%", padding:"0.85rem 1rem",
                border:"1.5px solid var(--bp-border)", borderRadius:"var(--radius-sm)",
                background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color:"var(--bp-dark)", outline:"none",
                resize:"vertical", transition:"border-color 0.25s" }}
              onFocus={e => (e.target.style.borderColor = "var(--bp-accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--bp-border)")} />
          </div>

          <button type="submit" className="banqplace__btn" disabled={submitting}
            style={{ opacity: 1 }}>
            {submitting ? "Submitting…" : "Book Now"}
          </button>
        </form>
      </div>
    </section>
  );
}