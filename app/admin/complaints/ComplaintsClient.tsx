"use client";

import React, { useState, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MessageSquareWarning, Trash2, Loader2, ChevronDown, Save } from "lucide-react";
import type { ComplaintRow } from "./page";

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  open:        { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", dot: "#dc2626" },
  in_progress: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  resolved:    { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#16a34a" },
  closed:      { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb", dot: "#9ca3af" },
};

const ISSUE_COLORS: Record<string, string> = {
  "Order Issue":   "#3b82f6",
  "Payment Issue": "#8b5cf6",
  "Delivery Issue":"#06b6d4",
  "Wrong Items":   "#f59e0b",
  "Missing Items": "#f97316",
  "Account Issue": "#ec4899",
  "Other":         "#6b7280",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Fixed-position status dropdown ───────────────────────────
function StatusDropdown({ complaint, onUpdated }: { complaint: ComplaintRow; onUpdated: (id: string, patch: Partial<ComplaintRow>) => void }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const [isPending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  function openDrop() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  }

  function change(status: string) {
    if (status === complaint.status) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      const res = await fetch(`/api/complaints/${complaint._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onUpdated(complaint._id, { status });
    });
  }

  const s = STATUS_STYLE[complaint.status] ?? STATUS_STYLE.open;
  const label = complaint.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <>
      <button ref={btnRef} onClick={openDrop} disabled={isPending}
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 8, padding: "5px 10px", fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
        {isPending ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />}
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9997 }} onClick={() => setOpen(false)} />
          <div style={{ position: "fixed", top: pos.top, left: pos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 9998, minWidth: 160, overflow: "hidden" }}>
            {(["open","in_progress","resolved","closed"] as const).map(st => {
              const ss = STATUS_STYLE[st];
              return (
                <button key={st} onClick={() => change(st)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: complaint.status === st ? "#fff7ed" : "#fff", border: "none", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: complaint.status === st ? "#f97316" : "#374151", fontWeight: complaint.status === st ? 600 : 400, textAlign: "left" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                  {st.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                  {complaint.status === st && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ── Expanded detail panel ─────────────────────────────────────
function DetailPanel({ complaint, onUpdated }: { complaint: ComplaintRow; onUpdated: (id: string, patch: Partial<ComplaintRow>) => void }) {
  const [note,     setNote]     = useState(complaint.adminNote || "");
  const [saving,   setSaving]   = useState(false);
  const [isPending,startTransition] = useTransition();

  async function saveNote() {
    setSaving(true);
    const res = await fetch(`/api/complaints/${complaint._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: note }),
    });
    setSaving(false);
    if (res.ok) onUpdated(complaint._id, { adminNote: note });
  }

  const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box", background: "#fff", resize: "vertical" };
  const lbl: React.CSSProperties = { fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0, border: "none" }}>
        <div style={{ padding: "16px 20px 20px", background: "#fafafa", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Left — complaint details */}
          <div>
            <span style={lbl}>Full Description</span>
            <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 10, padding: "12px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {complaint.description}
            </div>

            {complaint.attachment && (
              <div style={{ marginTop: 10 }}>
                <span style={lbl}>Attachment</span>
                <a href={`/uploads/complaints/${complaint.attachment}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#f97316", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  📎 {complaint.attachment}
                </a>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <span style={lbl}>User</span>
              <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: "0 0 2px" }}>{complaint.userName}</p>
              <a href={`mailto:${complaint.userEmail}`} style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#f97316", textDecoration: "none" }}>{complaint.userEmail}</a>
            </div>

            <div style={{ marginTop: 10 }}>
              <span style={lbl}>Submitted</span>
              <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: 0 }}>{fmtDate(complaint.createdAt)}</p>
            </div>
          </div>

          {/* Right — admin note */}
          <div>
            <span style={lbl}>Admin Note / Response</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={5}
              placeholder="Write a response or internal note here…"
              style={inp}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={saveNote} disabled={saving}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {saving ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Save size={13}/> Save Note</>}
              </button>
            </div>
            {complaint.adminNote && note === complaint.adminNote && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#15803d", margin: "0 0 4px" }}>SAVED NOTE</p>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>{complaint.adminNote}</p>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════════
// Main ComplaintsClient
// ════════════════════════════════════════════════════════════
export default function ComplaintsClient({ complaints: initial }: { complaints: ComplaintRow[] }) {
  const router = useRouter();
  const [complaints,  setComplaints]  = useState<ComplaintRow[]>(initial);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("all");
  const [typeFilter,  setTypeFilter]  = useState("all");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const issueTypes = ["Order Issue","Payment Issue","Delivery Issue","Wrong Items","Missing Items","Account Issue","Other"];

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter   !== "all" && c.issueType !== typeFilter)  return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.userName.toLowerCase().includes(q) &&
            !c.userEmail.toLowerCase().includes(q) &&
            !c.subject.toLowerCase().includes(q) &&
            !c.issueType.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [complaints, search, statusFilter, typeFilter]);

  function handleUpdated(id: string, patch: Partial<ComplaintRow>) {
    setComplaints(prev => prev.map(c => c._id === id ? { ...c, ...patch } : c));
    router.refresh();
  }

  async function handleDelete(id: string, subject: string) {
    if (!confirm(`Delete complaint "${subject}"? This cannot be undone.`)) return;
    setDeletingId(id);
    await fetch(`/api/complaints/${id}`, { method: "DELETE" });
    setComplaints(prev => prev.filter(c => c._id !== id));
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
            <input className="search-inp" placeholder="Search by name, email, subject…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}><X size={13}/></button>}
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {["all","open","in_progress","resolved","closed"].map(k => (
              <button key={k} className={`cat-tab${statusFilter===k?" tab-active":""}`}
                onClick={() => setStatusFilter(k)}
                style={{ whiteSpace: "nowrap" }}>
                {k === "all" ? "All" : k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Issue type filter */}
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {issueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "60px 20px" }}>
            <MessageSquareWarning size={40} />
            <p>{search || statusFilter !== "all" || typeFilter !== "all"
              ? "No complaints match your filters."
              : "No complaints yet."}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Issue Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isExpanded = expandedId === c._id;
                  const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.open;
                  const typeColor = ISSUE_COLORS[c.issueType] ?? "#6b7280";
                  return (
                    <React.Fragment key={c._id}>
                      <tr style={{ cursor: "pointer", background: isExpanded ? "#fff7ed" : undefined }}
                        onClick={() => setExpandedId(isExpanded ? null : c._id)}>
                        <td>
                          <div style={{ fontFamily: "DM Sans,sans-serif" }}>
                            <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", margin: 0 }}>{c.userName}</p>
                            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{c.userEmail}</p>
                          </div>
                        </td>
                        <td>
                          <span style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30`, borderRadius: 6, padding: "3px 9px", fontSize: "0.75rem", fontWeight: 600, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>
                            {c.issueType}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontFamily: "DM Sans,sans-serif" }}>
                            <p style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111827", margin: 0 }}>{c.subject}</p>
                            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{c.description}</p>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <StatusDropdown complaint={c} onUpdated={handleUpdated} />
                        </td>
                        <td>
                          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#6b7280" }}>
                            {fmtDate(c.createdAt)}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {c.adminNote && (
                              <span title="Has admin note" style={{ fontSize: "0.75rem", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 7px", fontFamily: "DM Sans,sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>
                                Noted
                              </span>
                            )}
                            <button onClick={() => handleDelete(c._id, c.subject)} disabled={deletingId === c._id}
                              style={{ background: "#fef2f2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}>
                              {deletingId === c._id
                                ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                                : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && <DetailPanel key={`${c._id}-detail`} complaint={c} onUpdated={handleUpdated} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#9ca3af", textAlign: "right" }}>
        Showing {filtered.length} of {complaints.length} complaints
      </p>
    </>
  );
}