"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";
import { useToast } from "@/components/admin/Toast";

interface Branch {
  _id: string; name: string; slug: string; description: string;
  contact: string; timing: string; cardImage: string;
  hallCards: { title: string }[];
  isActive: boolean; sortOrder: number;
}

interface PermsData { role:string; isSuperAdmin:boolean; permissions:Record<string,any>; }
export default function BranchesClient({ initialBranches, perms }: { initialBranches: Branch[]; perms?: PermsData; }) {
  const router = useRouter();
  const sharedToast = useToast();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.["branches"]?.[action]);
  const [branches, setBranches]       = useState<Branch[]>(initialBranches);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);

  function showToast(msg: string) { if (/fail/i.test(msg)) sharedToast.error("Unable to update branch"); else sharedToast.success(msg.replace(/!$/, "")); }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch("/api/admin/branches", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setBranches(prev => prev.filter(b => b._id !== id));
      setDeleteId(null); showToast("Branch deleted!");
    } catch { showToast("Delete failed."); }
    finally { setDeleting(false); }
  }

  async function toggleActive(b: Branch) {
    const res  = await fetch("/api/admin/branches", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b._id, isActive: !b.isActive }),
    });
    const data = await res.json();
    if (data.branch) {
      setBranches(prev => prev.map(x => x._id === b._id ? { ...x, isActive: data.branch.isActive } : x));
      showToast(data.branch.isActive ? "Branch activated!" : "Branch deactivated!");
    }
  }

  return (
    <div>
      {/* Stats row */}
      <div className="menu-stats" style={{ marginBottom: 20 }}>
        {[
          { label: "Total",      value: branches.length,                          color: "#f97316" },
          { label: "Active",     value: branches.filter(b => b.isActive).length,  color: "#16a34a" },
          { label: "Inactive",   value: branches.filter(b => !b.isActive).length, color: "#9ca3af" },
          { label: "Hall Cards", value: branches.reduce((s, b) => s + (b.hallCards?.length || 0), 0), color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="menu-stat">
            <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
            <span className="ms-label">{s.label}</span>
          </div>
        ))}
        {can("create") && (
          <Link href="/admin/branches/new" className="btn-primary" style={{ marginLeft: "auto", alignSelf: "center" }}>
            <Plus size={14} /> Add Branch
          </Link>
        )}
      </div>

      {/* Empty state */}
      {branches.length === 0 ? (
        <div className="card" style={{ padding: 52, textAlign: "center" }}>
          <MapPin size={38} style={{ color: "#d1d5db", marginBottom: 12 }} />
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "#9ca3af", fontSize: 14, marginBottom: 16 }}>
            No branches yet. Add your first branch location.
          </p>
          {can("create") && (
            <Link href="/admin/branches/new" className="btn-primary" style={{ display: "inline-flex" }}>
              <Plus size={14} /> Add Branch
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {branches.map(b => (
            <div key={b._id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Image */}
              {b.cardImage
                ? <img src={`/uploads/branches/${b.cardImage}`} alt={b.name}
                    style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                : <div style={{ width: "100%", height: 100,
                    background: "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MapPin size={30} style={{ color: "#f97316" }} />
                  </div>
              }
              {/* Info */}
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14,
                    color: "#111827", flex: 1, paddingRight: 10, lineHeight: 1.4 }}>
                    {b.name}
                  </span>
                  <span className={b.isActive ? "badge-active" : "badge-inactive"} style={{ flexShrink: 0 }}>
                    <span className="status-dot" />
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {b.description && (
                  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#6b7280",
                    marginBottom: 10, lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {b.description}
                  </p>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14,
                  fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#9ca3af" }}>
                  <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>/{b.slug}</span>
                  <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>
                    {b.hallCards?.length || 0} hall card{(b.hallCards?.length || 0) !== 1 ? "s" : ""}
                  </span>
                  {b.timing && <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>{b.timing}</span>}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {can("edit") && (
                  <Link href={`/admin/branches/edit/${b._id}`} className="btn-edit"
                    style={{ flex: 1, justifyContent: "center" }}>
                    <Edit2 size={12} /> Edit
                  </Link>
                  )}
                  <a href={`/branches/${b.slug}`} target="_blank" rel="noreferrer" className="btn-outline"
                    style={{ padding: "5px 10px" }} title="Preview on website">
                    <ExternalLink size={13} />
                  </a>
                  {can("edit") && <button className="btn-outline" onClick={() => toggleActive(b)}
                    style={{ padding: "5px 10px" }} title={b.isActive ? "Deactivate" : "Activate"}>
                    {b.isActive
                      ? <ToggleRight size={15} style={{ color: "#16a34a" }} />
                      : <ToggleLeft size={15} style={{ color: "#9ca3af" }} />
                    }
                  </button>}
                  {can("delete") && (
                  <button className="btn-danger" onClick={() => setDeleteId(b._id)} style={{ padding: "5px 10px" }}>
                    <Trash2 size={13} />
                  </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: 28, maxWidth: 400, width: "90%", borderRadius: 14 }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete Branch?</h3>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: "#6b7280", marginBottom: 22, lineHeight: 1.6 }}>
              This will permanently delete this branch and all its hall cards and content. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-danger" onClick={() => handleDelete(deleteId)} disabled={deleting}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px" }}>
                <Trash2 size={13} />{deleting ? "Deleting…" : "Delete"}
              </button>
              <button className="btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
