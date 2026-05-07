"use client";

import { useState } from "react";
import { Phone, Mail, CalendarDays, Users, MessageSquare, Trash2, X, CheckCircle, Clock, PhoneCall, XCircle, ChevronDown, ChevronUp, Building2 } from "lucide-react";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

type Status = "new" | "contacted" | "confirmed" | "cancelled";

interface Booking {
  _id: string; fullName: string; phone: string; email: string;
  branchSlug: string; branchName: string;
  eventType: string; eventDate: string; guestCount: string; message: string;
  status: Status; adminNote: string; createdAt: string;
}

const STATUS_CONFIG: Record<Status, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  new:       { label: "New",       badgeClass: "badge-pending",  icon: <Clock size={11} /> },
  contacted: { label: "Contacted", badgeClass: "badge-info",     icon: <PhoneCall size={11} /> },
  confirmed: { label: "Confirmed", badgeClass: "badge-active",   icon: <CheckCircle size={11} /> },
  cancelled: { label: "Cancelled", badgeClass: "badge-inactive", icon: <XCircle size={11} /> },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function BookingRow({ booking, onUpdate, onDelete, canEdit, canDelete }: {
  booking: Booking;
  onUpdate: (id: string, status: Status, note: string) => Promise<void>;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [status, setStatus] = useState<Status>(booking.status);
  const [note,   setNote]   = useState(booking.adminNote || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    await onUpdate(booking._id, status, note);
    setSaving(false);
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", cursor: "pointer", background: open ? "#fff7ed" : "#fff",
        borderBottom: open ? "1px solid #fed7aa" : "none" }}
        onClick={() => setOpen(v => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
          {/* Avatar */}
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f97316",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {booking.fullName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: "#111827" }}>
              {booking.fullName}
            </div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#9ca3af", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span><Phone size={10} style={{ display: "inline", marginRight: 3 }} />{booking.phone}</span>
              <span><Mail size={10} style={{ display: "inline", marginRight: 3 }} />{booking.email}</span>
              {booking.branchName && <span><Building2 size={10} style={{ display: "inline", marginRight: 3 }} />{booking.branchName}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span className={cfg.badgeClass} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="status-dot" /> {cfg.label}
          </span>
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#9ca3af" }}>
            {fmtDate(booking.createdAt)}
          </span>
          {open ? <ChevronUp size={15} style={{ color: "#9ca3af" }} /> : <ChevronDown size={15} style={{ color: "#9ca3af" }} />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Event details */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {booking.eventType && (
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>EVENT TYPE</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#111827", fontWeight: 500 }}>{booking.eventType}</div>
              </div>
            )}
            {booking.eventDate && (
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>EVENT DATE</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#111827", fontWeight: 500 }}>{booking.eventDate}</div>
              </div>
            )}
            {booking.guestCount && (
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>GUESTS</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#111827", fontWeight: 500 }}>{booking.guestCount}</div>
              </div>
            )}
          </div>

          {/* Message */}
          {booking.message && (
            <div style={{ background: "#fafafa", borderRadius: 8, padding: "12px 14px", borderLeft: "3px solid #f97316" }}>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>MESSAGE</div>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{booking.message}</p>
            </div>
          )}

          {/* Admin controls - only show if user has edit permission */}
          {canEdit && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
              <div className="field" style={{ margin: 0 }}>
                <label className="field-label">Status</label>
                <select className="inp-select" value={status} onChange={e => setStatus(e.target.value as Status)}
                  style={{ minWidth: 140 }}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 200, margin: 0 }}>
                <label className="field-label">Admin Note</label>
                <input className="inp" placeholder="e.g. Called, asked for more details…" value={note}
                  onChange={e => setNote(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
                <button className="btn-submit" onClick={save} disabled={saving} style={{ padding: "8px 18px" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <a href={`tel:${booking.phone}`} className="btn-outline" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                  <Phone size={13} /> Call
                </a>
                <a href={`mailto:${booking.email}`} className="btn-outline" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                  <Mail size={13} /> Email
                </a>
                {canDelete && (
                  <button className="btn-danger" onClick={() => onDelete(booking._id)} style={{ padding: "8px 12px" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Show existing admin note even if no edit permission */}
          {!canEdit && booking.adminNote && (
            <div style={{ paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>Admin Note</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#374151", background: "#f9fafb", padding: "10px 12px", borderRadius: 8 }}>
                {booking.adminNote}
              </div>
            </div>
          )}

          {/* Existing admin note display for edit mode */}
          {canEdit && booking.adminNote && booking.adminNote !== note && (
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
              Previous note: {booking.adminNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingsClient({ initialBookings, perms }: { initialBookings: Booking[]; perms?: Perms }) {
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.banquetBookings?.[action]);
  
  const canView = can("view");
  const canEdit = can("edit");
  const canDelete = can("delete");
  
  const [bookings,     setBookings]     = useState<Booking[]>(initialBookings);
  const [filter,       setFilter]       = useState<"all" | Status>("all");
  const [search,       setSearch]       = useState("");
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [toast,        setToast]        = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function handleUpdate(id: string, status: Status, adminNote: string) {
    if (!canEdit) return;
    const res  = await fetch("/api/banquet-bookings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminNote }),
    });
    const data = await res.json();
    if (data.booking) {
      setBookings(prev => prev.map(b => b._id === id ? { ...b, status: data.booking.status, adminNote: data.booking.adminNote } : b));
      showToast("Updated!");
    }
  }

  async function handleDelete(id: string) {
    if (!canDelete) return;
    await fetch("/api/banquet-bookings", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBookings(prev => prev.filter(b => b._id !== id));
    setDeleteId(null); showToast("Deleted!");
  }

  const filtered = bookings.filter(b => {
    if (filter !== "all" && b.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return b.fullName.toLowerCase().includes(q) || b.phone.includes(q) ||
        b.email.toLowerCase().includes(q) || b.branchName?.toLowerCase().includes(q) ||
        b.eventType?.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: bookings.length,
    new: bookings.filter(b => b.status === "new").length,
    contacted: bookings.filter(b => b.status === "contacted").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };

  // If user doesn't have view permission, show access denied
  if (!canView) {
    return (
      <div className="card" style={{ padding: 60, textAlign: "center" }}>
        <Building2 size={40} style={{ color: "#dc2626", margin: "0 auto 12px", display: "block" }} />
        <p style={{ fontFamily: "DM Sans, sans-serif", color: "#dc2626" }}>
          You don't have permission to view banquet bookings.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats - clickable only if user has permission to filter */}
      <div className="menu-stats" style={{ marginBottom: 20 }}>
        {[
          { key: "all",       label: "Total",     color: "#f97316" },
          { key: "new",       label: "New",        color: "#f59e0b" },
          { key: "contacted", label: "Contacted",  color: "#3b82f6" },
          { key: "confirmed", label: "Confirmed",  color: "#16a34a" },
          { key: "cancelled", label: "Cancelled",  color: "#9ca3af" },
        ].map(s => (
          <div key={s.key} className="menu-stat" style={{ cursor: "pointer", opacity: filter === s.key ? 1 : 0.6 }}
            onClick={() => setFilter(s.key as any)}>
            <span className="ms-value" style={{ color: s.color }}>{counts[s.key as keyof typeof counts]}</span>
            <span className="ms-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="inp" placeholder="Search by name, phone, email, branch…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "#9ca3af", fontSize: 14 }}>
            {search || filter !== "all" ? "No bookings match your filter." : "No banquet booking enquiries yet."}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(b => (
            <BookingRow 
              key={b._id} 
              booking={b} 
              onUpdate={handleUpdate} 
              onDelete={(id) => setDeleteId(id)}
              canEdit={canEdit}
              canDelete={canDelete} />
          ))}
        </div>
      )}

      {/* Delete confirm - only show if user has delete permission */}
      {deleteId && canDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: 28, maxWidth: 380, width: "90%", borderRadius: 14 }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete Booking?</h3>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
              This will permanently delete this booking enquiry.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-danger" style={{ padding: "8px 18px" }} onClick={() => handleDelete(deleteId)}>Delete</button>
              <button className="btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontFamily: "DM Sans, sans-serif", fontSize: 13,
          zIndex: 99999, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          {toast}
        </div>
      )}
    </div>
  );
}