"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ArrowLeft, Eye, EyeOff, Shield, User } from "lucide-react";

const MODULES = [
  { key:"dashboard",      label:"Dashboard",        group:"Main" },
  { key:"users",          label:"Users",            group:"Main" },
  { key:"orders",         label:"Orders",           group:"Main" },
  { key:"reservations",   label:"Reservations",     group:"Main" },
  { key:"complaints",     label:"Complaints",       group:"Main" },
  { key:"categories",     label:"Categories",       group:"Restaurant" },
  { key:"menu",           label:"Menu Items",       group:"Restaurant" },
  { key:"blogs",          label:"Blogs",            group:"Restaurant" },
  { key:"blogCategories", label:"Blog Categories",  group:"Restaurant" },
  { key:"gallery",        label:"Gallery",          group:"Restaurant" },
  { key:"branches",       label:"Branches",         group:"Restaurant" },
  { key:"banquetBookings",label:"Banquet Bookings", group:"Restaurant" },
  { key:"coupons",        label:"Coupons",          group:"Restaurant" },
  { key:"rewards",        label:"Rewards & Loyalty",group:"Restaurant" },
  { key:"tables",         label:"Tables & QR",      group:"Restaurant" },
  { key:"analytics",      label:"Analytics",        group:"System" },
  // { key:"settings",       label:"Settings",         group:"System" },
];

const ACTIONS = ["view","create","edit","delete"] as const;
type Action = typeof ACTIONS[number];

function emptyPermissions() {
  return Object.fromEntries(
    MODULES.map(m => [m.key, { view: false, create: false, edit: false, delete: false }])
  );
}

// ── Permission Matrix ─────────────────────────────────────────────────────────
function PermissionMatrix({ permissions, onChange }: {
  permissions: Record<string, Record<Action, boolean>>;
  onChange: (p: Record<string, Record<Action, boolean>>) => void;
}) {
  function toggle(moduleKey: string, action: Action) {
    const cur = permissions[moduleKey] || { view:false, create:false, edit:false, delete:false };
    const next = { ...cur, [action]: !cur[action] };
    if (action !== "view" && next[action]) next.view = true;
    if (action === "view" && !next.view) {
      next.create = false; next.edit = false; next.delete = false;
    }
    onChange({ ...permissions, [moduleKey]: next });
  }

  function toggleAll(moduleKey: string) {
    const cur = permissions[moduleKey] || { view:false, create:false, edit:false, delete:false };
    const allOn = ACTIONS.every(a => cur[a]);
    onChange({ ...permissions, [moduleKey]: { view:!allOn, create:!allOn, edit:!allOn, delete:!allOn } });
  }

  function toggleColumn(action: Action) {
    const allOn = MODULES.every(m => permissions[m.key]?.[action]);
    const next = { ...permissions };
    MODULES.forEach(m => {
      next[m.key] = { ...(next[m.key] || { view:false, create:false, edit:false, delete:false }), [action]: !allOn };
      if (!allOn && action !== "view") next[m.key].view = true;
    });
    onChange(next);
  }

  const groups = [...new Set(MODULES.map(m => m.group))];

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontFamily:"DM Sans,sans-serif", fontSize:13 }}>
        <thead>
          <tr>
            <th style={{ textAlign:"left", padding:"10px 14px", background:"#f9fafb", borderBottom:"2px solid #f3f4f6",
              borderRadius:"8px 0 0 0", color:"#374151", fontWeight:600, minWidth:160 }}>Module</th>
            {ACTIONS.map(a => (
              <th key={a} style={{ padding:"10px 8px", background:"#f9fafb", borderBottom:"2px solid #f3f4f6",
                textAlign:"center", color:"#374151", fontWeight:600 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ textTransform:"capitalize" }}>{a}</span>
                  <button type="button" onClick={() => toggleColumn(a)}
                    style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                      background: MODULES.every(m => permissions[m.key]?.[a]) ? "#f97316" : "#e5e7eb",
                      color: MODULES.every(m => permissions[m.key]?.[a]) ? "#fff" : "#6b7280",
                      border:"none", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>
                    {MODULES.every(m => permissions[m.key]?.[a]) ? "All On" : "All"}
                  </button>
                </div>
              </th>
            ))}
            <th style={{ padding:"10px 8px", background:"#f9fafb", borderBottom:"2px solid #f3f4f6",
              textAlign:"center", borderRadius:"0 8px 0 0", color:"#374151", fontWeight:600 }}>All</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            // ✅ React.Fragment with key — the only way to key a fragment wrapping multiple <tr>s
            <React.Fragment key={group}>
              <tr>
                <td colSpan={6} style={{ padding:"8px 14px 4px", background:"#fafafa",
                  fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700,
                  color:"#9ca3af", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  {group}
                </td>
              </tr>
              {MODULES.filter(m => m.group === group).map(mod => {
                const p = permissions[mod.key] || { view:false, create:false, edit:false, delete:false };
                const allOn = ACTIONS.every(a => p[a]);
                const anyOn = ACTIONS.some(a => p[a]);
                return (
                  <tr key={mod.key} style={{ background: anyOn ? "#fffbf5" : "#fff",
                    borderBottom:"1px solid #f3f4f6", transition:"background 0.15s" }}>
                    <td style={{ padding:"10px 14px", fontWeight: anyOn ? 600 : 400,
                      color: anyOn ? "#111827" : "#6b7280", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:6, height:6, borderRadius:"50%",
                        background: anyOn ? "#f97316" : "#e5e7eb", flexShrink:0 }} />
                      {mod.label}
                    </td>
                    {ACTIONS.map(action => (
                      <td key={action} style={{ padding:"10px 8px", textAlign:"center" }}>
                        <label style={{ cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                          <input type="checkbox" checked={Boolean(p[action])}
                            onChange={() => toggle(mod.key, action)}
                            style={{ display:"none" }} />
                          <span style={{
                            width:20, height:20, borderRadius:5,
                            border:`2px solid ${p[action] ? "#f97316" : "#e5e7eb"}`,
                            background: p[action] ? "#f97316" : "#fff",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            transition:"all 0.15s", cursor:"pointer",
                          }}>
                            {p[action] && <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>✓</span>}
                          </span>
                        </label>
                      </td>
                    ))}
                    <td style={{ padding:"10px 8px", textAlign:"center" }}>
                      <button type="button" onClick={() => toggleAll(mod.key)}
                        style={{ fontSize:11, padding:"3px 10px", borderRadius:12,
                          background: allOn ? "#fef3c7" : "#f3f4f6",
                          color: allOn ? "#92400e" : "#6b7280",
                          border:"none", cursor:"pointer", fontWeight:600, fontFamily:"DM Sans,sans-serif",
                          whiteSpace:"nowrap" }}>
                        {allOn ? "None" : "All"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
interface Props {
  initial?: {
    _id: string; name: string; email: string;
    role: string; isActive: boolean; permissions: any;
    isSuperAdmin?: boolean;
  };
}

export default function ManagerForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial?._id;

  const [form, setForm] = useState({
    name:        initial?.name     || "",
    email:       initial?.email    || "",
    password:    "",
    role:        initial?.role     || "admin",
    isActive:    initial?.isActive ?? true,
    isSuperAdmin: initial?.isSuperAdmin ?? false,
    permissions: initial?.permissions || emptyPermissions(),
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function upd(k: string, v: any) { setForm(p => ({ ...p, [k]: v })); }

  function applyPreset(preset: "full" | "readonly" | "none") {
    const p = { ...form.permissions };
    MODULES.forEach(m => {
      if (preset === "full")     p[m.key] = { view:true,  create:true,  edit:true,  delete:true  };
      if (preset === "readonly") p[m.key] = { view:true,  create:false, edit:false, delete:false };
      if (preset === "none")     p[m.key] = { view:false, create:false, edit:false, delete:false };
    });
    upd("permissions", p);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Please enter a valid email address."); return; }
    if (!isEdit && form.password.length < 8)      { setError("Password must be at least 8 characters."); return; }
    if (isEdit && form.password && form.password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setSaving(true); setError("");
    try {
      const body: any = {
        name: form.name.trim(), email: form.email.trim(),
        role: form.role, permissions: form.permissions, isActive: form.isActive,
        isSuperAdmin: form.isSuperAdmin,
      };
      if (isEdit) body.id = initial!._id;
      if (form.password) body.password = form.password;

      const res  = await fetch("/api/admin/managers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      router.push("/admin/managers");
      router.refresh();
    } catch { setError("Server error. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="form-layout">
      <main className="form-main" style={{ maxWidth: 900 }}>

        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/admin/managers" style={{ display:"flex", alignItems:"center", gap:5,
            color:"#6b7280", textDecoration:"none", fontFamily:"DM Sans,sans-serif", fontSize:13 }}>
            <ArrowLeft size={13} /> Admin Managers
          </Link>
          <span style={{ color:"#d1d5db" }}>/</span>
          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#111827", fontWeight:500 }}>
            {isEdit ? form.name : "New Admin"}
          </span>
        </div>

        {/* Page header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
          <div>
            <h1 style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:"1.4rem", color:"#111827", margin:"0 0 4px" }}>
              {isEdit ? `Edit: ${initial!.name}` : "New Admin Manager"}
            </h1>
            <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#6b7280", margin:0 }}>
              {isEdit ? `Editing ${initial!.email}` : "Create a new sub-admin with custom module permissions"}
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <Link href="/admin/managers" className="btn-cancel">Cancel</Link>
            <button className="btn-submit" onClick={handleSave} disabled={saving}
              style={{ display:"flex", alignItems:"center", gap:6 }}>
              <Save size={14} />{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Admin"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c",
            padding:"10px 16px", borderRadius:8, fontFamily:"DM Sans,sans-serif", fontSize:13,
            display:"flex", alignItems:"center", gap:8 }}>
            ⚠ {error}
          </div>
        )}

        {/* Account Details */}
        <div className="form-card">
          <div className="form-card-header"><span className="form-card-title">Account Details</span></div>
          <div className="form-card-body">
            <div className="field-row">
              <div className="field">
                <label className="field-label">Full Name *</label>
                <input className="inp" value={form.name} placeholder="John Doe"
                  onChange={e => upd("name", e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Email Address *</label>
                <input className="inp" type="email" value={form.email} placeholder="admin@example.com"
                  onChange={e => upd("email", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">
                  {isEdit ? "New Password (leave blank to keep)" : "Password *"}
                </label>
                <div style={{ position:"relative" }}>
                  <input className="inp" type={showPw ? "text" : "password"} value={form.password}
                    placeholder={isEdit ? "Leave blank to keep current" : "Min 8 characters"}
                    onChange={e => upd("password", e.target.value)}
                    style={{ paddingRight:40 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                      background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Role</label>
                <select className="inp-select" value={form.role} onChange={e => upd("role", e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>
            </div>
            <div className="toggle-wrap">
              <input type="checkbox" id="isActiveAdmin" checked={form.isActive}
                onChange={e => upd("isActive", e.target.checked)}
                style={{ width:16, height:16, accentColor:"#f97316", cursor:"pointer" }} />
              <label htmlFor="isActiveAdmin" className="toggle-label" style={{ cursor:"pointer" }}>
                Account Active — this admin can log in
              </label>
            </div>
          </div>
        </div>

        {/* Role selector */}
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-title">Role &amp; Access Level</span>
          </div>
          <div className="form-card-body">
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[
                { value:"admin",     label:"Admin",     icon:<Shield size={16} />, color:"#1e40af", bg:"#eff6ff", desc:"Can access modules permitted below" },
                { value:"moderator", label:"Moderator", icon:<User size={16} />,   color:"#5b21b6", bg:"#f5f3ff", desc:"Limited access, typically read-only" },
              ].map(r => (
                <label key={r.value} style={{ flex:1, minWidth:200, cursor:"pointer" }}>
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                    onChange={() => upd("role", r.value)} style={{ display:"none" }} />
                  <div style={{ padding:"14px 16px", borderRadius:10, cursor:"pointer",
                    border: form.role === r.value ? `2px solid ${r.color}` : "2px solid #e5e7eb",
                    background: form.role === r.value ? r.bg : "#fff", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4,
                      color: form.role === r.value ? r.color : "#6b7280",
                      fontFamily:"Syne,sans-serif", fontWeight:700 }}>
                      {r.icon} {r.label}
                    </div>
                    <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#6b7280", margin:0 }}>
                      {r.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {form.role === "admin" && (
              <div className="toggle-wrap" style={{ marginTop: 14 }}>
                <input type="checkbox" id="isSuperAdminAdmin" checked={form.isSuperAdmin}
                  onChange={e => upd("isSuperAdmin", e.target.checked)}
                  style={{ width:16, height:16, accentColor:"#f97316", cursor:"pointer" }} />
                <label htmlFor="isSuperAdminAdmin" className="toggle-label" style={{ cursor:"pointer" }}>
                  Full Access — bypass the module permissions below (equivalent to Super Admin). Leave off to enforce the permission matrix for this Admin.
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="form-card">
          <div className="form-card-header">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%" }}>
              <span className="form-card-title">Module Permissions</span>
              <div style={{ display:"flex", gap:8 }}>
                {([
                  { label:"Full Access", action:"full"     as const, bg:"#f97316", color:"#fff" },
                  { label:"Read Only",   action:"readonly" as const, bg:"#3b82f6", color:"#fff" },
                  { label:"No Access",   action:"none"     as const, bg:"#f3f4f6", color:"#6b7280" },
                ] as const).map(p => (
                  <button key={p.action} type="button" onClick={() => applyPreset(p.action)}
                    style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer",
                      fontFamily:"DM Sans,sans-serif", fontSize:11, fontWeight:600,
                      background:p.bg, color:p.color }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-card-body">
            <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#9ca3af", marginBottom:16 }}>
              Enabling Create, Edit or Delete automatically enables View. Disabling View removes all access to that module.
            </p>
            <PermissionMatrix
              permissions={form.permissions}
              onChange={p => upd("permissions", p)}
            />
          </div>
        </div>

        {/* Bottom save */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingBottom:40 }}>
          <Link href="/admin/managers" className="btn-cancel">Cancel</Link>
          <button className="btn-submit" onClick={handleSave} disabled={saving}
            style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Save size={14} />{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Admin"}
          </button>
        </div>

      </main>
    </div>
  );
}