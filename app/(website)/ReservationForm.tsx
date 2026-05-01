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

export default function ReservationForm() {
  const [user,        setUser]        = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [date,        setDate]        = useState("");
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
      showToast("Please login to make a reservation.", "error");
      return;
    }
    if (!date) {
      showToast("Please select a date.", "error");
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
        setDate("");
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
              type="text"
              placeholder="Select Date"
              value={date}
              onFocus={e => { e.target.type = "date"; e.target.min = todayStr(); }}
              onBlur={e  => { if (!e.target.value) e.target.type = "text"; }}
              onChange={e => setDate(e.target.value)}
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