"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Globe, Mail, Bell, ShoppingBag, Wrench, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { getAdminResponseError } from "@/lib/admin-error";

type Settings = {
  siteName: string; siteUrl: string; supportEmail: string; tagline: string;
  phone: string; address: string; currency: string; timezone: string;
  smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string;
  smtpSecure: boolean; smtpFromName: string;
  notifyNewUser: boolean; notifyNewOrder: boolean;
  notifyReservation: boolean; notifyComplaint: boolean;
  taxRate: number; freeDeliveryAbove: number; deliveryCharge: number;
  maintenanceMode: boolean; maintenanceMsg: string;
};

const DEFAULT: Settings = {
  siteName: "Damru By Namo", siteUrl: "https://damrurestro.com",
  supportEmail: "info@damrurestro.com", tagline: "Banquet | Restaurant",
  phone: "", address: "", currency: "INR", timezone: "Asia/Kolkata",
  smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: "", smtpPass: "",
  smtpSecure: false, smtpFromName: "Damru By Namo",
  notifyNewUser: true, notifyNewOrder: true, notifyReservation: true, notifyComplaint: true,
  taxRate: 5, freeDeliveryAbove: 500, deliveryCharge: 50,
  maintenanceMode: false, maintenanceMsg: "We'll be back soon!",
};

const TABS = [
  { id: "general", label: "General", icon: Globe },
  { id: "email", label: "Email / SMTP", icon: Mail },
  // { id:"notifications", label:"Notifications", icon:Bell },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      style={{ width: 42, height: 22, background: value ? "#f97316" : "#e5e7eb", border: "none", borderRadius: 11, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: value ? 22 : 2, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="sf-row">
      <div className="sf-left"><p className="sf-label">{label}</p>{hint && <p className="sf-hint">{hint}</p>}</div>
      <div className="sf-right">{children}</div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sf-sec">
      <p className="sf-sec-title">{title}</p>
      <div className="sf-sec-body">{children}</div>
    </div>
  );
}

function Inp({ value, onChange, type = "text", placeholder }: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="sf-inp" />;
}

export default function SettingsClient() {
  const toast = useToast();
  const [active, setActive] = useState("general");
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings({ ...DEFAULT, ...d.settings }); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok || data.error) { const message = await getAdminResponseError(res, "Unable to save settings."); setError(message); toast.error("Unable to save settings", message); return; }
      setSaved(true);
      toast.success("Settings saved successfully");
      setTimeout(() => setSaved(false), 3000);
    } catch { setError("Failed to save. Check connection."); toast.error("Unable to save settings", "Please check your connection and try again."); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: 10, fontFamily: "DM Sans,sans-serif", color: "#aaa" }}>
      <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> Loading settings…
    </div>
  );

  const s = settings;

  const tabContent: Record<string, React.ReactNode> = {
    general: (<>
      <Sec title="Restaurant Info">
        <Field label="Restaurant Name" hint="Shown in emails, receipts and browser tabs."><Inp value={s.siteName} onChange={v => set("siteName", v)} placeholder="Damru By Namo" /></Field>
        <Field label="Tagline"><Inp value={s.tagline} onChange={v => set("tagline", v)} placeholder="Banquet | Restaurant" /></Field>
        <Field label="Site URL"><Inp value={s.siteUrl} onChange={v => set("siteUrl", v)} placeholder="https://damrurestro.com" /></Field>
        <Field label="Support Email"><Inp value={s.supportEmail} onChange={v => set("supportEmail", v)} type="email" placeholder="info@damrurestro.com" /></Field>
        <Field label="Phone" hint="Shown on contact pages and footers."><Inp value={s.phone} onChange={v => set("phone", v)} placeholder="+91 XXXXX XXXXX" /></Field>
        <Field label="Address"><Inp value={s.address} onChange={v => set("address", v)} placeholder="35A Mansarovar, Jaipur, Rajasthan 302020" /></Field>
      </Sec>
      {/* <Sec title="Locale">
        <Field label="Currency">
          <select className="sf-inp" value={s.currency} onChange={e => set("currency", e.target.value)}>
            <option value="INR">INR — Indian Rupee (₹)</option>
            <option value="USD">USD — US Dollar ($)</option>
          </select>
        </Field>
        <Field label="Timezone">
          <select className="sf-inp" value={s.timezone} onChange={e => set("timezone", e.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </Sec> */}
    </>),

    email: (
      <Sec title="SMTP Configuration">
        <div style={{ padding: "10px 16px 8px", fontSize: "0.78rem", color: "#92400e", fontFamily: "DM Sans,sans-serif", background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
          ⚠️ These settings control OTP and notification emails. Changes take effect immediately.
        </div>
        <Field label="SMTP Host"><Inp value={s.smtpHost} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com" /></Field>
        <Field label="SMTP Port"><Inp value={s.smtpPort} onChange={v => set("smtpPort", Number(v))} type="number" placeholder="587" /></Field>
        <Field label="SMTP Username" hint="Your Gmail or SMTP account email."><Inp value={s.smtpUser} onChange={v => set("smtpUser", v)} type="email" placeholder="your@gmail.com" /></Field>
        <Field label="SMTP Password" hint="Use an App Password for Gmail."><Inp value={s.smtpPass} onChange={v => set("smtpPass", v)} type="password" placeholder="••••••••••••••••" /></Field>
        <Field label="Sender Name" hint="Shown as 'From' name in emails."><Inp value={s.smtpFromName} onChange={v => set("smtpFromName", v)} placeholder="Damru By Namo" /></Field>
        <Field label="Use TLS/SSL" hint="Enable for port 465, disable for 587."><Toggle value={s.smtpSecure} onChange={v => set("smtpSecure", v)} /></Field>
      </Sec>
    ),

    notifications: (
      <Sec title="Email Notification Triggers">
        <Field label="New User Registration" hint="Send email when a user creates an account."><Toggle value={s.notifyNewUser} onChange={v => set("notifyNewUser", v)} /></Field>
        <Field label="New Order Placed" hint="Alert when a customer places an order."><Toggle value={s.notifyNewOrder} onChange={v => set("notifyNewOrder", v)} /></Field>
        <Field label="New Reservation" hint="Alert when a table is booked."><Toggle value={s.notifyReservation} onChange={v => set("notifyReservation", v)} /></Field>
        <Field label="New Complaint" hint="Alert when a user submits a complaint."><Toggle value={s.notifyComplaint} onChange={v => set("notifyComplaint", v)} /></Field>
      </Sec>
    ),

    orders: (
      <Sec title="Order & Delivery Settings">
        <Field label="Tax Rate (%)" hint="Applied to all orders at checkout."><Inp value={s.taxRate} onChange={v => set("taxRate", Number(v))} type="number" placeholder="5" /></Field>
        <Field label="Free Delivery Above (₹)" hint="Orders above this amount get free delivery."><Inp value={s.freeDeliveryAbove} onChange={v => set("freeDeliveryAbove", Number(v))} type="number" placeholder="500" /></Field>
        <Field label="Delivery Charge (₹)" hint="Flat fee for orders below the free threshold."><Inp value={s.deliveryCharge} onChange={v => set("deliveryCharge", Number(v))} type="number" placeholder="50" /></Field>
      </Sec>
    ),

    maintenance: (
      <Sec title="Maintenance Mode">
        <Field label="Enable Maintenance Mode" hint="Hides the website and shows maintenance message to visitors.">
          <Toggle value={s.maintenanceMode} onChange={v => set("maintenanceMode", v)} />
        </Field>
        <Field label="Maintenance Message" hint="Shown to visitors when maintenance mode is on.">
          <Inp value={s.maintenanceMsg} onChange={v => set("maintenanceMsg", v)} placeholder="We'll be back soon!" />
        </Field>
        {s.maintenanceMode && (
          <div style={{ padding: "10px 16px", background: "#fef2f2", borderTop: "1px solid #fecaca" }}>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", color: "#b91c1c", fontWeight: 500 }}>
              ⚠️ Maintenance mode is ON — your website is currently inaccessible to visitors.
            </p>
          </div>
        )}
      </Sec>
    ),
  };

  return (
    <>
      <div className="sf-wrap">
        <aside className="sf-sidebar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`sf-tab${active === id ? " sf-tab-a" : ""}`} onClick={() => setActive(id)}>
              <Icon size={15} />{label}
            </button>
          ))}
        </aside>
        <div className="sf-content">
          <div className="sf-inner">
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: 9, fontSize: "0.84rem", fontFamily: "DM Sans,sans-serif" }}>⚠ {error}</div>}
            {tabContent[active]}
          </div>
          <div className="sf-savebar">
            <p className="sf-save-hint">
              {saved
                ? <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={13} /> Saved successfully!</span>
                : "Unsaved changes are lost on navigation."}
            </p>
            <button className="sf-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Save size={13} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sf-wrap { display:flex; min-height:calc(100vh - 60px); background:#f5f6fa; }
        .sf-sidebar { width:190px; padding:14px 10px; border-right:1px solid #e5e7eb; display:flex; flex-direction:column; gap:2px; background:#fff; flex-shrink:0; }
        .sf-tab { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:9px; background:none; border:none; color:#6b7280; font-family:'DM Sans',sans-serif; font-size:0.84rem; cursor:pointer; text-align:left; width:100%; transition:all 0.13s; }
        .sf-tab:hover { background:#f9fafb; color:#111827; }
        .sf-tab-a { background:#fff7ed; color:#f97316; font-weight:500; }
        .sf-content { flex:1; display:flex; flex-direction:column; max-width:700px; }
        .sf-inner { flex:1; padding:20px 24px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
        .sf-sec { background:#fff; border:1px solid #e5e7eb; border-radius:13px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
        .sf-sec-title { font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:700; color:#6b7280; letter-spacing:0.05em; padding:10px 16px; border-bottom:1px solid #f3f4f6; background:#fafafa; text-transform:uppercase; }
        .sf-sec-body { display:flex; flex-direction:column; }
        .sf-row { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #f9fafb; gap:16px; }
        .sf-row:last-child { border-bottom:none; }
        .sf-left { flex:1; }
        .sf-label { font-size:0.875rem; color:#111827; font-weight:400; margin-bottom:2px; font-family:'DM Sans',sans-serif; }
        .sf-hint { font-size:0.75rem; color:#9ca3af; line-height:1.4; }
        .sf-right { flex-shrink:0; }
        .sf-inp { background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:8px; padding:7px 11px; color:#111827; font-family:'DM Sans',sans-serif; font-size:0.84rem; outline:none; width:220px; transition:border-color 0.15s; }
        .sf-inp:focus { border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.08); background:#fff; }
        select.sf-inp { cursor:pointer; }
        .sf-savebar { display:flex; justify-content:space-between; align-items:center; padding:12px 24px; border-top:1px solid #e5e7eb; background:#fff; }
        .sf-save-hint { font-size:0.76rem; color:#9ca3af; font-family:'DM Sans',sans-serif; }
        .sf-save-btn { display:flex; align-items:center; gap:6px; background:linear-gradient(135deg,#f97316,#ea580c); border:none; border-radius:9px; padding:8px 18px; font-family:'DM Sans',sans-serif; font-size:0.84rem; color:#fff; cursor:pointer; font-weight:500; box-shadow:0 3px 12px rgba(249,115,22,0.25); transition:opacity 0.13s; }
        .sf-save-btn:hover:not(:disabled) { opacity:0.9; }
        .sf-save-btn:disabled { opacity:0.65; cursor:not-allowed; }
      `}</style>
    </>
  );
}
