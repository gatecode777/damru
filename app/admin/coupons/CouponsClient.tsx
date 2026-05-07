"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, X, Trash2, Save, Loader2,
  RefreshCw, Tag, CheckCircle, Clock, Zap,
} from "lucide-react";
import {
  createCoupon, updateCoupon, deleteCoupon,
  toggleCouponActive, generateCouponCode,
} from "@/app/actions/coupons";

interface Coupon {
  _id: string; code: string; description: string; type: string;
  value: number; maxDiscount: number | null; minOrderValue: number;
  usageLimit: number | null; usedCount: number; perUserLimit: number;
  startDate: string; expiryDate: string | null;
  isActive: boolean; createdAt: string;
}

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const isExpired   = (c: Coupon) => !!(c.expiryDate && new Date() > new Date(c.expiryDate));
const isExhausted = (c: Coupon) => !!(c.usageLimit !== null && c.usedCount >= c.usageLimit);

const emptyForm = {
  code: "", description: "", type: "percentage", value: "",
  maxDiscount: "", minOrderValue: "", usageLimit: "", perUserLimit: "1",
  startDate: "", expiryDate: "", isActive: true,
};

// ── Coupon Card ──────────────────────────────────────────────
function CouponCard({ coupon, onEdit, onDelete, onToggle, canEdit, canDelete }: {
  coupon: Coupon;
  onEdit: (c: Coupon) => void;
  onDelete: (c: Coupon) => void;
  onToggle: (c: Coupon) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const expired   = isExpired(coupon);
  const exhausted = isExhausted(coupon);
  const dim       = expired || exhausted || !coupon.isActive;

  const statusLabel = expired ? "Expired" : exhausted ? "Exhausted" : !coupon.isActive ? "Inactive" : "Active";
  const statusColor = expired || exhausted ? "#6b7280" : !coupon.isActive ? "#f59e0b" : "#16a34a";
  const statusBg    = expired || exhausted ? "#f3f4f6" : !coupon.isActive ? "#fffbeb" : "#f0fdf4";

  return (
    <div style={{
      border: `1.5px solid ${dim ? "#e5e7eb" : "#fed7aa"}`,
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      opacity: dim ? 0.7 : 1,
      background: "#fff",
      boxShadow: dim ? "none" : "0 2px 12px rgba(249,115,22,0.08)",
      transition: "all 0.15s",
      fontFamily: "DM Sans, sans-serif",
    }}>
      {/* Colored left strip */}
      <div style={{ width: 6, background: dim ? "#e5e7eb" : "#f97316", flexShrink: 0 }} />

      {/* Left: code + value */}
      <div style={{ padding: "16px 20px", flex: 1, minWidth: 0, borderRight: "1.5px dashed #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            background: coupon.type === "flat" ? "#eff6ff" : "#fff7ed",
            color: coupon.type === "flat" ? "#3b82f6" : "#f97316",
            border: `1px solid ${coupon.type === "flat" ? "#bfdbfe" : "#fed7aa"}`,
            borderRadius: 6, padding: "2px 8px",
            fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
          }}>
            {coupon.type === "flat" ? "₹ FLAT" : "% OFF"}
          </span>
          <span style={{
            background: statusBg, color: statusColor,
            borderRadius: 6, padding: "2px 8px",
            fontSize: "0.72rem", fontWeight: 600,
          }}>
            {statusLabel}
          </span>
        </div>

        <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "#111827", letterSpacing: "0.08em", margin: "0 0 4px", fontFamily: "DM Sans, sans-serif" }}>
          {coupon.code}
        </p>
        <p style={{ fontSize: "1rem", fontWeight: 700, color: "#f97316", margin: "0 0 4px" }}>
          {coupon.type === "flat"
            ? `₹${coupon.value} off`
            : `${coupon.value}% off${coupon.maxDiscount ? ` (max ₹${coupon.maxDiscount})` : ""}`}
        </p>
        {coupon.description && (
          <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coupon.description}
          </p>
        )}
      </div>

      {/* Right: meta */}
      <div style={{ padding: "16px 16px", minWidth: 160, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
        {[
          { label: "Min Order", value: coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : "None" },
          { label: "Usage", value: `${coupon.usedCount}${coupon.usageLimit ? `/${coupon.usageLimit}` : ""}` },
          { label: "Per user", value: String(coupon.perUserLimit) },
          { label: "Expires", value: fmtDate(coupon.expiryDate), red: expired },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{row.label}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: row.red ? "#dc2626" : "#374151" }}>{row.value}</span>
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
          {canEdit && (
            <button onClick={() => onEdit(coupon)} title="Edit"
              style={{ flex: 1, background: "#f3f4f6", border: "none", borderRadius: 7, padding: "6px", cursor: "pointer", color: "#374151", fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              Edit
            </button>
          )}
          {canEdit && (
            <button onClick={() => onToggle(coupon)} title={coupon.isActive ? "Deactivate" : "Activate"}
              style={{ flex: 1, background: coupon.isActive ? "#fffbeb" : "#f0fdf4", border: "none", borderRadius: 7, padding: "6px", cursor: "pointer", color: coupon.isActive ? "#f59e0b" : "#16a34a", fontSize: "0.78rem", fontWeight: 600 }}>
              {coupon.isActive ? "Pause" : "Activate"}
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(coupon)} title="Delete"
              style={{ background: "#fef2f2", border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}>
              <Trash2 size={13}/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Coupon Form Modal ────────────────────────────────────────
function CouponFormModal({ editCoupon, onClose, onSaved }: {
  editCoupon: Coupon | null;
  onClose: () => void;
  onSaved: (coupon: Coupon) => void;
}) {
  const isEdit = !!editCoupon;
  const [isPending, startTransition] = useTransition();
  const [error,     setError]     = useState("");
  const [genLoading,setGenLoading]= useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    ...(editCoupon ? {
      ...editCoupon,
      value:        String(editCoupon.value),
      maxDiscount:  editCoupon.maxDiscount != null ? String(editCoupon.maxDiscount) : "",
      minOrderValue:String(editCoupon.minOrderValue),
      usageLimit:   editCoupon.usageLimit  != null ? String(editCoupon.usageLimit)  : "",
      perUserLimit: String(editCoupon.perUserLimit),
      startDate:    editCoupon.startDate  ? new Date(editCoupon.startDate).toISOString().split("T")[0]  : "",
      expiryDate:   editCoupon.expiryDate ? new Date(editCoupon.expiryDate).toISOString().split("T")[0] : "",
    } : {}),
  });

  function set(k: string, v: string | boolean) { setForm(p => ({ ...p, [k]: v })); setError(""); }

  async function handleGenerate() {
    setGenLoading(true);
    const code = await generateCouponCode();
    set("code", code);
    setGenLoading(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.value) { setError("Discount value is required."); return; }
    if (form.type === "percentage" && Number(form.value) > 100) { setError("Percentage cannot exceed 100."); return; }

    const fd = new FormData(e.currentTarget);
    fd.set("type",       form.type);
    fd.set("isActive",   String(form.isActive));

    startTransition(async () => {
      const res = isEdit ? await updateCoupon(editCoupon._id, fd) : await createCoupon(fd);
      if (res?.error) { setError(res.error); return; }
      if ("coupon" in res && res.coupon) onSaved(res.coupon as Coupon);
      else onSaved({ ...editCoupon!, ...form } as unknown as Coupon);
    });
  }

  const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", fontFamily: "DM Sans, sans-serif", display: "block", marginBottom: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#111827", margin: 0 }}>
            {isEdit ? `Edit: ${editCoupon.code}` : "Create New Coupon"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}><X size={18}/></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: 24 }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: "0.84rem", fontFamily: "DM Sans,sans-serif" }}>⚠ {error}</div>}

          <form id="coupon-form" onSubmit={handleSubmit}>
            {/* Code */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Coupon Code</label>
                <input name="code" style={inp} value={form.code} onChange={e => set("code", e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20 (auto-generated if blank)" disabled={isEdit} />
              </div>
              {!isEdit && (
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button type="button" onClick={handleGenerate} disabled={genLoading}
                    style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {genLoading ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <RefreshCw size={12}/>}
                    Generate
                  </button>
                </div>
              )}
            </div>

            {/* Type toggle */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Discount Type *</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["percentage", "flat"] as const).map(t => (
                  <button key={t} type="button"
                    style={{ flex: 1, padding: "9px", border: "1.5px solid", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600,
                      borderColor: form.type === t ? "#f97316" : "#e5e7eb",
                      background:  form.type === t ? "#fff7ed"  : "#fff",
                      color:       form.type === t ? "#f97316"  : "#6b7280",
                    }}
                    onClick={() => set("type", t)}>
                    {t === "percentage" ? "% Percentage" : "₹ Flat Amount"}
                  </button>
                ))}
              </div>
            </div>

            {/* Value + Max */}
            <div style={{ display: "grid", gridTemplateColumns: form.type === "percentage" ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>{form.type === "flat" ? "Discount Amount (₹) *" : "Discount % *"}</label>
                <input name="value" type="number" style={inp} value={form.value} onChange={e => set("value", e.target.value)}
                  placeholder={form.type === "flat" ? "50" : "20"} min="0" max={form.type === "percentage" ? 100 : undefined} step="0.01" required />
              </div>
              {form.type === "percentage" && (
                <div>
                  <label style={lbl}>Max Discount Cap (₹)</label>
                  <input name="maxDiscount" type="number" style={inp} value={form.maxDiscount} onChange={e => set("maxDiscount", e.target.value)} placeholder="e.g. 200 (optional)" min="0" />
                </div>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Description</label>
              <input name="description" style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Get 20% off on orders above ₹500" />
            </div>

            {/* Min order + limits */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Min Order (₹)</label>
                <input name="minOrderValue" type="number" style={inp} value={form.minOrderValue} onChange={e => set("minOrderValue", e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <label style={lbl}>Total Usage Limit</label>
                <input name="usageLimit" type="number" style={inp} value={form.usageLimit} onChange={e => set("usageLimit", e.target.value)} placeholder="Unlimited" min="1" />
              </div>
              <div>
                <label style={lbl}>Per User Limit</label>
                <input name="perUserLimit" type="number" style={inp} value={form.perUserLimit} onChange={e => set("perUserLimit", e.target.value)} placeholder="1" min="1" />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Start Date</label>
                <input name="startDate" type="date" style={inp} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Expiry Date</label>
                <input name="expiryDate" type="date" style={inp} value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)} />
              </div>
            </div>

            {/* Active toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f9fafb", borderRadius: 10 }}>
              <div>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "#111827", margin: 0 }}>Active</p>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>Inactive coupons cannot be used</p>
              </div>
              <button type="button" onClick={() => set("isActive", !form.isActive)}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: form.isActive ? "#f97316" : "#e5e7eb", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: form.isActive ? 22 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "9px 18px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", cursor: "pointer", color: "#6b7280" }}>
            Cancel
          </button>
          <button form="coupon-form" type="submit" disabled={isPending}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {isPending ? <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Save size={14}/> {isEdit ? "Update" : "Create"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ───────────────────────────────────────────
function DeleteConfirm({ coupon, onClose, onDeleted }: {
  coupon: Coupon; onClose: () => void; onDeleted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteCoupon(coupon._id);
      onDeleted(coupon._id);
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "DM Sans,sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, background: "#fef2f2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Trash2 size={22} style={{ color: "#dc2626" }} />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#111827", margin: "0 0 6px" }}>Delete Coupon</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
            Delete <strong style={{ color: "#111827" }}>{coupon.code}</strong>? This cannot be undone.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "10px", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", color: "#6b7280" }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={isPending}
            style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {isPending ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Deleting…</> : <><Trash2 size={13}/> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main CouponsClient
// ════════════════════════════════════════════════════════════
export default function CouponsClient({ coupons: initialCoupons, perms }: { coupons: Coupon[]; perms?: Perms }) {
  const router = useRouter();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.coupons?.[action]);
  
  const [coupons,      setCoupons]      = useState<Coupon[]>(initialCoupons);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive">("all");
  const [showForm,     setShowForm]     = useState(false);
  const [editCoupon,   setEditCoupon]   = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const filtered = useMemo(() => {
    const now = new Date();
    return coupons.filter(c => {
      if (statusFilter === "active"   && (!c.isActive || isExpired(c) || isExhausted(c))) return false;
      if (statusFilter === "inactive" && c.isActive && !isExpired(c) && !isExhausted(c))  return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.code.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [coupons, statusFilter, search]);

  function handleSaved(saved: Coupon) {
    setCoupons(prev => {
      const exists = prev.find(c => c._id === saved._id);
      if (exists) return prev.map(c => c._id === saved._id ? { ...c, ...saved } : c);
      return [saved, ...prev];
    });
    setShowForm(false); setEditCoupon(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setCoupons(prev => prev.filter(c => c._id !== id));
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleToggle(coupon: Coupon) {
    if (!can("edit")) return;
    // Optimistic
    setCoupons(prev => prev.map(c => c._id === coupon._id ? { ...c, isActive: !c.isActive } : c));
    await toggleCouponActive(coupon._id, coupon.isActive);
  }

  function openCreate() { 
    if (!can("create")) return;
    setEditCoupon(null); 
    setShowForm(true); 
  }
  
  function openEdit(c: Coupon) { 
    if (!can("edit")) return;
    setEditCoupon(c); 
    setShowForm(true); 
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input className="search-inp" placeholder="Search by code or description…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}><X size={13}/></button>}
          </div>
          {/* Status tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all","active","inactive"] as const).map(k => (
              <button key={k} className={`cat-tab${statusFilter===k?" tab-active":""}`}
                onClick={() => setStatusFilter(k)}>
                {k.charAt(0).toUpperCase()+k.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          {can("create") && (
            <button className="btn-primary" onClick={openCreate}><Plus size={14}/> New Coupon</button>
          )}
        </div>
      </div>

      {/* Empty */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Tag size={40}/>
            <p>
              {search || statusFilter !== "all"
                ? "No coupons match your filters."
                : can("create") ? (
                  <>No coupons yet. <button onClick={openCreate} style={{ background:"none",border:"none",cursor:"pointer",color:"#f97316",fontWeight:600,fontSize:"inherit",padding:0 }}>Create the first one →</button></>
                ) : (
                  "No coupons available."
                )}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {filtered.map(coupon => (
            <CouponCard key={coupon._id} coupon={coupon}
              onEdit={openEdit} onDelete={setDeleteTarget} onToggle={handleToggle}
              canEdit={can("edit")} canDelete={can("delete")} />
          ))}
        </div>
      )}

      {showForm && (
        <CouponFormModal editCoupon={editCoupon} onClose={() => { setShowForm(false); setEditCoupon(null); }} onSaved={handleSaved} />
      )}
      {deleteTarget && can("delete") && (
        <DeleteConfirm coupon={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
      )}
    </>
  );
}