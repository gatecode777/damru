"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/website/Toast";
import { getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

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

export default function ReservationForm() {
  const toast = useToast();
  const [user,        setUser]        = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [date,        setDate]        = useState(todayStr);
  const [time,        setTime]        = useState("7:00 pm");
  const [persons,     setPersons]     = useState("2 Persons");
  const [submitting,  setSubmitting]  = useState(false);

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
      toast.error("Invalid reservation date", "Please enter a valid date (YYYY-MM-DD).");
      return;
    }

    // Date range validation
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    if (selectedDate < today) {
      toast.error("Invalid reservation date", "Reservations cannot be in the past.");
      return;
    }
    if (selectedDate > maxDate) {
      toast.error("Invalid reservation date", "Reservations can only be made up to 2 years in advance.");
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
      if (!res.ok || data.error) {
        toast.error("Reservation not created", getUserResponseError(res,data,"Unable to submit reservation."), { id: "reservation-submit" });
      } else {
        toast.success("Reservation confirmed", `${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })} at ${time} for ${persons}. We'll see you soon! 🎉`, { id: "reservation-submit" });
        setDate(todayStr());
      }
    } catch (error) {
      toast.error("Reservation not created", getUserErrorMessage(error,"Unable to submit reservation."), { id: "reservation-submit" });
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
              onChange={e => setDate(e.target.value)}
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

    </div>
  );
}
