"use client";

import React, { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CalendarDays, Clock, Users, StickyNote, Trash2, Loader2, ChevronDown, Check, CalendarCheck, CalendarX, Minus } from "lucide-react";
import type { ReservationRow } from "./page";
import { useToast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import DeclineReservationDialog from "@/components/admin/DeclineReservationDialog";
import { getAdminResponseError } from "@/lib/admin-error";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, Record<string, boolean>>; }

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  pending:   { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  confirmed: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#16a34a" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", dot: "#dc2626" },
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Declined",
};

function fmtDate(d: string, createdAt?: string) {
  const parsed = parseReservationDate(d, createdAt);
  return parsed
    ? parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" })
    : "Date unavailable";
}

function parseReservationDate(value: string, createdAt?: string): Date | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  const legacy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  const malformedLegacy = /-(\d{2})-(\d{2})$/.exec(trimmed);
  const createdYear = createdAt ? new Date(createdAt).getFullYear() : Number.NaN;
  const date = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : legacy
      ? new Date(Number(legacy[3]), Number(legacy[2]) - 1, Number(legacy[1]))
      : malformedLegacy && Number.isFinite(createdYear)
        ? new Date(createdYear, Number(malformedLegacy[1]) - 1, Number(malformedLegacy[2]))
      : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reservationDateKey(value: string, createdAt?: string): string {
  const date = parseReservationDate(value, createdAt);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function customerInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "G";
}

function SelectionCheckbox({ checked, partial = false, label, onChange }: { checked: boolean; partial?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      className={`reservation-checkbox${checked || partial ? " reservation-checkbox--checked" : ""}`}
      role="checkbox"
      aria-checked={partial ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
    >
      {partial ? <Minus size={12} strokeWidth={3} /> : checked ? <Check size={12} strokeWidth={3} /> : null}
    </button>
  );
}

function fmtCreated(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Status dropdown — uses fixed positioning to escape table overflow ───────────
function StatusDropdown({ reservation, onUpdated, onDecline, canEdit }: { reservation: ReservationRow; onUpdated: (id: string, status: string) => void; onDecline: (reservation: ReservationRow) => void; canEdit: boolean }) {
  const toast = useToast();
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
    if (status === "cancelled") {
      setOpen(false);
      onDecline(reservation);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const res = await fetch(`/api/reservations/${reservation._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { onUpdated(reservation._id, status); toast.success(status === "confirmed" ? "Reservation confirmed" : "Reservation updated"); }
      else toast.error("Reservation not updated", await getAdminResponseError(res, "Unable to update reservation."));
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
        {STATUS_LABEL[reservation.status] ?? reservation.status}
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
                  {STATUS_LABEL[st]}
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
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: 0, fontStyle: "italic" }}>&ldquo;{r.notes}&rdquo;</p>
        ) : (
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#d1d5db", margin: 0 }}>No notes</p>
        )}
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", color: "#9ca3af", margin: "8px 0 0" }}>Booked on {fmtCreated(r.createdAt)}</p>
        {r.status === "cancelled" && r.declineReason && (
          <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2" }}>
            <p style={{ margin: "0 0 3px", color: "#b91c1c", fontFamily: "DM Sans,sans-serif", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>Decline message</p>
            <p style={{ margin: 0, color: "#7f1d1d", fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", lineHeight: 1.45 }}>{r.declineReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main ReservationsClient
// ════════════════════════════════════════════════════════════
export default function ReservationsClient({ reservations: initial, perms }: { reservations: ReservationRow[]; perms?: Perms }) {
  const router = useRouter();
  const toast = useToast();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.reservations?.[action]);
  
  const [reservations, setReservations] = useState<ReservationRow[]>(initial);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter,   setDateFilter]   = useState("all"); // all | today | upcoming | past
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [declineIds, setDeclineIds] = useState<string[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      const dateKey = reservationDateKey(r.date, r.createdAt);
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFilter === "today"    && dateKey !== today) return false;
      if (dateFilter === "upcoming" && (!dateKey || dateKey < today || r.status === "cancelled")) return false;
      if (dateFilter === "past"     && (!dateKey || dateKey >= today)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.userName.toLowerCase().includes(q) &&
            !r.userEmail.toLowerCase().includes(q) &&
            !r.date.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, search, statusFilter, dateFilter, today]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((reservation) => selected.has(reservation._id));
  const someFilteredSelected = !allFilteredSelected && filtered.some((reservation) => selected.has(reservation._id));

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((previous) => {
      const next = new Set(previous);
      filtered.forEach((reservation) => allFilteredSelected ? next.delete(reservation._id) : next.add(reservation._id));
      return next;
    });
  }

  function handleStatusUpdated(id: string, status: string, declineReason = "") {
    setReservations(prev => prev.map(r => r._id === id ? { ...r, status, declineReason } : r));
    router.refresh();
  }

  async function updateSelected(ids: string[], status: "pending" | "confirmed" | "cancelled", declineReason = "") {
    if (!can("edit") || ids.length === 0) return;
    setBulkLoading(true);
    try {
      const response = await fetch("/api/reservations/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status, declineReason }),
      });
      if (!response.ok) {
        toast.error("Reservations not updated", await getAdminResponseError(response, "Unable to update selected reservations."));
        return;
      }
      const payload = await response.json() as { updatedIds?: string[] };
      const updatedIds = new Set(payload.updatedIds ?? ids);
      setReservations((previous) => previous.map((reservation) => updatedIds.has(reservation._id)
        ? { ...reservation, status, declineReason: status === "cancelled" ? declineReason : "" }
        : reservation));
      setSelected(new Set());
      setDeclineIds([]);
      router.refresh();
      toast.success(status === "cancelled"
        ? `${updatedIds.size} reservation${updatedIds.size === 1 ? "" : "s"} declined`
        : `${updatedIds.size} reservation${updatedIds.size === 1 ? "" : "s"} confirmed`);
    } catch {
      toast.error("Unable to update selected reservations");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleDelete() {
    if (!can("delete")) return;
    if (!pendingDelete) return;
    if (deleteReason.trim().length < 5) return;
    const { id } = pendingDelete;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      if (!res.ok) {
        toast.error("Reservation not deleted", await getAdminResponseError(res, "Unable to delete reservation."));
        return;
      }
      setReservations(prev => prev.filter(r => r._id !== id));
      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setPendingDelete(null);
      setDeleteReason("");
      if (expandedId === id) setExpandedId(null);
      router.refresh();
      toast.success("Reservation deleted");
    } catch {
      toast.error("Unable to delete reservation");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="reservations-admin">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toolbar */}
      <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="toolbar-left" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input className="search-inp" placeholder="Search by name, email, date…"
              value={search} onChange={e => { setSearch(e.target.value); clearSelection(); }} />
            {search && <button onClick={() => { setSearch(""); clearSelection(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "pending", "confirmed", "cancelled"] as const).map(k => (
              <button key={k} className={`cat-tab${statusFilter === k ? " tab-active" : ""}`}
                onClick={() => { setStatusFilter(k); clearSelection(); }}>
                {k === "all" ? "All" : STATUS_LABEL[k]}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <select className="filter-select" value={dateFilter} onChange={e => { setDateFilter(e.target.value); clearSelection(); }}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && can("edit") && (
        <div className="bulk-bar reservation-bulk-bar">
          <div className="bulk-bar-left">
            <div className="reservation-selection-summary">
              <span className="reservation-selection-icon"><Check size={17} strokeWidth={2.6} /></span>
              <span className="reservation-selection-copy">
                <span className="bulk-count">{selected.size} reservation{selected.size === 1 ? "" : "s"} selected</span>
                <span className="reservation-selection-hint">Choose an action for the selected requests</span>
              </span>
            </div>
            <button className="bulk-bar-clear" onClick={clearSelection} disabled={bulkLoading}>
              <X size={12} /> Clear
            </button>
          </div>
          <div className="bulk-bar-actions">
            <button className="bulk-btn reservation-bulk-button reservation-bulk-button--confirm" onClick={() => void updateSelected([...selected], "confirmed")} disabled={bulkLoading}>
              {bulkLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CalendarCheck size={13} />}
              Confirm selected
            </button>
            <button className="bulk-btn reservation-bulk-button reservation-bulk-button--decline" onClick={() => setDeclineIds([...selected])} disabled={bulkLoading}>
              <CalendarX size={13} /> Decline selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card reservation-table-card" style={{ overflow: "hidden", padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "60px 20px" }}>
            <CalendarDays size={40} />
            <p>{search || statusFilter !== "all" || dateFilter !== "all"
              ? "No reservations match your filters."
              : "No reservations yet."}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table reservation-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <SelectionCheckbox
                      checked={allFilteredSelected}
                      partial={someFilteredSelected}
                      onChange={toggleAllFiltered}
                      label="Select all visible reservations"
                    />
                  </th>
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
                  const dateKey = reservationDateKey(r.date, r.createdAt);
                  const isPast = Boolean(dateKey && dateKey < today);
                  const isSelected = selected.has(r._id);
                  return (
                    <React.Fragment key={r._id}>
                      <tr
                        className={`reservation-row${isSelected ? " reservation-row--selected" : ""}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => setExpandedId(isExpanded ? null : r._id)}>
                        <td onClick={(event) => event.stopPropagation()}>
                          <SelectionCheckbox
                            checked={isSelected}
                            onChange={() => toggleOne(r._id)}
                            label={`Select reservation for ${r.userName}`}
                          />
                        </td>
                        <td>
                          <div className="reservation-customer">
                            <span className="reservation-customer__avatar" aria-hidden="true">{customerInitials(r.userName)}</span>
                            <div style={{ minWidth: 0 }}>
                              <p className="reservation-customer__name">{r.userName}</p>
                              <p className="reservation-customer__email">{r.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: isPast ? "#9ca3af" : "#111827", fontWeight: dateKey === today ? 700 : 500 }}>
                            {dateKey === today && <span style={{ color: "#f97316", fontSize: "0.68rem", display: "block", fontWeight: 800, letterSpacing: "0.06em" }}>TODAY</span>}
                            {fmtDate(r.date, r.createdAt)}
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
                          <StatusDropdown reservation={r} onUpdated={handleStatusUpdated} onDecline={(reservation) => setDeclineIds([reservation._id])} canEdit={can("edit")} />
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
                              <button onClick={() => { setPendingDelete({ id: r._id, name: r.userName }); setDeleteReason(""); }} disabled={deletingId === r._id}
                                className="reservation-delete-button" aria-label={`Delete reservation for ${r.userName}`}>
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
                          <td colSpan={8} style={{ padding: 0, border: "none" }}>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete reservation?"
        description={pendingDelete
          ? `The reservation for ${pendingDelete.name} will be permanently removed. Tell the customer why it was removed.`
          : ""}
        cancelLabel="Keep reservation"
        confirmLabel="Delete reservation"
        busy={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        confirmDisabled={deleteReason.trim().length < 5}
        onCancel={() => {
          if (!deletingId) {
            setPendingDelete(null);
            setDeleteReason("");
          }
        }}
        onConfirm={() => void handleDelete()}
      >
        <div className="reservation-delete-message">
          <label className="decline-dialog__label" htmlFor="delete-reservation-reason">Message to customer</label>
          <textarea
            id="delete-reservation-reason"
            className="decline-dialog__textarea"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value.slice(0, 500))}
            placeholder="Example: This was a duplicate request, so we removed it from your reservations."
            rows={4}
            maxLength={500}
            disabled={Boolean(deletingId)}
          />
          <div className="decline-dialog__help">
            <span>{deleteReason.trim().length < 5 ? "Enter at least 5 characters to continue." : "The customer will receive this message."}</span>
            <span>{deleteReason.length}/500</span>
          </div>
        </div>
      </ConfirmDialog>
      <DeclineReservationDialog
        key={declineIds.join(",")}
        open={declineIds.length > 0}
        count={declineIds.length}
        busy={bulkLoading}
        onCancel={() => {
          if (!bulkLoading) setDeclineIds([]);
        }}
        onConfirm={(reason) => void updateSelected(declineIds, "cancelled", reason)}
      />
    </div>
  );
}
