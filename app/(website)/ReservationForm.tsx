"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/website/Toast";
import { getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

interface User { id: string; name: string; email: string }
type ModalKind = "date" | "time" | "persons" | null;

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

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function todayStr() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function indiaMinutesNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  return value("hour") * 60 + value("minute");
}

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s(am|pm)$/.exec(value);
  if (!match) return -1;
  let hour = Number(match[1]) % 12;
  if (match[3] === "pm") hour += 12;
  return hour * 60 + Number(match[2]);
}

function maxDateObj() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2); // Limit booking to 2 years in advance
  return d;
}

function formatDisplayDate(dateStr: string) {
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
}

export default function ReservationForm() {
  const toast = useToast();
  const [user,        setUser]        = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [date,        setDate]        = useState(todayStr);
  const [time,        setTime]        = useState("7:00 pm");
  const [persons,     setPersons]     = useState("2 Persons");
  const [submitting,  setSubmitting]  = useState(false);
  const [booked,      setBooked]      = useState(false);
  const [openModal,   setOpenModal]   = useState<ModalKind>(null);
  const [clock,       setClock]       = useState(() => new Date());

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then(r => r.json())
      .then(d => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    if (!openModal) return;
    closeRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") setOpenModal(null); }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openModal]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function pickDate(d: string) {
    setDate(d);
    if (d === todayStr() && timeToMinutes(time) <= indiaMinutesNow(clock)) {
      const nextSlot = TIMES.find(slot => timeToMinutes(slot) > indiaMinutesNow(clock));
      if (nextSlot) setTime(nextSlot);
    }
    setBooked(false);
    setOpenModal(null);
  }
  function pickTime(t: string) { setTime(t); setBooked(false); setOpenModal(null); }
  function pickPersons(p: string) { setPersons(p); setBooked(false); setOpenModal(null); }

  function isPastTime(t: string) {
    return date === todayStr() && timeToMinutes(t) <= indiaMinutesNow(clock);
  }

  function changeMonth(dir: -1 | 1) {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m); setCalYear(y);
  }

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
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const maxDate = maxDateObj();

    if (selectedDate < todayMidnight) {
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
        setBooked(true);
        toast.success("Reservation request sent", `Your reservation request for ${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })} at ${time} for ${persons} is sent.`, { id: "reservation-submit" });
      }
    } catch (error) {
      toast.error("Reservation not created", getUserErrorMessage(error,"Unable to submit reservation."), { id: "reservation-submit" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Calendar grid ──
  const daysInMonth   = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekday  = new Date(calYear, calMonth, 1).getDay();
  const maxDateLimit  = maxDateObj();
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  const calendarCells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) calendarCells.push(<span key={`empty-${i}`} className="resv-cal__cell resv-cal__cell--empty" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayDate = new Date(calYear, calMonth, day);
    const isPast = dayDate < todayMidnight;
    const isTooFar = dayDate > maxDateLimit;
    const hasNoRemainingSlot = dayStr === todayStr() && TIMES.every(slot => timeToMinutes(slot) <= indiaMinutesNow(clock));
    const isDisabled = isPast || isTooFar || hasNoRemainingSlot;
    const isSelected = date === dayStr;
    const isToday = todayStr() === dayStr;
    calendarCells.push(
      <button
        key={dayStr}
        type="button"
        disabled={isDisabled}
        onClick={() => pickDate(dayStr)}
        className={`resv-cal__cell resv-cal__day${isToday ? " resv-cal__day--today" : ""}${isSelected ? " resv-cal__day--selected" : ""}${isDisabled ? " resv-cal__day--disabled" : ""}`}
      >
        {day}
      </button>
    );
  }

  return (
    <div className="resv">
      <form className="resv__card" onSubmit={handleSubmit}>

        <div className="resv__fields">
          <div className="resv__field">
            <label className="resv__label">Select Date</label>
            <button type="button" className="resv__trigger" onClick={() => setOpenModal("date")}>
              <span>{formatDisplayDate(date)}</span>
              <i className="fa-solid fa-calendar-days" aria-hidden="true"></i>
            </button>
          </div>
          <div className="resv__field">
            <label className="resv__label">Time</label>
            <button type="button" className="resv__trigger" onClick={() => setOpenModal("time")}>
              <span>{time}</span>
              <i className="fa-regular fa-clock" aria-hidden="true"></i>
            </button>
          </div>
          <div className="resv__field">
            <label className="resv__label">Guests</label>
            <button type="button" className="resv__trigger" onClick={() => setOpenModal("persons")}>
              <span>{persons}</span>
              <i className="fa-solid fa-user-group" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="resv__actions">
          {booked ? (
            <div className="resv__booked-row">
              <div className="resv__booked-btn"><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Booked</div>
              <a href="tel:+918690987272" className="resv__call-btn" aria-label="Call the restaurant">
                <i className="fa-solid fa-phone" aria-hidden="true"></i>
              </a>
            </div>
          ) : (
            <button type="submit" className="resv__submit" disabled={submitting || userLoading}>
              {submitting ? "Booking…" : "Book Now"}
            </button>
          )}
        </div>
      </form>

      {/* ── Date modal ── */}
      {openModal === "date" && (
        <div className="resv__backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpenModal(null); }}>
          <section className="resv__modal" role="dialog" aria-modal="true" aria-label="Select reservation date">
            <button ref={closeRef} type="button" className="resv__modal-close" onClick={() => setOpenModal(null)} aria-label="Close">&times;</button>
            <div className="resv-cal__header">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><i className="fa-solid fa-chevron-left"></i></button>
              <span>{MONTH_NAMES[calMonth]} {calYear}</span>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="resv-cal__weekdays">
              {WEEKDAY_LABELS.map(w => <span key={w}>{w}</span>)}
            </div>
            <div className="resv-cal__grid">{calendarCells}</div>
          </section>
        </div>
      )}

      {/* ── Time modal ── */}
      {openModal === "time" && (
        <div className="resv__backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpenModal(null); }}>
          <section className="resv__modal" role="dialog" aria-modal="true" aria-label="Select reservation time">
            <button ref={closeRef} type="button" className="resv__modal-close" onClick={() => setOpenModal(null)} aria-label="Close">&times;</button>
            <h3 className="resv__modal-title">Select Time Slot</h3>
            <div className="resv__pill-grid resv__pill-grid--scroll">
              {TIMES.map(t => (
                <button
                  key={t}
                  type="button"
                  disabled={isPastTime(t)}
                  aria-disabled={isPastTime(t)}
                  title={isPastTime(t) ? "This time has already passed" : undefined}
                  className={`resv__pill${time === t ? " resv__pill--active" : ""}${isPastTime(t) ? " resv__pill--disabled" : ""}`}
                  onClick={() => pickTime(t)}
                >{t}</button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── Guests modal ── */}
      {openModal === "persons" && (
        <div className="resv__backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpenModal(null); }}>
          <section className="resv__modal" role="dialog" aria-modal="true" aria-label="Select number of guests">
            <button ref={closeRef} type="button" className="resv__modal-close" onClick={() => setOpenModal(null)} aria-label="Close">&times;</button>
            <h3 className="resv__modal-title">Number of Guests</h3>
            <div className="resv__pill-grid resv__pill-grid--scroll">
              {PERSONS.map(p => (
                <button key={p} type="button" className={`resv__pill${persons === p ? " resv__pill--active" : ""}`} onClick={() => pickPersons(p)}>{p}</button>
              ))}
            </div>
          </section>
        </div>
      )}

      <style>{`
        .resv{ width:100%; max-width:560px; margin:0 auto; font-family:Poppins,sans-serif; }
        .resv__card{ background:#fff; border:1px solid #f0e4d8; border-radius:24px; padding:32px; box-shadow:0 20px 55px rgba(43,26,10,.09); }
        .resv__fields{ display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px; }
        .resv__field{ flex:1 1 0; min-width:110px; }
        .resv__label{ display:block; font-size:.72rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#b8a894; margin-bottom:7px; }
        .resv__trigger{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; background:#fffaf5; border:1.5px solid #ecdfd0; border-radius:13px; padding:14px 14px; font-family:Poppins,sans-serif; font-size:.92rem; font-weight:500; color:#2a2117; cursor:pointer; transition:border-color .18s ease, box-shadow .18s ease; text-align:left; }
        .resv__trigger span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .resv__trigger i{ color:#e67e22; flex-shrink:0; font-size:.9rem; }
        .resv__trigger:hover{ border-color:#e9c299; }
        .resv__trigger:focus-visible{ outline:none; border-color:#e67e22; box-shadow:0 0 0 3px rgba(230,126,34,.15); }
        .resv__actions{ display:flex; justify-content:center; }
        .resv__submit{ width:auto; background:linear-gradient(135deg,#e67e22,#d35400); color:#fff; border:none; border-radius:13px; padding:15px 52px; font-family:Poppins,sans-serif; font-size:1rem; font-weight:600; letter-spacing:.03em; text-transform:uppercase; cursor:pointer; box-shadow:0 12px 24px rgba(211,84,0,.28); transition:transform .2s ease, box-shadow .2s ease, opacity .2s ease; }
        .resv__submit:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 16px 30px rgba(211,84,0,.34); }
        .resv__submit:disabled{ opacity:.65; cursor:not-allowed; transform:none; }
        .resv__booked-row{ display:flex; justify-content:center; gap:10px; }
        .resv__booked-btn{ display:flex; align-items:center; justify-content:center; gap:8px; background:#eaf7ee; color:#198754; border:1.5px solid #bfe6cc; border-radius:13px; padding:15px 34px; font-size:.95rem; font-weight:600; }
        .resv__call-btn{ flex:0 0 auto; width:52px; display:flex; align-items:center; justify-content:center; background:#e67e22; color:#fff; border-radius:13px; text-decoration:none; font-size:1.05rem; box-shadow:0 8px 18px rgba(230,126,34,.28); transition:background .18s ease; }
        .resv__call-btn:hover{ background:#c96a12; }

        .resv__backdrop{ position:fixed; inset:0; z-index:100000; display:grid; place-items:center; padding:20px; background:rgba(30,20,12,.5); backdrop-filter:blur(4px); animation:resv-backdrop-in .16s ease-out; }
        .resv__modal{ position:relative; width:min(100%,360px); max-height:min(600px,86vh); overflow-y:auto; background:#fff; border-radius:20px; padding:26px; box-shadow:0 24px 70px rgba(30,20,12,.24); font-family:Poppins,sans-serif; animation:resv-modal-in .18s cubic-bezier(.2,.8,.2,1); }
        .resv__modal-close{ position:absolute; top:12px; right:12px; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:#aaa; font-size:20px; line-height:1; cursor:pointer; }
        .resv__modal-close:hover{ background:#f5f1ec; color:#333; }
        .resv__modal-title{ margin:0 0 18px; font-family:"Playfair Display",serif; font-size:1.3rem; color:#1a1a1a; text-align:center; }

        .resv-cal__header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .resv-cal__header span{ font-weight:600; font-size:.98rem; color:#1a1a1a; }
        .resv-cal__header button{ border:0; background:#fdf4ea; color:#e67e22; width:32px; height:32px; border-radius:9px; cursor:pointer; display:grid; place-items:center; }
        .resv-cal__header button:hover{ background:#fbe7d1; }
        .resv-cal__weekdays{ display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:6px; }
        .resv-cal__weekdays span{ text-align:center; font-size:.72rem; font-weight:600; color:#b8a894; }
        .resv-cal__grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
        .resv-cal__cell{ aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; }
        .resv-cal__day{ border:0; background:transparent; border-radius:50%; font-family:Poppins,sans-serif; font-size:.86rem; color:#2a2117; cursor:pointer; }
        .resv-cal__day:hover:not(:disabled){ background:#fdf4ea; }
        .resv-cal__day--today{ box-shadow:inset 0 0 0 1.5px #e67e22; color:#e67e22; font-weight:600; }
        .resv-cal__day--selected{ background:#e67e22 !important; color:#fff; font-weight:600; }
        .resv-cal__day--disabled{ color:#d8cfc3; cursor:not-allowed; }

        .resv__pill-grid{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
        .resv__pill-grid--scroll{ max-height:300px; overflow-y:auto; padding-right:2px; }
        .resv__pill{ border:1px solid #ecdfd0; background:#fff; color:#2a2117; border-radius:10px; padding:8px 13px; font-family:Poppins,sans-serif; font-size:.83rem; cursor:pointer; transition:border-color .15s ease, background .15s ease, color .15s ease; }
        .resv__pill:hover{ border-color:#e9c299; }
        .resv__pill--active{ background:#e67e22; border-color:#e67e22; color:#fff; font-weight:600; }
        .resv__pill--disabled,
        .resv__pill--disabled:hover{ background:#f5f2ee; border-color:#e7dfd7; color:#aaa29a; cursor:not-allowed; opacity:.58; font-weight:400; }

        @keyframes resv-backdrop-in{ from{ opacity:0; } to{ opacity:1; } }
        @keyframes resv-modal-in{ from{ opacity:0; transform:translateY(8px) scale(.98); } to{ opacity:1; transform:translateY(0) scale(1); } }
        @media(prefers-reduced-motion:reduce){ .resv__backdrop,.resv__modal{ animation:none; } }

        @media(max-width:480px){
          .resv__card{ padding:20px; border-radius:20px; }
          .resv__fields{ gap:8px; }
          .resv__field{ min-width:88px; }
          .resv__trigger{ padding:12px 10px; font-size:.8rem; }
          .resv__trigger i{ font-size:.78rem; }
          .resv__submit{ padding:14px 36px; font-size:.92rem; }
          .resv__booked-btn{ padding:14px 22px; font-size:.88rem; }
        }

        /* Big screens — scale the widget up so it reads as an intentional
           premium panel instead of a small mobile-sized box floating in
           a lot of empty desktop space. */
        @media(min-width:900px){
          .resv{ max-width:100%; }
          .resv__card{ padding:44px 56px; border-radius:28px; }
          .resv__fields{ gap:20px; margin-bottom:28px; }
          .resv__label{ font-size:.78rem; margin-bottom:9px; }
          .resv__trigger{ padding:17px 20px; font-size:1rem; border-radius:14px; }
          .resv__trigger i{ font-size:1rem; }
          .resv__submit{ padding:18px 60px; font-size:1.05rem; border-radius:14px; }
          .resv__booked-btn{ padding:18px 40px; font-size:1.02rem; border-radius:14px; }
          .resv__call-btn{ width:60px; border-radius:14px; font-size:1.15rem; }
        }
      `}</style>
    </div>
  );
}
