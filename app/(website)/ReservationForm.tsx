"use client";

import { useState, useEffect } from "react";

interface User { id: string; name: string; email: string }

const TIMES = [
  "11:00 am", "11:30 am",
  "12:00 pm", "12:30 pm",
  "1:00 pm",  "1:30 pm",
  "2:00 pm",  "2:30 pm",
  "3:00 pm",  "3:30 pm",
  "4:00 pm",  "4:30 pm",
  "5:00 pm",  "5:30 pm",
  "6:00 pm",  "6:30 pm",
  "7:00 pm",  "7:30 pm",
  "8:00 pm",  "8:30 pm",
  "9:00 pm",  "9:30 pm",
  "10:00 pm",
];

const PERSONS = [
  "1 Person",  "2 Persons", "3 Persons", "4 Persons",
  "5 Persons", "6 Persons", "7 Persons", "8 Persons",
  "9 Persons", "10 Persons", "10+ Persons",
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function maxDateStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2); // Limit booking to 2 years in advance
  return d.toISOString().split("T")[0];
}

function clampDateString(val: string): string {
  // Keep only digits and dashes
  let clean = val.replace(/[^0-9-]/g, "");
  const parts = clean.split("-");
  const maxYear = new Date().getFullYear() + 2;

  // Year: max 4 digits, max year limit
  if (parts[0]) {
    parts[0] = parts[0].slice(0, 4);
    const y = parseInt(parts[0], 10);
    if (parts[0].length === 4 && y > maxYear) {
      parts[0] = String(maxYear);
    }
  }

  // Month: max 2 digits, max 12
  if (parts[1]) {
    parts[1] = parts[1].slice(0, 2);
    const m = parseInt(parts[1], 10);
    if (parts[1].length === 2 && (m < 1 || m > 12)) {
      parts[1] = "12";
    }
  }

  // Day: max 2 digits, max 31
  if (parts[2]) {
    parts[2] = parts[2].slice(0, 2);
    const d = parseInt(parts[2], 10);
    if (parts[2].length === 2 && (d < 1 || d > 31)) {
      parts[2] = "31";
    }
  }

  let formatted = parts.join("-");
  if (formatted.length > 10) {
    formatted = formatted.slice(0, 10);
  }
  return formatted;
}

export default function ReservationForm() {
  const [user,        setUser]        = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [date,        setDate]        = useState(todayStr);
  const [time,        setTime]        = useState("7:00 pm");
  const [persons,     setPersons]     = useState("2 Persons");
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    fetch("/api/user/me")
      .then(r => r.json())
      .then(d => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    if (!date || date.length < 10) {
      showToast("Please enter a valid date (YYYY-MM-DD).", "error");
      return;
    }

    // Date range validation
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    if (selectedDate < today) {
      showToast("Reservations cannot be in the past.", "error");
      return;
    }
    if (selectedDate > maxDate) {
      showToast("Reservations can only be made up to 2 years in advance.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res  = await fetch("/api/reservations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, time, persons }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast(`Reservation confirmed for ${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })} at ${time} for ${persons}. We'll see you soon! 🎉`, "success");
        setDate(todayStr());
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <form className="res-booking-form" onSubmit={handleSubmit}>
        <div className="res-form-grid">

          {/* Date */}
          <div className="res-input-box">
            <input
              type="date"
              min={todayStr()}
              max={maxDateStr()}
              value={date}
              onChange={e => {
                setDate(clampDateString(e.target.value));
              }}
              onKeyDown={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
              required
            />
            <span className="res-arrow" />
          </div>

          {/* Time */}
          <div className="res-input-box">
            <select value={time} onChange={e => setTime(e.target.value)}>
              {TIMES.map(t => <option key={t}>{t}</option>)}
            </select>
            <span className="res-arrow" />
          </div>

          {/* Persons */}
          <div className="res-input-box">
            <select value={persons} onChange={e => setPersons(e.target.value)}>
              {PERSONS.map(p => <option key={p}>{p}</option>)}
            </select>
            <span className="res-arrow" />
          </div>

        </div>

        <div className="res-btn-wrapper">
          <button
            type="submit"
            className="res-submit-btn"
            disabled={submitting || userLoading}
            style={{ opacity: (submitting || userLoading) ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Booking…" : "Book Now"}
          </button>
        </div>
      </form>

      {/* Bottom-center toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%",
          transform: "translateX(-50%)", zIndex: 99999,
          background: toast.type === "success" ? "#15803d" : "#dc2626",
          color: "#fff", padding: "14px 28px", borderRadius: 14,
          fontFamily: "Poppins, sans-serif", fontSize: "0.9rem", fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)", maxWidth: "90vw",
          textAlign: "center", lineHeight: 1.6,
          animation: "resSlideUp 0.25s ease",
        }}>
          {toast.type === "success" ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}

      <style jsx>{`
        @keyframes resSlideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}