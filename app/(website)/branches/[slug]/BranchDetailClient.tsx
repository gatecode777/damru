"use client";

import { useEffect, useState } from "react";

export default function BranchDetailClient({ branch, hallCards }: { branch: any; hallCards: any[] }) {
  useEffect(() => {
    const sel = ['.reveal', '.reveal-left', '.reveal-right', '.banqplace__event-card', '.banqplace__img-overlap'];
    const all = document.querySelectorAll(sel.join(','));
    
    document.querySelectorAll('.banqplace__event-card').forEach((c, i) => {
      (c as HTMLElement).setAttribute('data-delay', String(i * 120));
    });
    
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const d = parseInt(el.getAttribute('data-delay') || '0');
            setTimeout(() => { el.classList.add('visible'); }, d);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    all.forEach((el) => { io.observe(el); });
    return () => { io.disconnect(); };
  }, []);

  const b = branch;

  return (
    <>
      {/* SECTION 1 — HERO BANNER */}
      <section className="banqplace__hero">
        {b.bannerImage ? (
          <img className="banqplace__hero-img" src={`/uploads/branches/${b.bannerImage}`} alt={b.bannerAlt || b.name} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#2d3621,#4a5c2a)" }} />
        )}
        <div className="banqplace__hero-overlay" />
      </section>

      {/* SECTION 2 — BRANCH INTRO */}
      <section className="banqplace__intro">
        <div className="banqplace__intro-grid">
          <div className="banqplace__intro-left">
            <h1 className="banqplace__branch-title reveal">{b.name}</h1>
            <div className="banqplace__divider" />
            {b.description && <p className="banqplace__branch-desc reveal">{b.description}</p>}
            {(b.contact || b.timing) && (
              <div className="banqplace__meta reveal">
                {b.contact && (
                  <div className="banqplace__meta-row">
                    <strong>Contact Us:</strong>
                    <span>{b.contact}</span>
                  </div>
                )}
                {b.timing && (
                  <div className="banqplace__meta-row">
                    <strong>Timing:</strong>
                    <span>{b.timing}</span>
                  </div>
                )}
              </div>
            )}
            {b.offerItems?.length > 0 && (
              <>
                <h2 className="banqplace__offer-heading reveal">What We Offer</h2>
                <ul className="banqplace__offer-list reveal">
                  {b.offerItems.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {b.cardImage && (
            <div className="banqplace__intro-img reveal-right">
              <img src={`/uploads/branches/${b.cardImage}`} alt={b.cardAlt || b.name} />
            </div>
          )}
        </div>
        {b.whyChoose && (
          <div className="banqplace__why reveal">
            <h2 className="banqplace__why-heading">Why Choose Damru?</h2>
            <p>{b.whyChoose}</p>
          </div>
        )}
      </section>

      {/* SECTION 3 — EVENT TYPES */}
      {b.eventTypes?.length > 0 && (
        <section className="banqplace__events">
          <div className="banqplace__events-inner">
            <h2 className="banqplace__section-heading reveal">Event Types We Host</h2>
            <div className="banqplace__events-grid">
              {b.eventTypes.map((ev: any, i: number) => (
                <div key={i} className="banqplace__event-card" data-delay={String(i * 120)}>
                  <div className="banqplace__event-img-wrap">
                    {ev.image ? (
                      <img src={`/uploads/branches/${ev.image}`} alt={ev.label} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#e5e7eb" }} />
                    )}
                  </div>
                  <span className="banqplace__event-label">{ev.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTIONS 4+ — HALL CARDS (alternating bg) */}
      {hallCards.map((hall: any, i: number) => {
        const isAlt = i % 2 !== 0;
        const SectionClass = isAlt ? "banqplace__multi" : "banqplace__bday";
        const GridClass = isAlt ? "banqplace__multi-grid" : "banqplace__bday-grid";
        return (
          <section key={i} className={SectionClass}>
            <div className={isAlt ? "banqplace__multi-inner" : ""}>
              <div className={GridClass}>
                <div>
                  <h2 className="banqplace__content-title reveal">{hall.title}</h2>
                  {hall.subtitle && <p className="banqplace__content-subtitle">{hall.subtitle}</p>}
                  {hall.description && <p className="banqplace__content-body reveal">{hall.description}</p>}
                  {hall.features?.length > 0 && (
                    <>
                      <p className="banqplace__features-title">Features &amp; Facilities</p>
                      <ul className="banqplace__bullet-list reveal">
                        {hall.features.map((f: string, j: number) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {hall.perfectFor?.length > 0 && (
                    <>
                      <p className="banqplace__features-title" style={{ marginTop: "1.25rem" }}>
                        Perfect For
                      </p>
                      <ul className="banqplace__bullet-list reveal">
                        {hall.perfectFor.map((f: string, j: number) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {hall.images?.length > 0 && (
                  <div className="banqplace__img-overlap reveal-right">
                    <img
                      className="img-back"
                      src={`/uploads/branches/${hall.images[0]}`}
                      alt={`${hall.title} – view 1`}
                    />
                    {hall.images[1] && (
                      <img
                        className="img-front"
                        src={`/uploads/branches/${hall.images[1]}`}
                        alt={`${hall.title} – view 2`}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* BOOKING / CTA — dynamic form, same CSS classes as your original */}
      <BookingForm
        branchSlug={b.slug}
        branchName={b.name}
        ctaTitle={b.ctaTitle}
        ctaSubtitle={b.ctaSubtitle}
      />
    </>
  );
}

// ── Booking form — inline so it doesn't break the file structure ─────────────
function BookingForm({ branchSlug, branchName, ctaTitle, ctaSubtitle }: {
  branchSlug?: string; branchName?: string; ctaTitle?: string; ctaSubtitle?: string;
}) {
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", eventType: "", eventDate: "", guestCount: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [err,  setErr]              = useState("");

  function upd(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim()) {
      setErr("Please fill in your name, phone and email."); return;
    }
    setSubmitting(true); setErr("");
    try {
      const res  = await fetch("/api/banquet-bookings", {
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
        <div className="banqplace__booking-inner" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 className="banqplace__booking-title" style={{ opacity: 1 }}>Booking Request Received!</h2>
          <p className="banqplace__booking-sub" style={{ opacity: 1 }}>
            Thank you! Our team will contact you shortly to confirm your event details.
          </p>
          <button className="banqplace__btn" style={{ opacity: 1, marginTop: 16 }}
            onClick={() => { setDone(false); setForm({ fullName:"", phone:"", email:"", eventType:"", eventDate:"", guestCount:"", message:"" }); }}>
            Submit Another Request
          </button>
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
          <p style={{ color: "#b91c1c", fontFamily: "Jost, sans-serif", fontSize: 13, marginBottom: 12 }}>{err}</p>
        )}

        <form onSubmit={handleSubmit} className="banqplace__form reveal" style={{ flexDirection: "column", alignItems: "center" }}>
          {/* Row 1 — Name, Phone, Email (matches original 3-input row) */}
          <div className="banqplace__form-row">
            <input type="text"  placeholder="Full Name *"      value={form.fullName} onChange={e => upd("fullName", e.target.value)} required />
            <input type="tel"   placeholder="Phone *"          value={form.phone}    onChange={e => upd("phone",    e.target.value)} required />
            <input type="email" placeholder="Email Address *"  value={form.email}    onChange={e => upd("email",    e.target.value)} required />
          </div>

          {/* Row 2 — Event details */}
          <div className="banqplace__form-row">
            <select value={form.eventType} onChange={e => upd("eventType", e.target.value)}
              style={{ flex:"1 1 200px", maxWidth:260, padding:"0.85rem 1rem", border:"1.5px solid var(--bp-border)",
                borderRadius:"var(--radius-sm)", background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color: form.eventType ? "var(--bp-dark)" : "#b0a89e", outline:"none" }}>
              <option value="">Event Type (optional)</option>
              <option>Birthday Party</option><option>Wedding / Pre-Wedding</option>
              <option>Corporate Event</option><option>Anniversary</option>
              <option>Baby Shower</option><option>Cultural Event</option><option>Other</option>
            </select>
            <input type="date" value={form.eventDate} onChange={e => upd("eventDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              onKeyDown={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
              style={{ flex:"1 1 160px", maxWidth:200, padding:"0.85rem 1rem", border:"1.5px solid var(--bp-border)",
                borderRadius:"var(--radius-sm)", background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color:"var(--bp-dark)", outline:"none" }} />
            <select value={form.guestCount} onChange={e => upd("guestCount", e.target.value)}
              style={{ flex:"1 1 160px", maxWidth:200, padding:"0.85rem 1rem", border:"1.5px solid var(--bp-border)",
                borderRadius:"var(--radius-sm)", background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color: form.guestCount ? "var(--bp-dark)" : "#b0a89e", outline:"none" }}>
              <option value="">Expected Guests</option>
              <option>Upto 25</option><option>25 – 50</option><option>50 – 100</option>
              <option>100 – 200</option><option>200 – 500</option><option>500+</option>
            </select>
          </div>

          {/* Message */}
          <div style={{ width: "100%", maxWidth: 860 }}>
            <textarea placeholder="Additional message or requirements (optional)"
              value={form.message} onChange={e => upd("message", e.target.value)} rows={3}
              style={{ width:"100%", padding:"0.85rem 1rem", border:"1.5px solid var(--bp-border)",
                borderRadius:"var(--radius-sm)", background:"var(--bp-white)", fontFamily:"Jost,sans-serif",
                fontSize:"0.875rem", color:"var(--bp-dark)", outline:"none", resize:"vertical",
                transition:"border-color 0.25s" }}
              onFocus={e => (e.target.style.borderColor = "var(--bp-accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--bp-border)")} />
          </div>

          <button type="submit" className="banqplace__btn" disabled={submitting} style={{ opacity: 1 }}>
            {submitting ? "Submitting…" : "Book Now"}
          </button>
        </form>
      </div>
    </section>
  );
}