"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, Trash2, ToggleLeft, ToggleRight, Shield, Crown, User, Eye } from "lucide-react";

interface Admin {
  _id: string; name: string; email: string;
  role: "super_admin" | "admin" | "moderator";
  isActive: boolean; permissions: any; createdAt: string;
}

const ROLE_CONFIG = {
  super_admin: { label: "Super Admin", icon: <Crown size={11} />, bg: "#fef3c7", color: "#92400e" },
  admin:       { label: "Admin",       icon: <Shield size={11} />, bg: "#eff6ff", color: "#1e40af" },
  moderator:   { label: "Moderator",   icon: <User size={11} />,   bg: "#f5f3ff", color: "#5b21b6" },
};

const MODULES = [
  "dashboard","users","orders","reservations","complaints",
  "categories","menu","blogs","blogCategories","gallery","branches","banquetBookings","coupons","analytics",
];

function permCount(admin: Admin) {
  if (admin.role === "super_admin") return `${MODULES.length}/${MODULES.length}`;
  const count = MODULES.filter(m => admin.permissions?.[m]?.view).length;
  return `${count}/${MODULES.length}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

export default function ManagersClient({ initialAdmins }: { initialAdmins: Admin[] }) {
  const router = useRouter();
  const [admins,    setAdmins]    = useState<Admin[]>(initialAdmins);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [toast,     setToast]     = useState("");
  const [viewAdmin, setViewAdmin] = useState<Admin | null>(null);
  const [search,    setSearch]    = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function toggleActive(a: Admin) {
    const res  = await fetch("/api/admin/managers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a._id, isActive: !a.isActive }),
    });
    const data = await res.json();
    if (data.admin) {
      setAdmins(prev => prev.map(x => x._id === a._id ? { ...x, isActive: data.admin.isActive } : x));
      showToast(data.admin.isActive ? "Admin activated!" : "Admin deactivated!");
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res  = await fetch("/api/admin/managers", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      setAdmins(prev => prev.filter(a => a._id !== id));
      setDeleteId(null); showToast("Admin deleted!");
    } else showToast(data.error || "Delete failed.");
    setDeleting(false);
  }

  const filtered = admins.filter(a =>
    !search.trim() ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total:     admins.length,
    active:    admins.filter(a => a.isActive).length,
    admins:    admins.filter(a => a.role === "admin").length,
    moderators:admins.filter(a => a.role === "moderator").length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="cat-stats" style={{ marginBottom: 20 }}>
        {[
          { label: "Total",      value: counts.total,      color: "#f97316" },
          { label: "Active",     value: counts.active,     color: "#16a34a" },
          { label: "Admins",     value: counts.admins,     color: "#3b82f6" },
          { label: "Moderators", value: counts.moderators, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="cat-stat">
            <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
            <span className="ms-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="inp" placeholder="Search by name or email…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Email</th>
              <th>Role</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:"center", padding:40, color:"#9ca3af", fontFamily:"DM Sans,sans-serif" }}>
                {search ? "No admins match your search." : "No admins yet."}
              </td></tr>
            ) : filtered.map(a => {
              const rc = ROLE_CONFIG[a.role] || ROLE_CONFIG.admin;
              return (
                <tr key={a._id}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#f97316,#ea580c)",
                        color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontFamily:"DM Sans,sans-serif", fontWeight:600, fontSize:14 }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#6b7280" }}>{a.email}</td>
                  <td>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px",
                      borderRadius:20, fontSize:11, fontWeight:700, background:rc.bg, color:rc.color }}>
                      {rc.icon} {rc.label}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => setViewAdmin(a)}
                      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px",
                        borderRadius:20, fontSize:11, fontWeight:600,
                        background:"#f3f4f6", color:"#374151", border:"none", cursor:"pointer" }}>
                      <Shield size={11} />
                      {a.role === "super_admin" ? "Full Access" : permCount(a)}
                    </button>
                  </td>
                  <td>
                    <span className={a.isActive ? "badge-active" : "badge-inactive"}>
                      <span className="status-dot" />{a.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#9ca3af" }}>{fmtDate(a.createdAt)}</td>
                  <td>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn-outline" onClick={() => setViewAdmin(a)} title="View permissions" style={{ padding:"5px 8px" }}>
                        <Eye size={13} />
                      </button>
                      {a.role !== "super_admin" && (
                        <>
                          <Link href={`/admin/managers/edit/${a._id}`} className="btn-edit" style={{ padding:"5px 8px" }}>
                            <Edit2 size={13} />
                          </Link>
                          <button className="btn-outline" onClick={() => toggleActive(a)} style={{ padding:"5px 8px" }} title={a.isActive ? "Deactivate" : "Activate"}>
                            {a.isActive
                              ? <ToggleRight size={15} style={{ color:"#16a34a" }} />
                              : <ToggleLeft size={15} style={{ color:"#9ca3af" }} />
                            }
                          </button>
                          <button className="btn-danger" onClick={() => setDeleteId(a._id)} style={{ padding:"5px 8px" }}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View permissions modal */}
      {viewAdmin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={() => setViewAdmin(null)}>
          <div className="card" style={{ maxWidth:680, width:"100%", maxHeight:"85vh", overflowY:"auto",
            borderRadius:16, padding:0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:16, margin:0 }}>Permissions — {viewAdmin.name}</h3>
                <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#9ca3af" }}>{viewAdmin.email}</span>
              </div>
              <button onClick={() => setViewAdmin(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}>✕</button>
            </div>
            <div style={{ padding:"20px 24px" }}>
              {viewAdmin.role === "super_admin" ? (
                <div style={{ textAlign:"center", padding:"24px 0" }}>
                  <Crown size={40} style={{ color:"#f59e0b", marginBottom:12 }} />
                  <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, color:"#374151" }}>Super Admin — has full access to all modules</p>
                </div>
              ) : (
                <PermTable permissions={viewAdmin.permissions} readonly />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="card" style={{ padding:28, maxWidth:380, width:"90%", borderRadius:14 }}>
            <h3 style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:16, marginBottom:8 }}>Delete Admin?</h3>
            <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, color:"#6b7280", marginBottom:20, lineHeight:1.6 }}>
              This will permanently delete this admin account.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn-danger" style={{ padding:"8px 18px" }} disabled={deleting}
                onClick={() => handleDelete(deleteId)}>
                <Trash2 size={13} /> {deleting ? "Deleting…" : "Delete"}
              </button>
              <button className="btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:"#111827", color:"#fff",
          padding:"12px 20px", borderRadius:10, fontFamily:"DM Sans,sans-serif", fontSize:13,
          zIndex:99999, boxShadow:"0 8px 24px rgba(0,0,0,0.3)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Read-only permission table for view modal ─────────────────────────────────
export function PermTable({ permissions, readonly }: { permissions: any; readonly?: boolean }) {
  const MODULE_LABELS: Record<string, string> = {
    dashboard:"Dashboard", users:"Users", orders:"Orders", reservations:"Reservations",
    complaints:"Complaints", categories:"Categories", menu:"Menu Items", blogs:"Blogs",
    blogCategories:"Blog Categories", gallery:"Gallery", branches:"Branches",
    banquetBookings:"Banquet Bookings", coupons:"Coupons", analytics:"Analytics",
  };
  const ACTIONS = ["view","create","edit","delete"];
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"DM Sans,sans-serif", fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:"2px solid #f3f4f6" }}>
            <th style={{ textAlign:"left", padding:"8px 12px", color:"#6b7280", fontWeight:600 }}>Module</th>
            {ACTIONS.map(a => (
              <th key={a} style={{ padding:"8px 12px", color:"#6b7280", fontWeight:600, textTransform:"capitalize", textAlign:"center" }}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(MODULE_LABELS).map(([key, label]) => {
            const p = permissions?.[key] || {};
            const hasAny = ACTIONS.some(a => p[a]);
            return (
              <tr key={key} style={{ borderBottom:"1px solid #f9fafb", background: hasAny ? "#fffbf5" : "transparent" }}>
                <td style={{ padding:"8px 12px", fontWeight: hasAny ? 600 : 400, color: hasAny ? "#111827" : "#9ca3af" }}>
                  {label}
                </td>
                {ACTIONS.map(a => (
                  <td key={a} style={{ padding:"8px 12px", textAlign:"center" }}>
                    {p[a]
                      ? <span style={{ color:"#16a34a", fontSize:16 }}>✓</span>
                      : <span style={{ color:"#e5e7eb", fontSize:14 }}>—</span>
                    }
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}