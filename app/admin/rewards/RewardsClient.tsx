"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Save, Loader2, Gift, Settings2, Users,
  Plus, Minus, Lock, Unlock, Flame, Trash2, Trophy, Pencil, Target, Share2, Crown,
} from "lucide-react";
import { useToast } from "@/components/admin/Toast";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

interface CouponTemplate { type: "flat" | "percentage"; value: number; maxDiscount: number | null; minOrderValue: number; }
interface RewardRule {
  _id: string; category: string; label: string; description: string;
  isActive: boolean; amount: number; validForDays: number | null;
  couponTemplate?: CouponTemplate;
}

function LoyaltyTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [tiers, setTiers] = useState<LoyaltyTierRow[]>([]); const [form, setForm] = useState(EMPTY_LOYALTY); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/admin/rewards/loyalty"); const d = await r.json(); if (r.ok) setTiers(d.tiers || []); else setError(d.error || "Could not load tiers."); }, []);
  useEffect(() => { void load(); }, [load]);
  async function createTier() {
    setSaving(true); setError("");
    const payload = { ...form, maximumValue: form.maximumValue === "" ? null : Number(form.maximumValue), benefits: form.benefits.split("\n").map(v => v.trim()).filter(Boolean) };
    const r = await fetch("/api/admin/rewards/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const d = await r.json(); setSaving(false);
    if (!r.ok) { const message = d.error || "Could not create tier."; setError(message); toast.error("Unable to create loyalty tier", message); return; } setForm(EMPTY_LOYALTY); toast.success("Loyalty tier created"); await load();
  }
  async function toggle(tier: LoyaltyTierRow) {
    const r = await fetch(`/api/admin/rewards/loyalty/${tier._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !tier.isActive }) }); const d = await r.json();
    if (!r.ok) { const message = d.error || "Could not update tier."; setError(message); toast.error("Unable to update loyalty tier", message); } else { toast.success(tier.isActive ? "Loyalty tier disabled" : "Loyalty tier enabled"); await load(); }
  }
  return <div>
    <h3 style={{ marginTop: 0 }}>Loyalty Tiers</h3>
    {error && <p style={{ color: "#dc2626" }}>{error}</p>}
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4,minmax(120px,1fr))", marginBottom: 18 }}>
      {(["name", "code", "rank", "minimumValue", "maximumValue", "damruMultiplier", "badgeName", "badgeIcon", "tierBonusDamru"] as const).map(key => <label key={key} style={lbl}>{key.replace(/([A-Z])/g," $1")}<input style={inp} type={["rank","minimumValue","maximumValue","damruMultiplier","tierBonusDamru"].includes(key) ? "number" : "text"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label style={lbl}>Qualification<select style={inp} value={form.qualificationType} onChange={e => setForm({ ...form, qualificationType: e.target.value })}><option>LIFETIME_SPEND</option><option>COMPLETED_ORDERS</option><option>DAMRU_EARNED</option></select></label>
      <label style={{ ...lbl, gridColumn: "span 2" }}>Benefits (one per line)<textarea style={inp} value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} /></label>
      <button disabled={!canEdit || saving} onClick={createTier} style={{ alignSelf: "end", padding: 10 }}>{saving ? "Saving…" : "Create Tier"}</button>
    </div>
    <div style={{ display: "grid", gap: 8 }}>{tiers.map(t => <div key={t._id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}><span><b>{t.badgeIcon} {t.name}</b> · rank {t.rank} · {t.minimumValue}{t.maximumValue === null ? "+" : `–${t.maximumValue}`} · {t.damruMultiplier}x</span><button disabled={!canEdit} onClick={() => toggle(t)}>{t.isActive ? "Disable" : "Enable"}</button></div>)}</div>
  </div>;
}
interface DamruConfigValues {
  redemptionRate: number; minRedemption: number; maxRedemptionPerOrder: number;
  dailyEarnLimit: number | null; expiryEnabled: boolean; expiryDays: number | null; expiryWarningDays: number;
  loyaltyThresholds: { silver: number; gold: number; platinum: number };
}
interface RewardUser {
  _id: string; name: string; email: string; phone?: string;
  damruBalance: number; damruTotalEarned: number; damruTotalRedeemed: number; loyaltyLevel: string;
  dateOfBirth?: string; dobLocked: boolean; marriageAnniversary?: string; anniversaryLocked: boolean;
}
interface DamruTx {
  _id: string; type: string; category: string; amount: number; balanceAfter: number;
  description: string; adjustmentReason?: string; createdAt: string;
}
interface DayReward { day: number; amount: number; }
interface DailyStreakConfigValues {
  isActive: boolean; dayRewards: DayReward[];
  cycleBehavior: "restart" | "continue" | "weekly_cycle";
  allowStreakRecovery: boolean; gracePeriodDays: number;
}
interface AchievementRow {
  _id: string; name: string; code: string; description: string;
  category: string; conditionType: string; conditionValue: number;
  rewardDamruAmount: number; badgeName?: string; badgeIcon?: string;
  priority: number; isActive: boolean; startsAt?: string | null; endsAt?: string | null;
}
const ACHIEVEMENT_CATEGORIES = ["SHOPPING", "SPENDING", "ENGAGEMENT", "PROFILE", "LOYALTY", "REFERRAL", "SPECIAL"] as const;
const ACHIEVEMENT_CONDITIONS = ["ORDER_COUNT", "LIFETIME_SPEND", "LOGIN_STREAK", "PROFILE_COMPLETE", "ACCOUNT_AGE_DAYS"] as const;
const EMPTY_ACHIEVEMENT_FORM = {
  name: "", code: "", description: "", category: "SHOPPING" as string, conditionType: "ORDER_COUNT" as string,
  conditionValue: 1, rewardDamruAmount: 0, badgeName: "", badgeIcon: "", priority: 0,
};

interface MissionRow {
  _id: string; name: string; code: string; description: string;
  missionType: string; periodType: string; targetValue: number;
  rewardDamruAmount: number; priority: number; isActive: boolean;
  startsAt?: string | null; endsAt?: string | null;
}
const MISSION_TYPES = ["ORDER_COUNT", "SPENDING_AMOUNT", "LOGIN_STREAK", "PROFILE_COMPLETE"] as const;
const MISSION_PERIODS = ["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "CAMPAIGN"] as const;
const EMPTY_MISSION_FORM = {
  name: "", code: "", description: "", missionType: "ORDER_COUNT" as string, periodType: "MONTHLY" as string,
  targetValue: 1, rewardDamruAmount: 0, startsAt: "", endsAt: "", priority: 0,
};

interface ReferralConfigValues {
  isActive: boolean; referrerRewardDamru: number; referredUserRewardDamru: number;
  qualificationEvent: "FIRST_DELIVERED_ORDER" | "FIRST_ELIGIBLE_ORDER";
  minimumOrderAmount: number; rewardDelayDays: number; maximumSuccessfulReferralsPerUser: number | null;
  requireEmailVerified: boolean; requireMobileVerified: boolean;
}
interface ReferralRow {
  _id: string; status: string; registeredAt: string; qualifiedAt?: string | null; rewardedAt?: string | null;
  referrerRewardAmount: number; referredRewardAmount: number;
  referrerUserId?: { name: string; email: string } | null;
  referredUserId?: { name: string; email: string } | null;
}
interface LoyaltyTierRow { _id: string; name: string; code: string; rank: number; qualificationType: string; minimumValue: number; maximumValue: number | null; damruMultiplier: number; benefits: string[]; badgeName?: string; badgeIcon?: string; tierBonusDamru: number; isActive: boolean; }
const REFERRAL_STATUSES = ["", "PENDING_QUALIFICATION", "QUALIFIED", "REWARDED", "REJECTED", "CANCELLED"] as const;
const EMPTY_LOYALTY = { name: "", code: "", rank: 0, qualificationType: "LIFETIME_SPEND", minimumValue: 0, maximumValue: "", damruMultiplier: 1, benefits: "", badgeName: "", badgeIcon: "", tierBonusDamru: 0 };

const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", fontFamily: "DM Sans, sans-serif", display: "block", marginBottom: 4 };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: on ? "#f97316" : "#e5e7eb", cursor: "pointer", position: "relative", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 16, height: 16, background: "#fff", borderRadius: "50%", transition: "left 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

const TABS = [
  { key: "rules", label: "Reward Rules", icon: Gift },
  { key: "config", label: "Damru Configuration", icon: Settings2 },
  { key: "daily", label: "Daily Rewards", icon: Flame },
  { key: "achievements", label: "Achievements", icon: Trophy },
  { key: "missions", label: "Missions", icon: Target },
  { key: "referrals", label: "Referrals", icon: Share2 },
  { key: "loyalty", label: "Loyalty Tiers", icon: Crown },
  { key: "users", label: "User Rewards", icon: Users },
] as const;

export default function RewardsClient({ perms }: { perms?: Perms }) {
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.rewards?.[action]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("rules");

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="rewards-tabbar" style={{ display: "flex", borderBottom: "1px solid #f3f4f6", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "14px 18px",
              background: "none", border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
              fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", fontWeight: 600,
              color: tab === t.key ? "#f97316" : "#6b7280",
              borderBottom: tab === t.key ? "2px solid #f97316" : "2px solid transparent",
            }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <style>{`
        .rewards-tabbar::-webkit-scrollbar { height: 4px; }
        .rewards-tabbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}</style>
      <div style={{ padding: 22 }}>
        {tab === "rules" && <RulesTab canEdit={can("edit")} />}
        {tab === "config" && <ConfigTab canEdit={can("edit")} />}
        {tab === "daily" && <DailyTab canEdit={can("edit")} />}
        {tab === "achievements" && <AchievementsTab canEdit={can("edit")} />}
        {tab === "missions" && <MissionsTab canEdit={can("edit")} />}
        {tab === "referrals" && <ReferralsTab canEdit={can("edit")} />}
        {tab === "loyalty" && <LoyaltyTab canEdit={can("edit")} />}
        {tab === "users" && <UsersTab canEdit={can("edit")} />}
      </div>
    </div>
  );
}

// ── Reward Rules ─────────────────────────────────────────────
function RulesTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/rewards/rules").then(r => r.json()).then(d => { setRules(d.rules || []); setLoading(false); });
  }, []);

  function update(id: string, patch: Partial<RewardRule>) {
    setRules(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r));
  }

  async function save(rule: RewardRule) {
    setSavingId(rule._id);
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule._id, amount: rule.amount, isActive: rule.isActive,
          validForDays: rule.validForDays, couponTemplate: rule.couponTemplate,
        }),
      });
      const data = await res.json();
      if (data.rule) { update(rule._id, data.rule); toast.success("Reward rule updated successfully"); }
      else toast.error("Unable to update reward rule");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {rules.map(rule => (
        <div key={rule._id} style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, opacity: rule.isActive ? 1 : 0.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>{rule.label}</p>
              <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0, fontFamily: "DM Sans, sans-serif" }}>{rule.description}</p>
            </div>
            <Toggle on={rule.isActive} onClick={() => canEdit && update(rule._id, { isActive: !rule.isActive })} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: rule.couponTemplate ? "1fr 1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Damru Amount</label>
              <input type="number" style={inp} value={rule.amount} min={0} disabled={!canEdit}
                onChange={e => update(rule._id, { amount: Number(e.target.value) })} />
            </div>
            <div>
              <label style={lbl}>Coupon Valid For (days)</label>
              <input type="number" style={inp} value={rule.validForDays ?? ""} min={0} disabled={!canEdit}
                placeholder="Never expires"
                onChange={e => update(rule._id, { validForDays: e.target.value ? Number(e.target.value) : null })} />
            </div>
            {rule.couponTemplate && (
              <>
                <div>
                  <label style={lbl}>Coupon % Off</label>
                  <input type="number" style={inp} value={rule.couponTemplate.value} min={0} max={100} disabled={!canEdit}
                    onChange={e => update(rule._id, { couponTemplate: { ...rule.couponTemplate!, value: Number(e.target.value) } })} />
                </div>
                <div>
                  <label style={lbl}>Max Discount (₹)</label>
                  <input type="number" style={inp} value={rule.couponTemplate.maxDiscount ?? ""} min={0} disabled={!canEdit}
                    placeholder="No cap"
                    onChange={e => update(rule._id, { couponTemplate: { ...rule.couponTemplate!, maxDiscount: e.target.value ? Number(e.target.value) : null } })} />
                </div>
              </>
            )}
          </div>

          {canEdit && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => save(rule)} disabled={savingId === rule._id}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {savingId === rule._id ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={13} />} Save
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Damru Configuration ──────────────────────────────────────
function ConfigTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [config, setConfig] = useState<DamruConfigValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/rewards/config").then(r => r.json()).then(d => { setConfig(d.config); setLoading(false); });
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/admin/rewards/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.config) { setConfig(data.config); setSaved(true); toast.success("Damru configuration saved"); }
      else toast.error("Unable to save Damru configuration");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>;

  const set = (k: keyof DamruConfigValues, v: unknown) => setConfig(prev => prev ? { ...prev, [k]: v } as DamruConfigValues : prev);
  const setThreshold = (k: "silver" | "gold" | "platinum", v: number) =>
    setConfig(prev => prev ? { ...prev, loyaltyThresholds: { ...prev.loyaltyThresholds, [k]: v } } : prev);

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Redemption</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={lbl}>₹ per 1 Damru</label>
          <input type="number" step="0.01" style={inp} value={config.redemptionRate} disabled={!canEdit} onChange={e => set("redemptionRate", Number(e.target.value))} />
        </div>
        <div>
          <label style={lbl}>Min Redemption</label>
          <input type="number" style={inp} value={config.minRedemption} disabled={!canEdit} onChange={e => set("minRedemption", Number(e.target.value))} />
        </div>
        <div>
          <label style={lbl}>Max Redemption / Order</label>
          <input type="number" style={inp} value={config.maxRedemptionPerOrder} disabled={!canEdit} onChange={e => set("maxRedemptionPerOrder", Number(e.target.value))} />
        </div>
      </div>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Limits</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={lbl}>Daily Earn Limit</label>
          <input type="number" style={inp} value={config.dailyEarnLimit ?? ""} placeholder="Unlimited" disabled={!canEdit}
            onChange={e => set("dailyEarnLimit", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label style={lbl}>Expiry (days)</label>
          <input type="number" style={inp} value={config.expiryDays ?? ""} placeholder="Never expires" disabled={!canEdit}
            onChange={e => set("expiryDays", e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Damru Expiry</p>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, marginBottom: 10, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", color: "#111827" }}>
          <input type="checkbox" checked={config.expiryEnabled} disabled={!canEdit} onChange={e => set("expiryEnabled", e.target.checked)} />
          Enabled
        </label>
        <div>
          <label style={lbl}>Expiring Soon Warning (days)</label>
          <input type="number" style={inp} value={config.expiryWarningDays} disabled={!canEdit} onChange={e => set("expiryWarningDays", Number(e.target.value))} />
        </div>
      </div>
      {config.expiryEnabled && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: "0.78rem", color: "#92400e", margin: 0, fontFamily: "DM Sans, sans-serif", lineHeight: 1.5 }}>
            Damru expiry affects customer wallet balances. New Damru credited from now on will expire {config.expiryDays || "—"} days after being earned.
            Existing customers&apos; Damru follows the legacy-balance policy (see docs/DAMRU_EXPIRY_SYSTEM.md) — it will not expire unless the legacy migration
            has been run to backfill it, and even then only counts from migration time, not original earn date. Changing this setting later only affects
            future credits; already-assigned expiry dates are never retroactively changed or removed.
          </p>
        </div>
      )}
      <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 20px", fontFamily: "DM Sans, sans-serif" }}>
        Expiry defaults OFF and only applies to Damru credited after being enabled — see the Deferred Decisions section of docs/DAMRU_EXPIRY_SYSTEM.md.
      </p>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Loyalty Level Thresholds (total Damru earned)</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div>
          <label style={lbl}>Silver</label>
          <input type="number" style={inp} value={config.loyaltyThresholds.silver} disabled={!canEdit} onChange={e => setThreshold("silver", Number(e.target.value))} />
        </div>
        <div>
          <label style={lbl}>Gold</label>
          <input type="number" style={inp} value={config.loyaltyThresholds.gold} disabled={!canEdit} onChange={e => setThreshold("gold", Number(e.target.value))} />
        </div>
        <div>
          <label style={lbl}>Platinum</label>
          <input type="number" style={inp} value={config.loyaltyThresholds.platinum} disabled={!canEdit} onChange={e => setThreshold("platinum", Number(e.target.value))} />
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={save} disabled={saving}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} Save Configuration
          </button>
          {saved && <span style={{ color: "#16a34a", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>Saved ✓</span>}
        </div>
      )}
    </div>
  );
}

// ── Daily Streak Rewards ─────────────────────────────────────
function DailyTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [config, setConfig] = useState<DailyStreakConfigValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/rewards/daily").then(r => r.json()).then(d => { setConfig(d.config); setLoading(false); });
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true); setSaved(false); setError("");
    try {
      const res = await fetch("/api/admin/rewards/daily", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); toast.error("Unable to save daily reward configuration"); return; }
      if (data.config) { setConfig(data.config); setSaved(true); toast.success("Daily reward configuration saved"); }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>;

  function updateDay(idx: number, patch: Partial<DayReward>) {
    setConfig(prev => {
      if (!prev) return prev;
      const dayRewards = prev.dayRewards.map((d, i) => i === idx ? { ...d, ...patch } : d);
      return { ...prev, dayRewards };
    });
  }
  function addDay() {
    setConfig(prev => {
      if (!prev) return prev;
      const nextDay = (prev.dayRewards[prev.dayRewards.length - 1]?.day || 0) + 1;
      return { ...prev, dayRewards: [...prev.dayRewards, { day: nextDay, amount: 0 }] };
    });
  }
  function removeDay(idx: number) {
    setConfig(prev => prev ? { ...prev, dayRewards: prev.dayRewards.filter((_, i) => i !== idx) } : prev);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 14, fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>Daily Login Streak</p>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0, fontFamily: "DM Sans, sans-serif" }}>Reward users for consecutive eligible days.</p>
        </div>
        <Toggle on={config.isActive} onClick={() => canEdit && setConfig(prev => prev ? { ...prev, isActive: !prev.isActive } : prev)} />
      </div>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Day → Damru Amount</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {config.dayRewards.map((d, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 10, alignItems: "center" }}>
            <div>
              <label style={lbl}>Day</label>
              <input type="number" style={inp} value={d.day} min={1} disabled={!canEdit}
                onChange={e => updateDay(idx, { day: Number(e.target.value) })} />
            </div>
            <div>
              <label style={lbl}>Damru</label>
              <input type="number" style={inp} value={d.amount} min={0} disabled={!canEdit}
                onChange={e => updateDay(idx, { amount: Number(e.target.value) })} />
            </div>
            {canEdit && (
              <button onClick={() => removeDay(idx)} title="Remove day" style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", alignSelf: "flex-end", padding: "8px 4px" }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <button onClick={addDay} style={{ alignSelf: "flex-start", background: "none", border: "1.5px dashed #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#6b7280", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Add Day
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>After the final configured day</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["restart", "continue", "weekly_cycle"] as const).map(opt => (
          <button key={opt} type="button" disabled={!canEdit} onClick={() => setConfig(prev => prev ? { ...prev, cycleBehavior: opt } : prev)}
            style={{
              padding: "8px 14px", borderRadius: 8, cursor: canEdit ? "pointer" : "default",
              border: `1.5px solid ${config.cycleBehavior === opt ? "#f97316" : "#e5e7eb"}`,
              background: config.cycleBehavior === opt ? "#fff7ed" : "#fff",
              color: config.cycleBehavior === opt ? "#f97316" : "#6b7280",
              fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", fontWeight: 600, textTransform: "capitalize",
            }}>
            {opt.replace("_", " ")}
          </button>
        ))}
      </div>

      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Streak Recovery</p>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Toggle on={config.allowStreakRecovery} onClick={() => canEdit && setConfig(prev => prev ? { ...prev, allowStreakRecovery: !prev.allowStreakRecovery } : prev)} />
          <span style={{ fontSize: "0.82rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>Allow Streak Recovery</span>
        </div>
        <div>
          <label style={lbl}>Grace Period (days)</label>
          <input type="number" style={{ ...inp, width: 90 }} value={config.gracePeriodDays} min={0} max={1} disabled={!canEdit}
            onChange={e => setConfig(prev => prev ? { ...prev, gracePeriodDays: Number(e.target.value) } : prev)} />
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={save} disabled={saving}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} Save Configuration
          </button>
          {saved && <span style={{ color: "#16a34a", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>Saved ✓</span>}
        </div>
      )}
    </div>
  );
}

// ── Achievements ──────────────────────────────────────────────
function AchievementsTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ACHIEVEMENT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/rewards/achievements");
    const data = await res.json();
    setAchievements(data.achievements || []);
    setLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  function startCreate() {
    setForm(EMPTY_ACHIEVEMENT_FORM);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function startEdit(a: AchievementRow) {
    setForm({
      name: a.name, code: a.code, description: a.description,
      category: a.category, conditionType: a.conditionType, conditionValue: a.conditionValue,
      rewardDamruAmount: a.rewardDamruAmount, badgeName: a.badgeName || "", badgeIcon: a.badgeIcon || "",
      priority: a.priority,
    });
    setEditingId(a._id);
    setError("");
    setShowForm(true);
  }

  async function toggleActive(a: AchievementRow) {
    if (!canEdit) return;
    const res = await fetch(`/api/admin/rewards/achievements/${a._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    const data = await res.json();
    if (data.achievement) { setAchievements(prev => prev.map(x => x._id === a._id ? data.achievement : x)); toast.success(data.achievement.isActive ? "Achievement enabled" : "Achievement disabled"); }
    else toast.error("Unable to update achievement");
  }

  async function submit() {
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!editingId && !form.code.trim()) { setError("Code is required."); return; }
    if (form.conditionValue <= 0) { setError("Target must be greater than 0."); return; }
    if (form.rewardDamruAmount < 0) { setError("Reward amount cannot be negative."); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/admin/rewards/achievements/${editingId}` : "/api/admin/rewards/achievements";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); toast.error("Unable to save achievement"); return; }
      setShowForm(false);
      toast.success(editingId ? "Achievement updated successfully" : "Achievement created successfully");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", margin: 0, fontFamily: "DM Sans, sans-serif" }}>Achievements</p>
        {canEdit && !showForm && (
          <button onClick={startCreate}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New Achievement
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 20, maxWidth: 640 }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Name</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Code {editingId && "(locked)"}</label>
              <input style={inp} value={form.code} disabled={!!editingId}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. ORDERS_10" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Description</label>
            <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Category</label>
              <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {ACHIEVEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Condition</label>
              <select style={inp} value={form.conditionType} onChange={e => setForm(f => ({ ...f, conditionType: e.target.value }))}>
                {ACHIEVEMENT_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Target Value</label>
              <input type="number" style={inp} value={form.conditionValue} min={1}
                onChange={e => setForm(f => ({ ...f, conditionValue: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Damru Reward</label>
              <input type="number" style={inp} value={form.rewardDamruAmount} min={0}
                onChange={e => setForm(f => ({ ...f, rewardDamruAmount: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={lbl}>Badge Name</label>
              <input style={inp} value={form.badgeName} onChange={e => setForm(f => ({ ...f, badgeName: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label style={lbl}>Badge Icon</label>
              <input style={inp} value={form.badgeIcon} onChange={e => setForm(f => ({ ...f, badgeIcon: e.target.value }))} placeholder="Emoji/icon key" />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <input type="number" style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={submit} disabled={saving}
              style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} {editingId ? "Save Changes" : "Create Achievement"}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "9px 18px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {achievements.length === 0 && <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>No achievements yet.</p>}
          {achievements.map(a => (
            <div key={a._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", opacity: a.isActive ? 1 : 0.55 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>
                  {a.name} <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: "0.72rem" }}>· {a.code}</span>
                </p>
                <p style={{ fontSize: "0.76rem", color: "#6b7280", margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                  {a.category} · {a.conditionType} ≥ {a.conditionValue} · +{a.rewardDamruAmount} Damru{a.badgeName ? ` · Badge: ${a.badgeName}` : ""}
                </p>
              </div>
              {canEdit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => startEdit(a)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                    <Pencil size={15} />
                  </button>
                  <Toggle on={a.isActive} onClick={() => toggleActive(a)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Missions ──────────────────────────────────────────────────
function MissionsTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_MISSION_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/rewards/missions");
    const data = await res.json();
    setMissions(data.missions || []);
    setLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  function startCreate() {
    setForm(EMPTY_MISSION_FORM);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function startEdit(m: MissionRow) {
    setForm({
      name: m.name, code: m.code, description: m.description,
      missionType: m.missionType, periodType: m.periodType, targetValue: m.targetValue,
      rewardDamruAmount: m.rewardDamruAmount,
      startsAt: m.startsAt ? m.startsAt.slice(0, 10) : "",
      endsAt: m.endsAt ? m.endsAt.slice(0, 10) : "",
      priority: m.priority,
    });
    setEditingId(m._id);
    setError("");
    setShowForm(true);
  }

  async function toggleActive(m: MissionRow) {
    if (!canEdit) return;
    const res = await fetch(`/api/admin/rewards/missions/${m._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    const data = await res.json();
    if (data.mission) { setMissions(prev => prev.map(x => x._id === m._id ? data.mission : x)); toast.success(data.mission.isActive ? "Mission enabled" : "Mission disabled"); }
    else toast.error("Unable to update mission");
  }

  async function submit() {
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!editingId && !form.code.trim()) { setError("Code is required."); return; }
    if (form.targetValue <= 0) { setError("Target must be greater than 0."); return; }
    if (form.rewardDamruAmount < 0) { setError("Reward amount cannot be negative."); return; }
    if (form.periodType === "CAMPAIGN" && (!form.startsAt || !form.endsAt)) { setError("Campaign missions require both a start and end date."); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/admin/rewards/missions/${editingId}` : "/api/admin/rewards/missions";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); toast.error("Unable to save mission"); return; }
      setShowForm(false);
      toast.success(editingId ? "Mission updated successfully" : "Mission created successfully");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", margin: 0, fontFamily: "DM Sans, sans-serif" }}>Missions</p>
        {canEdit && !showForm && (
          <button onClick={startCreate}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New Mission
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 20, maxWidth: 640 }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Name</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Code {editingId && "(locked)"}</label>
              <input style={inp} value={form.code} disabled={!!editingId}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MONTHLY_5_ORDERS" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Description</label>
            <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Mission Type</label>
              <select style={inp} value={form.missionType} onChange={e => setForm(f => ({ ...f, missionType: e.target.value }))}>
                {MISSION_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Period</label>
              <select style={inp} value={form.periodType} onChange={e => setForm(f => ({ ...f, periodType: e.target.value }))}>
                {MISSION_PERIODS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Target Value</label>
              <input type="number" style={inp} value={form.targetValue} min={1}
                onChange={e => setForm(f => ({ ...f, targetValue: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Damru Reward</label>
              <input type="number" style={inp} value={form.rewardDamruAmount} min={0}
                onChange={e => setForm(f => ({ ...f, rewardDamruAmount: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" style={inp} value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>End Date</label>
              <input type="date" style={inp} value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <input type="number" style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={submit} disabled={saving}
              style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} {editingId ? "Save Changes" : "Create Mission"}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "9px 18px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {missions.length === 0 && <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>No missions yet.</p>}
          {missions.map(m => (
            <div key={m._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", opacity: m.isActive ? 1 : 0.55 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>
                  {m.name} <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: "0.72rem" }}>· {m.code}</span>
                </p>
                <p style={{ fontSize: "0.76rem", color: "#6b7280", margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                  {m.missionType} · {m.periodType} · target {m.targetValue} · +{m.rewardDamruAmount} Damru
                  {m.startsAt ? ` · from ${new Date(m.startsAt).toLocaleDateString("en-IN")}` : ""}
                  {m.endsAt ? ` to ${new Date(m.endsAt).toLocaleDateString("en-IN")}` : ""}
                </p>
              </div>
              {canEdit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => startEdit(m)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                    <Pencil size={15} />
                  </button>
                  <Toggle on={m.isActive} onClick={() => toggleActive(m)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Referrals ─────────────────────────────────────────────────
function ReferralsTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [config, setConfig] = useState<ReferralConfigValues | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof REFERRAL_STATUSES)[number]>("");
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const res = await fetch("/api/admin/rewards/referrals/config");
    const data = await res.json();
    setConfig(data.config);
    setConfigLoading(false);
  }, []);

  const loadList = useCallback(async (status: string) => {
    setListLoading(true);
    const res = await fetch(`/api/admin/rewards/referrals${status ? `?status=${status}` : ""}`);
    const data = await res.json();
    setReferrals(data.referrals || []);
    setListLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(loadConfig); }, [loadConfig]);
  useEffect(() => { Promise.resolve().then(() => loadList(statusFilter)); }, [statusFilter, loadList]);

  async function saveConfig() {
    if (!config) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/admin/rewards/referrals/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.config) { setConfig(data.config); setSaved(true); toast.success("Referral configuration saved"); }
      else toast.error("Unable to save referral configuration");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof ReferralConfigValues, v: unknown) => setConfig(prev => prev ? { ...prev, [k]: v } as ReferralConfigValues : prev);

  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", margin: "0 0 14px", fontFamily: "DM Sans, sans-serif" }}>Referral Configuration</p>

      {configLoading || !config ? (
        <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : (
        <div style={{ maxWidth: 640, marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Toggle on={config.isActive} onClick={() => canEdit && set("isActive", !config.isActive)} />
            <span style={{ fontSize: "0.85rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>Referral Program Enabled</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Referrer Reward (Damru)</label>
              <input type="number" style={inp} value={config.referrerRewardDamru} min={0} disabled={!canEdit} onChange={e => set("referrerRewardDamru", Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Referred User Reward (Damru)</label>
              <input type="number" style={inp} value={config.referredUserRewardDamru} min={0} disabled={!canEdit} onChange={e => set("referredUserRewardDamru", Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Qualification Event</label>
              <select style={inp} value={config.qualificationEvent} disabled={!canEdit} onChange={e => set("qualificationEvent", e.target.value)}>
                <option value="FIRST_DELIVERED_ORDER">First Delivered Order</option>
                <option value="FIRST_ELIGIBLE_ORDER">First Eligible Order</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Minimum Order Amount (₹)</label>
              <input type="number" style={inp} value={config.minimumOrderAmount} min={0} disabled={!canEdit} onChange={e => set("minimumOrderAmount", Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Reward Delay (days)</label>
              <input type="number" style={inp} value={config.rewardDelayDays} min={0} disabled={!canEdit} onChange={e => set("rewardDelayDays", Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Max Successful Referrals / User</label>
              <input type="number" style={inp} value={config.maximumSuccessfulReferralsPerUser ?? ""} placeholder="No limit" min={0} disabled={!canEdit}
                onChange={e => set("maximumSuccessfulReferralsPerUser", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle on={config.requireEmailVerified} onClick={() => canEdit && set("requireEmailVerified", !config.requireEmailVerified)} />
              <span style={{ fontSize: "0.8rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>Require Email Verified</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle on={config.requireMobileVerified} onClick={() => canEdit && set("requireMobileVerified", !config.requireMobileVerified)} />
              <span style={{ fontSize: "0.8rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>Require Mobile Verified</span>
            </div>
          </div>

          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={saveConfig} disabled={saving}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} Save Configuration
              </button>
              {saved && <span style={{ color: "#16a34a", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>Saved ✓</span>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", margin: 0, fontFamily: "DM Sans, sans-serif" }}>Referrals</p>
        <select style={{ ...inp, width: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as (typeof REFERRAL_STATUSES)[number])}>
          <option value="">All Statuses</option>
          {REFERRAL_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {listLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {referrals.length === 0 && <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>No referrals found.</p>}
          {referrals.map(r => (
            <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #f3f4f6", borderRadius: 10, padding: "10px 14px" }}>
              <div>
                <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>
                  {r.referrerUserId?.name || "—"} → {r.referredUserId?.name || "—"}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                  Registered {new Date(r.registeredAt).toLocaleDateString("en-IN")}
                  {r.qualifiedAt ? ` · Qualified ${new Date(r.qualifiedAt).toLocaleDateString("en-IN")}` : ""}
                  {r.rewardedAt ? ` · Rewarded ${new Date(r.rewardedAt).toLocaleDateString("en-IN")}` : ""}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontFamily: "DM Sans, sans-serif", fontSize: "0.7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                  background: r.status === "REWARDED" ? "#f0fdf4" : r.status === "REJECTED" || r.status === "CANCELLED" ? "#fef2f2" : "#fff7ed",
                  color: r.status === "REWARDED" ? "#16a34a" : r.status === "REJECTED" || r.status === "CANCELLED" ? "#dc2626" : "#f97316",
                }}>
                  {r.status}
                </span>
                {r.status === "REWARDED" && (
                  <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "4px 0 0", fontFamily: "DM Sans, sans-serif" }}>
                    +{r.referrerRewardAmount} / +{r.referredRewardAmount} Damru
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── User Rewards ─────────────────────────────────────────────
function UsersTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RewardUser[]>([]);
  const [selected, setSelected] = useState<RewardUser | null>(null);
  const [transactions, setTransactions] = useState<DamruTx[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState("");
  // Persists across a failed-then-retried submit of the SAME adjustment so a network
  // retry can't double-apply it; cleared after a successful submit so the next,
  // genuinely new adjustment (even with identical fields) gets its own fresh id.
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/rewards/users?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => setResults(d.users || []));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadUser = useCallback(async (id: string) => {
    requestIdRef.current = null; // switching users abandons any pending adjustment attempt
    setLoadingUser(true);
    const res = await fetch(`/api/admin/rewards/users/${id}`);
    const data = await res.json();
    setSelected(data.user);
    setTransactions(data.transactions || []);
    setLoadingUser(false);
  }, []);

  async function submitAdjust() {
    if (!selected) return;
    setError("");
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!reason.trim()) { setError("A reason is required."); return; }

    if (!requestIdRef.current) {
      requestIdRef.current = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    setAdjusting(true);
    try {
      const res = await fetch(`/api/admin/rewards/users/${selected._id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), direction, reason, requestId: requestIdRef.current, neverExpires }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); toast.error("Unable to adjust Damru", data.error === "Insufficient Damru balance." ? data.error : undefined); return; }
      requestIdRef.current = null;
      setAmount(""); setReason(""); setNeverExpires(false);
      toast.success(direction === "credit" ? "Damru added successfully" : "Damru deducted successfully", `${Number(amount).toLocaleString("en-IN")} Damru ${direction === "credit" ? "added to" : "deducted from"} the user's wallet.`);
      await loadUser(selected._id);
    } finally {
      setAdjusting(false);
    }
  }

  async function unlock(field: "dob" | "anniversary") {
    if (!selected) return;
    const res = await fetch(`/api/admin/rewards/users/${selected._id}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field }),
    });
    const data = await res.json();
    if (!data.error) { setSelected(prev => prev ? { ...prev, dobLocked: data.dobLocked, anniversaryLocked: data.anniversaryLocked } : prev); toast.success(field === "dob" ? "Birthday unlocked successfully" : "Marriage anniversary unlocked successfully"); }
    else toast.error("Unable to unlock occasion");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "300px 1fr" : "1fr", gap: 20 }}>
      <div>
        <div className="searchbox" style={{ marginBottom: 10 }}>
          <Search size={14} className="search-ic" />
          <input className="search-inp" placeholder="Search name, email, phone…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
          {results.map(u => (
            <button key={u._id} onClick={() => loadUser(u._id)}
              style={{
                textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${selected?._id === u._id ? "#f97316" : "#e5e7eb"}`,
                background: selected?._id === u._id ? "#fff7ed" : "#fff",
                fontFamily: "DM Sans, sans-serif",
              }}>
              <p style={{ fontWeight: 600, fontSize: "0.84rem", color: "#111827", margin: "0 0 2px" }}>{u.name}</p>
              <p style={{ fontSize: "0.74rem", color: "#9ca3af", margin: 0 }}>{u.email}</p>
              <p style={{ fontSize: "0.76rem", color: "#f97316", fontWeight: 700, margin: "4px 0 0" }}>{u.damruBalance} Damru · {u.loyaltyLevel}</p>
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>No users found.</p>
          )}
        </div>
      </div>

      {selected && (
        <div>
          {loadingUser ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /></div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
                {[
                  { label: "Balance", value: selected.damruBalance, color: "#f97316" },
                  { label: "Total Earned", value: selected.damruTotalEarned, color: "#16a34a" },
                  { label: "Total Redeemed", value: selected.damruTotalRedeemed, color: "#6b7280" },
                  { label: "Loyalty Level", value: selected.loyaltyLevel, color: "#3b82f6" },
                ].map(s => (
                  <div key={s.label} style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 4px", fontFamily: "DM Sans, sans-serif" }}>{s.label}</p>
                    <p style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color, margin: 0, fontFamily: "DM Sans, sans-serif", textTransform: "capitalize" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: "0.8rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>
                    Date of Birth: {selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString("en-IN") : "Not set"}
                  </span>
                  {selected.dobLocked && canEdit && (
                    <button onClick={() => unlock("dob")} title="Unlock" style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontFamily: "DM Sans, sans-serif" }}>
                      <Lock size={13} /> Unlock
                    </button>
                  )}
                  {!selected.dobLocked && <Unlock size={13} style={{ color: "#9ca3af" }} />}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: "0.8rem", color: "#374151", fontFamily: "DM Sans, sans-serif" }}>
                    Anniversary: {selected.marriageAnniversary ? new Date(selected.marriageAnniversary).toLocaleDateString("en-IN") : "Not set"}
                  </span>
                  {selected.anniversaryLocked && canEdit && (
                    <button onClick={() => unlock("anniversary")} title="Unlock" style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontFamily: "DM Sans, sans-serif" }}>
                      <Lock size={13} /> Unlock
                    </button>
                  )}
                  {!selected.anniversaryLocked && <Unlock size={13} style={{ color: "#9ca3af" }} />}
                </div>
              </div>

              {canEdit && (
                <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#111827", margin: "0 0 12px", fontFamily: "DM Sans, sans-serif" }}>Manual Adjustment</p>
                  {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>{error}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 2fr auto", gap: 10, alignItems: "flex-end" }}>
                    <div>
                      <label style={lbl}>Direction</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => setDirection("credit")}
                          style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${direction === "credit" ? "#16a34a" : "#e5e7eb"}`, background: direction === "credit" ? "#f0fdf4" : "#fff", color: direction === "credit" ? "#16a34a" : "#6b7280", cursor: "pointer" }}>
                          <Plus size={14} />
                        </button>
                        <button type="button" onClick={() => setDirection("debit")}
                          style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${direction === "debit" ? "#dc2626" : "#e5e7eb"}`, background: direction === "debit" ? "#fef2f2" : "#fff", color: direction === "debit" ? "#dc2626" : "#6b7280", cursor: "pointer" }}>
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Amount</label>
                      <input type="number" style={inp} value={amount} onChange={e => setAmount(e.target.value)} min={1} />
                    </div>
                    <div>
                      <label style={lbl}>Reason (required)</label>
                      <input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Compensation for delayed order" />
                    </div>
                    <button onClick={submitAdjust} disabled={adjusting}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {adjusting ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : "Apply"}
                    </button>
                  </div>
                  {direction === "credit" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem", color: "#6b7280" }}>
                      <input type="checkbox" checked={neverExpires} onChange={e => setNeverExpires(e.target.checked)} />
                      Never Expires (overrides the standard Damru expiry policy for this credit only)
                    </label>
                  )}
                </div>
              )}

              <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#111827", margin: "0 0 10px", fontFamily: "DM Sans, sans-serif" }}>Transaction History</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {transactions.length === 0 && <p style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>No transactions yet.</p>}
                {transactions.map(tx => (
                  <div key={tx._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #f3f4f6", borderRadius: 10 }}>
                    <div>
                      <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", margin: "0 0 2px", fontFamily: "DM Sans, sans-serif" }}>{tx.description || tx.category}</p>
                      <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                        {new Date(tx.createdAt).toLocaleString("en-IN")}{tx.adjustmentReason ? ` · ${tx.adjustmentReason}` : ""}
                      </p>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: tx.type === "credit" ? "#16a34a" : "#dc2626", fontFamily: "DM Sans, sans-serif" }}>
                      {tx.type === "credit" ? "+" : "-"}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
