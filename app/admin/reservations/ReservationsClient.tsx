"use client";

import React, { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CalendarDays, Clock, Users, StickyNote, Trash2, Loader2, ChevronDown } from "lucide-react";
import type { ReservationRow } from "./page";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  pending:   { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  confirmed: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#16a34a" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", dot: "#dc2626" },
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
}

function fmtCreated(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Status dropdown — uses fixed positioning to escape table overflow ───────────
function StatusDropdown({ reservation, onUpdated, canEdit }: { reservation: ReservationRow; onUpdated: (id: string, status: string) => void; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const [isPending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  function openDropdown() {
    if (!canEdit) return;
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  function change(status: string) {
    if (status === reservation.status) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      const res = await fetch(`/api/reservations/${reservation._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onUpdated(reservation._id, status);
    });
  }

  const s = STATUS_STYLE[reservation.status] ?? STATUS_STYLE.pending;

  // If user can't edit, show static badge instead of dropdown
  if (!canEdit) {
    return <StatusBadge status={reservation.status} />;
  }

  return (
    <>
      <button ref={btnRef} onClick={openDropdown} disabled={isPending}
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 8, padding: "5px 10px", fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
        {isPending ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />}
        {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
        <ChevronDown size={11} />
      </button>

      {/* Portal-style fixed dropdown — not clipped by table overflow */}
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9997 }} onClick={() => setOpen(false)} />
          <div style={{ position: "fixed", top: pos.top, left: pos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 9998, minWidth: 150, overflow: "hidden" }}>
            {(["pending", "confirmed", "cancelled"] as const).map(st => {
              const ss = STATUS_STYLE[st];
              return (
                <button key={st} onClick={() => change(st)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: reservation.status === st ? "#fff7ed" : "#fff", border: "none", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: reservation.status === st ? "#f97316" : "#374151", fontWeight: reservation.status === st ? 600 : 400, textAlign: "left" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                  {reservation.status === st && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ── Expanded detail row ──────────────────────────────────────
function DetailRow({ r }: { r: ReservationRow }) {
  return (
    <div style={{ padding: "12px 20px 16px", background: "#fafafa", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      <div>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Contact</p>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: 0 }}>{r.userName}</p>
        <a href={`mailto:${r.userEmail}`} style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#f97316", textDecoration: "none", display: "block" }}>{r.userEmail}</a>
        {r.userPhone && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#6b7280", margin: 0 }}>{r.userPhone}</p>}
      </div>
      <div>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Booking Details</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays size={13} style={{ color: "#f97316" }} /> {fmtDate(r.date)}
          </span>
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} style={{ color: "#f97316" }} /> {r.time}
          </span>
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={13} style={{ color: "#f97316" }} /> {r.persons}
          </span>
        </div>
      </div>
      <div>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Notes</p>
        {r.notes ? (
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: 0, fontStyle: "italic" }}>"{r.notes}"</p>
        ) : (
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#d1d5db", margin: 0 }}>No notes</p>
        )}
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", color: "#9ca3af", margin: "8px 0 0" }}>Booked on {fmtCreated(r.createdAt)}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main ReservationsClient
// ════════════════════════════════════════════════════════════
export default function ReservationsClient({ reservations: initial, perms }: { reservations: ReservationRow[]; perms?: Perms }) {
  const router = useRouter();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.reservations?.[action]);
  
  const [reservations, setReservations] = useState<ReservationRow[]>(initial);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter,   setDateFilter]   = useState("all"); // all | today | upcoming | past
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFilter === "today"    && r.date !== today) return false;
      if (dateFilter === "upcoming" && (r.date < today || r.status === "cancelled")) return false;
      if (dateFilter === "past"     && r.date >= today)  return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.userName.toLowerCase().includes(q) &&
            !r.userEmail.toLowerCase().includes(q) &&
            !r.date.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, search, statusFilter, dateFilter, today]);

  function handleStatusUpdated(id: string, status: string) {
    setReservations(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!can("delete")) return;
    if (!confirm(`Delete reservation for "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    setReservations(prev => prev.filter(r => r._id !== id));
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
    router.refresh();
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toolbar */}
      <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="toolbar-left" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input className="search-inp" placeholder="Search by name, email, date…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "pending", "confirmed", "cancelled"] as const).map(k => (
              <button key={k} className={`cat-tab${statusFilter === k ? " tab-active" : ""}`}
                onClick={() => setStatusFilter(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <select className="filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "60px 20px" }}>
            <CalendarDays size={40} />
            <p>{search || statusFilter !== "all" || dateFilter !== "all"
              ? "No reservations match your filters."
              : "No reservations yet."}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Persons</th>
                  <th>Status</th>
                  <th>Booked On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isExpanded = expandedId === r._id;
                  const isPast     = r.date < today;
                  return (
                    <React.Fragment key={r._id}>
                      <tr
                        style={{ cursor: "pointer", background: isExpanded ? "#fff7ed" : undefined, opacity: r.status === "cancelled" ? 0.7 : 1 }}
                        onClick={() => setExpandedId(isExpanded ? null : r._id)}>
                        <td>
                          <div style={{ fontFamily: "DM Sans,sans-serif" }}>
                            <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", margin: 0 }}>{r.userName}</p>
                            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{r.userEmail}</p>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: isPast ? "#9ca3af" : "#111827", fontWeight: r.date === today ? 700 : 400 }}>
                            {r.date === today && <span style={{ color: "#f97316", fontSize: "0.72rem", display: "block", fontWeight: 700 }}>TODAY</span>}
                            {fmtDate(r.date)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={13} style={{ color: "#9ca3af" }} />{r.time}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
                            <Users size={13} style={{ color: "#9ca3af" }} />{r.persons}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <StatusDropdown reservation={r} onUpdated={handleStatusUpdated} canEdit={can("edit")} />
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#6b7280" }}>
                            {fmtCreated(r.createdAt)}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {r.notes && (
                              <span title={r.notes} style={{ color: "#f97316", display: "flex", alignItems: "center" }}>
                                <StickyNote size={14} />
                              </span>
                            )}
                            {can("delete") && (
                              <button onClick={() => handleDelete(r._id, r.userName)} disabled={deletingId === r._id}
                                style={{ background: "#fef2f2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}>
                                {deletingId === r._id
                                  ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                                  : <Trash2 size={13} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, border: "none" }}>
                            <DetailRow r={r} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#9ca3af", textAlign: "right" }}>
        Showing {filtered.length} of {reservations.length} reservations
      </p>
    </>
  );
}