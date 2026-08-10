"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Calendar, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { getAdminResponseError } from "@/lib/admin-error";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }>; }

const SEGMENTS = [
  { value: "ALL_USERS", label: "All Users" },
  { value: "NEW_USERS", label: "New Users (last 30 days)" },
  { value: "ACTIVE_USERS", label: "Active Users" },
  { value: "INACTIVE_USERS", label: "Inactive Users" },
  { value: "DAMRU_USERS", label: "Users with Damru Balance" },
  { value: "LOYALTY_TIER", label: "Loyalty Tier" },
  { value: "SELECTED_USERS", label: "Selected Users" },
];

interface Campaign {
  _id: string; name: string; status: string; title: string; message: string;
  audience: { segment: string; loyaltyTierCode?: string };
  channels: string[]; scheduledAt?: string | null;
  estimatedRecipients: number; processedRecipients: number; sentCount: number; failedCount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f3f4f6", color: "#374151" },
  SCHEDULED: { bg: "#eff6ff", color: "#1e40af" },
  PROCESSING: { bg: "#fffbeb", color: "#92400e" },
  COMPLETED: { bg: "#f0fdf4", color: "#16a34a" },
  CANCELLED: { bg: "#fef2f2", color: "#dc2626" },
  FAILED: { bg: "#fef2f2", color: "#dc2626" },
};

const lbl: React.CSSProperties = { display: "block", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280", marginBottom: 4, fontFamily: "DM Sans, sans-serif" };
const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" };

const EMPTY_FORM = {
  name: "", title: "", message: "", segment: "ALL_USERS", loyaltyTierCode: "",
  channels: { IN_APP: true, EMAIL: false, PUSH: false },
  scheduleMode: "now" as "now" | "later", scheduledAt: "",
};

export default function CampaignsClient({ perms }: { perms: Perms }) {
  const toast = useToast();
  const canCreate = perms.isSuperAdmin || perms.permissions?.notifications?.create;
  const canEdit = perms.isSuperAdmin || perms.permissions?.notifications?.edit;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [estimatedRecipients, setEstimatedRecipients] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/notifications/campaigns");
    const d = await r.json();
    if (r.ok) setCampaigns(d.campaigns || []);
    setLoading(false);
  }, []);
  // Deferred via setTimeout so the initial fetch's setState calls never run
  // synchronously within the effect body itself (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (form.segment === "SELECTED_USERS" || (form.segment === "LOYALTY_TIER" && !form.loyaltyTierCode)) {
        setEstimatedRecipients(null);
        return;
      }
      setEstimating(true);
      const audience: Record<string, unknown> = { segment: form.segment };
      if (form.segment === "LOYALTY_TIER") audience.loyaltyTierCode = form.loyaltyTierCode;
      const r = await fetch("/api/admin/notifications/campaigns/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience }),
      });
      const d = await r.json();
      setEstimating(false);
      if (r.ok) setEstimatedRecipients(d.estimatedRecipients);
    }, 400);
    return () => clearTimeout(t);
  }, [form.segment, form.loyaltyTierCode]);

  async function createCampaign() {
    setError("");
    if (!form.name.trim() || !form.title.trim() || !form.message.trim()) { setError("Name, title, and message are required."); return; }
    const channels = Object.entries(form.channels).filter(([, v]) => v).map(([k]) => k);
    if (channels.length === 0) { setError("Select at least one channel."); return; }

    setSaving(true);
    const audience: Record<string, unknown> = { segment: form.segment };
    if (form.segment === "LOYALTY_TIER") audience.loyaltyTierCode = form.loyaltyTierCode;

    const r = await fetch("/api/admin/notifications/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, title: form.title, message: form.message, audience, channels,
        scheduledAt: form.scheduleMode === "later" && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { const message = await getAdminResponseError(r, "Could not create campaign."); setError(message); toast.error("Unable to create campaign", message); return; }
    setForm(EMPTY_FORM);
    setEstimatedRecipients(null);
    toast.success(form.scheduleMode === "later" ? "Campaign scheduled successfully" : "Campaign draft created");
    await load();
  }

  async function sendNow(id: string) {
    setConfirmSendId(null);
    const r = await fetch(`/api/admin/notifications/campaigns/${id}/send`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { const message = await getAdminResponseError(r, "Could not send campaign."); setError(message); toast.error("Unable to send campaign", message); }
    else toast.success(d.status === "COMPLETED" ? "Campaign sent successfully" : "Campaign queued for sending");
    await load();
  }

  async function cancel(id: string) {
    const r = await fetch(`/api/admin/notifications/campaigns/${id}/cancel`, { method: "POST" });
    if (r.ok) toast.success("Campaign cancelled");
    else toast.error("Unable to cancel campaign", await getAdminResponseError(r, "Please try again."));
    await load();
  }

  const draftBeingSent = campaigns.find(c => c._id === confirmSendId);

  return (
    <div>
      {canCreate && (
        <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 24, background: "#fff" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 14px", fontFamily: "DM Sans, sans-serif" }}>New Campaign</p>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: "0.8rem" }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Campaign Name</label>
              <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekend Dinner Offer" />
            </div>
            <div>
              <label style={lbl}>Audience</label>
              <select style={inp} value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {form.segment === "LOYALTY_TIER" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Tier Code (e.g. gold)</label>
              <input style={inp} value={form.loyaltyTierCode} onChange={e => setForm({ ...form, loyaltyTierCode: e.target.value })} placeholder="gold" />
            </div>
          )}

          <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: "0 0 12px" }}>
            {form.segment === "SELECTED_USERS" ? "Selected-user targeting isn't available in this composer yet — use the API directly." :
              estimating ? "Estimating audience…" : estimatedRecipients !== null ? `Estimated recipients: ${estimatedRecipients.toLocaleString("en-IN")}` : "—"}
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="🔥 Weekend Deal" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Message</label>
            <textarea style={{ ...inp, minHeight: 70 }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Get 20% off on selected items today." />
          </div>

          <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
            {(["IN_APP", "EMAIL", "PUSH"] as const).map(ch => (
              <label key={ch} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontFamily: "DM Sans, sans-serif", opacity: ch === "PUSH" ? 0.5 : 1 }}>
                <input type="checkbox" checked={form.channels[ch]} disabled={ch === "PUSH"} onChange={e => setForm({ ...form, channels: { ...form.channels, [ch]: e.target.checked } })} />
                {ch === "IN_APP" ? "In-App" : ch === "EMAIL" ? "Email" : "Push (not available yet)"}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 18, marginBottom: 16, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
              <input type="radio" checked={form.scheduleMode === "now"} onChange={() => setForm({ ...form, scheduleMode: "now" })} /> Send Now
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
              <input type="radio" checked={form.scheduleMode === "later"} onChange={() => setForm({ ...form, scheduleMode: "later" })} /> Schedule
            </label>
            {form.scheduleMode === "later" && (
              <input type="datetime-local" style={{ ...inp, width: 220 }} value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
            )}
            {form.scheduleMode === "later" && <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>Asia/Kolkata (server time)</span>}
          </div>

          <button onClick={createCampaign} disabled={saving} style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: "0.84rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : (form.scheduleMode === "later" ? <Calendar size={14} /> : <Send size={14} />)}
            {form.scheduleMode === "later" ? "Create & Schedule" : "Create Draft"}
          </button>
          <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "8px 0 0" }}>
            {form.scheduleMode === "now" ? "Creates as a draft — use \"Send Now\" below to actually dispatch it." : "Will be dispatched automatically by the scheduler at the scheduled time."}
          </p>
        </div>
      )}

      <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Campaign History</p>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: "0.84rem" }}>No campaigns yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {campaigns.map(c => (
            <div key={c._id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.86rem", margin: "0 0 4px" }}>{c.name}</p>
                <p style={{ fontSize: "0.76rem", color: "#6b7280", margin: 0 }}>
                  {c.audience.segment} · {c.channels.join(", ")} · {c.estimatedRecipients} est. recipients · {c.sentCount} sent{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.color }}>{c.status}</span>
                {canEdit && (c.status === "DRAFT" || c.status === "SCHEDULED") && (
                  <>
                    <button onClick={() => setConfirmSendId(c._id)} style={{ background: "none", border: "1px solid #16a34a", color: "#16a34a", borderRadius: 6, padding: "5px 10px", fontSize: "0.74rem", cursor: "pointer" }}>Send Now</button>
                    <button onClick={() => cancel(c._id)} style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 6, padding: "5px 10px", fontSize: "0.74rem", cursor: "pointer" }}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draftBeingSent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 22, maxWidth: 380, width: "90%" }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", margin: "0 0 10px" }}>Send &quot;{draftBeingSent.name}&quot; now?</p>
            <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 6px" }}>Audience: {draftBeingSent.estimatedRecipients.toLocaleString("en-IN")} users</p>
            <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 18px" }}>Channels: {draftBeingSent.channels.join(", ")}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmSendId(null)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}><X size={13} /> Cancel</button>
              <button onClick={() => sendNow(draftBeingSent._id)} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Confirm Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
