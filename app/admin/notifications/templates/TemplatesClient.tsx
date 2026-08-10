"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Eye } from "lucide-react";
import { useToast } from "@/components/admin/Toast";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }>; }

interface Template {
  _id: string; name: string; code: string; category: string;
  titleTemplate: string; messageTemplate: string; variables: string[];
  supportedChannels: string[]; isActive: boolean;
}

const CATEGORIES = ["PROMOTIONS", "CAMPAIGNS", "REWARDS", "ORDERS", "SYSTEM"];

const PREVIEW_SAMPLE: Record<string, string> = {
  firstName: "Riya", orderNumber: "DMR-1042", orderAmount: "₹549", damruAmount: "250",
  couponCode: "WEEKEND20", discount: "20%", expiryDate: "25 Aug 2026",
  missionName: "Monthly Shopper", achievementName: "Regular Shopper", loyaltyTier: "Gold", refundAmount: "₹300",
};

function preview(template: string): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name) => PREVIEW_SAMPLE[name] ?? `{{${name}}}`);
}

const lbl: React.CSSProperties = { display: "block", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280", marginBottom: 4, fontFamily: "DM Sans, sans-serif" };
const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };

const EMPTY_FORM = { name: "", code: "", category: "PROMOTIONS", titleTemplate: "", messageTemplate: "" };

export default function TemplatesClient({ perms }: { perms: Perms }) {
  const toast = useToast();
  const canCreate = perms.isSuperAdmin || perms.permissions?.notifications?.create;
  const canEdit = perms.isSuperAdmin || perms.permissions?.notifications?.edit;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/notifications/templates");
    const d = await r.json();
    if (r.ok) setTemplates(d.templates || []);
    setLoading(false);
  }, []);
  // Deferred via setTimeout so the initial fetch's setState calls never run
  // synchronously within the effect body itself (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function createTemplate() {
    setError("");
    if (!form.name.trim() || !form.code.trim() || !form.titleTemplate.trim() || !form.messageTemplate.trim()) {
      setError("Name, code, title, and message are required.");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/admin/notifications/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, supportedChannels: ["IN_APP", "EMAIL"] }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error || "Could not create template."); toast.error("Save failed", d.error || "Could not create template."); return; }
    setForm(EMPTY_FORM);
    toast.success("Template created");
    await load();
  }

  async function toggleActive(t: Template) {
    const r = await fetch(`/api/admin/notifications/templates/${t._id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (r.ok) toast.success(t.isActive ? "Template deactivated" : "Template activated");
    else toast.error("Update failed", "Could not update template.");
    await load();
  }

  return (
    <div>
      {canCreate && (
        <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 24, background: "#fff" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 14px", fontFamily: "DM Sans, sans-serif" }}>New Template</p>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: "0.8rem" }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Name</label>
              <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Weekend Offer" />
            </div>
            <div>
              <label style={lbl}>Code</label>
              <input style={inp} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="WEEKEND_OFFER" />
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Title Template</label>
            <input style={inp} value={form.titleTemplate} onChange={e => setForm({ ...form, titleTemplate: e.target.value })} placeholder="🍕 Weekend Offer" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Message Template — use {"{{variable}}"} for dynamic values</label>
            <textarea style={{ ...inp, minHeight: 60 }} value={form.messageTemplate} onChange={e => setForm({ ...form, messageTemplate: e.target.value })} placeholder="Flat {{discount}} OFF, order before {{expiryDate}}" />
          </div>

          {(form.titleTemplate || form.messageTemplate) && (
            <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} /> Preview (sample data, not a real customer)</p>
              <p style={{ fontWeight: 700, fontSize: "0.86rem", margin: "0 0 2px" }}>{preview(form.titleTemplate)}</p>
              <p style={{ fontSize: "0.82rem", color: "#374151", margin: 0 }}>{preview(form.messageTemplate)}</p>
            </div>
          )}

          <button onClick={createTemplate} disabled={saving} style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: "0.84rem", cursor: "pointer" }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : "Create Template"}
          </button>
        </div>
      )}

      <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Templates</p>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : templates.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: "0.84rem" }}>No templates yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {templates.map(t => (
            <div key={t._id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.86rem", margin: "0 0 2px" }}>{t.name} <span style={{ color: "#9ca3af", fontWeight: 400 }}>({t.code})</span></p>
                <p style={{ fontSize: "0.8rem", margin: "0 0 2px" }}>{preview(t.titleTemplate)}</p>
                <p style={{ fontSize: "0.76rem", color: "#6b7280", margin: 0 }}>{t.category} · {t.variables.length ? `Variables: ${t.variables.join(", ")}` : "No variables"}</p>
              </div>
              {canEdit && (
                <button onClick={() => toggleActive(t)} style={{ background: "none", border: `1px solid ${t.isActive ? "#dc2626" : "#16a34a"}`, color: t.isActive ? "#dc2626" : "#16a34a", borderRadius: 6, padding: "5px 10px", fontSize: "0.74rem", cursor: "pointer" }}>
                  {t.isActive ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
