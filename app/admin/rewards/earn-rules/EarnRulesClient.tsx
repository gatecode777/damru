"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Calculator, Layers, Loader2, Plus, Save, Tag, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { useAdminConfirm } from "@/components/admin/ConfirmDialog";

type RuleType = "ITEM" | "CATEGORY" | "ORDER_VALUE_TIER";
type RuleStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
type Basis = "PER_UNIT" | "PER_LINE" | "PER_ORDER";
type TierMode = "HIGHEST_MATCH" | "CUMULATIVE" | "SLAB";
type BaseBehavior = "ADD" | "REPLACE";

interface Tier { minAmount: number; damru: number }
interface EarnRuleRow {
  _id: string; name: string; code: string; description: string; ruleType: RuleType; status: RuleStatus;
  menuItemIds: string[]; categoryIds: string[]; branchIds: string[];
  basis: Basis | null; damruPerUnit: number; tiers: Tier[]; tierMode: TierMode | null; baseRewardBehavior: BaseBehavior | null;
  maxDamruPerOrder: number | null; includeInCampaignBase: boolean; startsAt: string | null; endsAt: string | null;
  version: number; updatedAt: string;
}
interface Option { _id: string; name: string; category?: string; isActive?: boolean }
interface Options { menuItems: Option[]; categories: Option[]; branches: Option[] }
interface RuleForm {
  _id?: string; version?: number; status?: RuleStatus;
  name: string; code: string; description: string; ruleType: RuleType;
  menuItemIds: string[]; categoryIds: string[]; branchIds: string[];
  basis: Basis; damruPerUnit: string;
  tiers: { minAmount: string; damru: string }[]; tierMode: TierMode; baseRewardBehavior: BaseBehavior;
  maxDamruPerOrder: string; includeInCampaignBase: boolean; startsAt: string; endsAt: string;
}
interface AppliedRule { ruleId: string; code: string; name: string; amount: number; lines?: { menuItemId: string | null; qty: number; amount: number }[]; matchedTiers?: { minAmount: number; damru: number; amount: number }[] }
interface PreviewResult {
  evaluation: {
    baseReward: { amount: number; computedAmount: number; replacedByRuleId: string | null; rupeesPerDamru: number; enabled: boolean };
    itemRewards: AppliedRule[]; categoryRewards: AppliedRule[]; orderValueRewards: AppliedRule[]; totalDamru: number; campaignBase: number;
  };
  totalValue: number;
}

const TABS: { key: RuleType; label: string; icon: typeof Tag }[] = [
  { key: "ITEM", label: "Dish Rewards", icon: UtensilsCrossed },
  { key: "CATEGORY", label: "Category Rewards", icon: Tag },
  { key: "ORDER_VALUE_TIER", label: "Order Value Rewards", icon: Layers },
];
const BASIS_LABEL: Record<Basis, string> = { PER_UNIT: "Per unit", PER_LINE: "Per line", PER_ORDER: "Per order" };
const BASIS_HELP: Record<Basis, string> = {
  PER_UNIT: "Every unit earns it — quantity 2 earns 2×.",
  PER_LINE: "Once per cart line, whatever the quantity.",
  PER_ORDER: "Once per order, however many matching dishes.",
};
const MODE_LABEL: Record<TierMode, string> = { HIGHEST_MATCH: "Highest match", CUMULATIVE: "Cumulative", SLAB: "Slab" };
const MODE_HELP: Record<TierMode, string> = {
  HIGHEST_MATCH: "Only the highest tier reached is awarded. ₹1,200 with ₹500→50 and ₹1,000→120 earns 120.",
  CUMULATIVE: "Every tier reached is added up. ₹1,200 with ₹500→50 and ₹1,000→120 earns 170.",
  SLAB: "Each tier's Damru is earned per ₹100 spent inside its band (from its bill up to the next tier's bill).",
};
const STATUS_STYLE: Record<RuleStatus, { bg: string; color: string }> = {
  DRAFT: { bg: "#f3f4f6", color: "#374151" }, ACTIVE: { bg: "#dcfce7", color: "#15803d" },
  PAUSED: { bg: "#fef3c7", color: "#b45309" }, ARCHIVED: { bg: "#f3f4f6", color: "#9ca3af" },
};

const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", fontFamily: "DM Sans, sans-serif", display: "block", marginBottom: 4 };
const hint: React.CSSProperties = { fontSize: "0.72rem", color: "#6b7280", fontFamily: "DM Sans, sans-serif", margin: "4px 0 0", lineHeight: 1.45 };
const btn: React.CSSProperties = { border: "1.5px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#374151" };
const primary: React.CSSProperties = { ...btn, background: "#f97316", borderColor: "#f97316", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function emptyForm(ruleType: RuleType): RuleForm {
  return {
    name: "", code: "", description: "", ruleType,
    menuItemIds: [], categoryIds: [], branchIds: [],
    basis: "PER_UNIT", damruPerUnit: "",
    tiers: [{ minAmount: "500", damru: "50" }, { minAmount: "1000", damru: "120" }],
    tierMode: "HIGHEST_MATCH", baseRewardBehavior: "ADD",
    maxDamruPerOrder: "", includeInCampaignBase: false, startsAt: "", endsAt: "",
  };
}

function formFromRule(rule: EarnRuleRow): RuleForm {
  return {
    _id: rule._id, version: rule.version, status: rule.status,
    name: rule.name, code: rule.code, description: rule.description || "", ruleType: rule.ruleType,
    menuItemIds: rule.menuItemIds.map(String), categoryIds: rule.categoryIds.map(String), branchIds: rule.branchIds.map(String),
    basis: rule.basis ?? "PER_UNIT", damruPerUnit: rule.damruPerUnit ? String(rule.damruPerUnit) : "",
    tiers: rule.tiers.map(t => ({ minAmount: String(t.minAmount), damru: String(t.damru) })),
    tierMode: rule.tierMode ?? "HIGHEST_MATCH", baseRewardBehavior: rule.baseRewardBehavior ?? "ADD",
    maxDamruPerOrder: rule.maxDamruPerOrder ? String(rule.maxDamruPerOrder) : "",
    includeInCampaignBase: rule.includeInCampaignBase, startsAt: toLocalInput(rule.startsAt), endsAt: toLocalInput(rule.endsAt),
  };
}

/** Sends numbers exactly as typed — the server is the validator (whole numbers, ranges, order). */
function toPayload(form: RuleForm) {
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  return {
    name: form.name, code: form.code, description: form.description, ruleType: form.ruleType,
    menuItemIds: form.ruleType === "ITEM" ? form.menuItemIds : [],
    categoryIds: form.ruleType === "CATEGORY" ? form.categoryIds : [],
    branchIds: form.branchIds,
    ...(form.ruleType === "ORDER_VALUE_TIER"
      ? { tiers: form.tiers.map(t => ({ minAmount: num(t.minAmount), damru: num(t.damru) })), tierMode: form.tierMode, baseRewardBehavior: form.baseRewardBehavior }
      : { basis: form.basis, damruPerUnit: num(form.damruPerUnit) }),
    maxDamruPerOrder: form.maxDamruPerOrder.trim() === "" ? null : num(form.maxDamruPerOrder),
    includeInCampaignBase: form.includeInCampaignBase,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  };
}

function MultiPicker({ options, selected, onChange, placeholder, disabled }: { options: Option[]; selected: string[]; onChange: (ids: string[]) => void; placeholder: string; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(options.map(o => [o._id, o])), [options]);
  const filtered = options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 80);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {selected.map(id => (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 999, padding: "2px 8px", fontSize: "0.74rem", fontFamily: "DM Sans, sans-serif" }}>
              {byId.get(id)?.name ?? "Unknown"}
              {!disabled && <button type="button" aria-label="Remove" onClick={() => toggle(id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9a3412", padding: 0, display: "flex" }}><X size={12} /></button>}
            </span>
          ))}
        </div>
      )}
      <input style={inp} value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} disabled={disabled} />
      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: 8, marginTop: 6 }}>
        {filtered.length === 0 && <p style={{ ...hint, padding: 8 }}>No matches.</p>}
        {filtered.map(o => (
          <label key={o._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif", cursor: disabled ? "default" : "pointer", color: o.isActive === false ? "#9ca3af" : "#111827" }}>
            <input type="checkbox" checked={selected.includes(o._id)} disabled={disabled} onChange={() => toggle(o._id)} />
            {o.name}{o.isActive === false ? " (inactive)" : ""}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function EarnRulesClient({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const toast = useToast();
  const confirmAction = useAdminConfirm();
  const [tab, setTab] = useState<RuleType>("ITEM");
  const [rules, setRules] = useState<EarnRuleRow[]>([]);
  const [options, setOptions] = useState<Options>({ menuItems: [], categories: [], branches: [] });
  const [baseInfo, setBaseInfo] = useState<{ rupeesPerDamru: number; enabled: boolean; paisePerDamru: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<RuleForm | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sampleValue, setSampleValue] = useState("1200");
  const [sampleDish, setSampleDish] = useState("");
  const [sampleQty, setSampleQty] = useState("1");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [rulesRes, configRes] = await Promise.all([fetch("/api/admin/rewards/earn-rules?withOptions=1"), fetch("/api/admin/rewards/config")]);
      const rulesData = await rulesRes.json();
      const configData = await configRes.json();
      if (!rulesRes.ok) throw new Error(rulesData.error || "Could not load earn rules.");
      setRules(rulesData.rules || []);
      if (rulesData.options) setOptions(rulesData.options);
      if (configData.config) setBaseInfo({ ...configData.config.orderEarn, paisePerDamru: configData.config.paisePerDamru });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load earn rules.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const names = useMemo(() => ({
    menu: new Map(options.menuItems.map(o => [o._id, o.name])),
    category: new Map(options.categories.map(o => [o._id, o.name])),
    branch: new Map(options.branches.map(o => [o._id, o.name])),
  }), [options]);

  const visible = rules.filter(r => r.ruleType === tab && (showArchived || r.status !== "ARCHIVED"));
  const listNames = (ids: string[], map: Map<string, string>) => {
    const shown = ids.slice(0, 3).map(id => map.get(String(id)) ?? "Unknown");
    return ids.length > 3 ? `${shown.join(", ")} +${ids.length - 3}` : shown.join(", ");
  };

  function openCreate() { setForm(emptyForm(tab)); setFormError(""); setPreview(null); setPreviewError(""); }
  function openEdit(rule: EarnRuleRow) { setForm(formFromRule(rule)); setFormError(""); setPreview(null); setPreviewError(""); }
  const patchForm = (patch: Partial<RuleForm>) => setForm(prev => prev ? { ...prev, ...patch } : prev);
  const patchTier = (index: number, patch: Partial<RuleForm["tiers"][number]>) =>
    setForm(prev => prev ? { ...prev, tiers: prev.tiers.map((t, i) => i === index ? { ...t, ...patch } : t) } : prev);
  const moveTier = (index: number, dir: -1 | 1) => setForm(prev => {
    if (!prev) return prev;
    const tiers = [...prev.tiers];
    const target = index + dir;
    if (target < 0 || target >= tiers.length) return prev;
    [tiers[index], tiers[target]] = [tiers[target], tiers[index]];
    return { ...prev, tiers };
  });

  async function save(activate: boolean) {
    if (!form) return;
    if (activate && !(await confirmAction({ title: "Activate this rule?", description: "Delivered orders will start earning Damru from this rule immediately.", confirmLabel: "Save & activate" }))) return;
    setSaving(true); setFormError("");
    try {
      const payload = { ...toPayload(form), status: activate ? "ACTIVE" : (form.status && form.status !== "ARCHIVED" ? form.status : "DRAFT"), ...(form._id ? { version: form.version } : {}) };
      const res = await fetch(form._id ? `/api/admin/rewards/earn-rules/${form._id}` : "/api/admin/rewards/earn-rules", {
        method: form._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Could not save the rule."); return; }
      toast.success(form._id ? "Earn rule updated" : "Earn rule created", activate ? "The rule is now active." : undefined);
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(rule: EarnRuleRow, status: RuleStatus) {
    if (status === "ACTIVE" && !(await confirmAction({ title: `Activate ${rule.code}?`, description: "Delivered orders will start earning Damru from this rule immediately.", confirmLabel: "Activate" }))) return;
    if (status === "ARCHIVED" && !(await confirmAction({ title: `Archive ${rule.code}?`, description: "The rule stops awarding Damru and can't be edited again. Past credits stay on the ledger.", confirmLabel: "Archive" }))) return;
    setBusyId(rule._id);
    try {
      const res = await fetch(`/api/admin/rewards/earn-rules/${rule._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, version: rule.version }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Could not update the rule", data.error); return; }
      toast.success(`Rule ${status === "ACTIVE" ? "activated" : status === "PAUSED" ? "paused" : "archived"}`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runPreview() {
    if (!form) return;
    setPreviewing(true); setPreviewError("");
    try {
      const items = sampleDish ? [{ menuItemId: sampleDish, qty: Number(sampleQty) || 1 }] : [];
      const res = await fetch("/api/admin/rewards/earn-rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: toPayload(form), ruleId: form._id, orderValue: Number(sampleValue), items }),
      });
      const data = await res.json();
      if (!res.ok) { setPreview(null); setPreviewError(data.error || "Could not calculate a preview."); return; }
      setPreview(data);
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) return <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>;

  const sampleDishOptions = form?.ruleType === "ITEM" && form.menuItemIds.length
    ? form.menuItemIds.map(id => ({ _id: id, name: names.menu.get(id) ?? "Unknown" }))
    : form?.ruleType === "CATEGORY" && form.categoryIds.length
      ? options.menuItems.filter(m => m.category && form.categoryIds.includes(m.category))
      : options.menuItems;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {loadError && <div style={{ padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem" }}>{loadError}</div>}

      {baseInfo && (
        <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>Base order reward</p>
            <p style={{ ...hint, margin: "2px 0 0" }}>
              {baseInfo.enabled ? `1 Damru for every ₹${baseInfo.rupeesPerDamru} of eligible spend (subtotal after coupon), on every delivered order.` : "Off — orders earn only from the rules below."}
              {" "}Rules below add to it; an order-value rule can instead replace it.
            </p>
          </div>
          <a href="/admin/rewards" style={{ ...btn, textDecoration: "none" }}>Edit in Damru Configuration</a>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setForm(null); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", fontWeight: 600, color: tab === t.key ? "#f97316" : "#6b7280", borderBottom: tab === t.key ? "2px solid #f97316" : "2px solid transparent" }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "#374151" }}>
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
            </label>
            {canCreate && !form && <button style={primary} onClick={openCreate}><Plus size={14} /> Create rule</button>}
          </div>

          {form && (
            <section style={{ border: "1.5px solid #fed7aa", borderRadius: 12, padding: 18, marginBottom: 18, background: "#fffdf9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ margin: 0, fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem" }}>
                  {form._id ? `Edit ${form.code}` : `New ${TABS.find(t => t.key === form.ruleType)?.label.replace(/s$/, "").toLowerCase()}`}
                </p>
                <button style={btn} onClick={() => setForm(null)}><X size={13} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div><label style={lbl}>Rule name</label><input style={inp} value={form.name} maxLength={120} onChange={e => patchForm({ name: e.target.value })} placeholder="Biryani reward" /></div>
                <div><label style={lbl}>Rule code</label><input style={inp} value={form.code} maxLength={40} onChange={e => patchForm({ code: e.target.value.toUpperCase() })} placeholder="BIRYANI-20" /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Description (optional)</label><input style={inp} value={form.description} maxLength={500} onChange={e => patchForm({ description: e.target.value })} /></div>
              </div>

              {form.ruleType !== "ORDER_VALUE_TIER" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={lbl}>{form.ruleType === "ITEM" ? "Dishes" : "Categories"}</label>
                    {form.ruleType === "ITEM"
                      ? <MultiPicker options={options.menuItems} selected={form.menuItemIds} onChange={ids => patchForm({ menuItemIds: ids })} placeholder="Search dishes…" />
                      : <MultiPicker options={options.categories} selected={form.categoryIds} onChange={ids => patchForm({ categoryIds: ids })} placeholder="Search categories…" />}
                    <p style={hint}>A dish rule wins over a category rule for the same dish. Variants and add-ons don&apos;t change the reward.</p>
                  </div>
                  <div>
                    <label style={lbl}>Damru reward</label>
                    <input type="number" min={1} step={1} style={inp} value={form.damruPerUnit} onChange={e => patchForm({ damruPerUnit: e.target.value })} placeholder="20" />
                  </div>
                  <div>
                    <label style={lbl}>Reward basis</label>
                    <select style={inp} value={form.basis} onChange={e => patchForm({ basis: e.target.value as Basis })}>
                      {(Object.keys(BASIS_LABEL) as Basis[]).map(b => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                    </select>
                    <p style={hint}>{BASIS_HELP[form.basis]}</p>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <label style={lbl}>Tiers (eligible bill = subtotal after coupon)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {form.tiers.map((t, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                        <input type="number" min={1} step={1} style={inp} value={t.minAmount} onChange={e => patchTier(i, { minAmount: e.target.value })} placeholder="Minimum bill ₹" aria-label={`Tier ${i + 1} minimum bill`} />
                        <input type="number" min={0} step={1} style={inp} value={t.damru} onChange={e => patchTier(i, { damru: e.target.value })} placeholder={form.tierMode === "SLAB" ? "Damru per ₹100" : "Damru"} aria-label={`Tier ${i + 1} Damru`} />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" style={btn} onClick={() => moveTier(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={13} /></button>
                          <button type="button" style={btn} onClick={() => moveTier(i, 1)} disabled={i === form.tiers.length - 1} aria-label="Move down"><ArrowDown size={13} /></button>
                          <button type="button" style={btn} onClick={() => patchForm({ tiers: form.tiers.filter((_, j) => j !== i) })} disabled={form.tiers.length === 1} aria-label="Delete tier"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" style={btn} onClick={() => patchForm({ tiers: [...form.tiers, { minAmount: "", damru: "" }] })} disabled={form.tiers.length >= 20}><Plus size={12} /> Add tier</button>
                    <button type="button" style={btn} onClick={() => patchForm({ tiers: [...form.tiers].sort((a, b) => Number(a.minAmount) - Number(b.minAmount)) })}>Sort by bill</button>
                  </div>
                  <p style={hint}>Bills must be whole rupees, lowest first, no duplicates.{form.tierMode === "SLAB" ? " In slab mode each tier's value is Damru per ₹100 inside its band." : ""}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={lbl}>Tier mode</label>
                      <select style={inp} value={form.tierMode} onChange={e => patchForm({ tierMode: e.target.value as TierMode })}>
                        {(Object.keys(MODE_LABEL) as TierMode[]).map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                      </select>
                      <p style={hint}>{MODE_HELP[form.tierMode]}</p>
                    </div>
                    <div>
                      <label style={lbl}>With the base order reward</label>
                      <select style={inp} value={form.baseRewardBehavior} onChange={e => patchForm({ baseRewardBehavior: e.target.value as BaseBehavior })}>
                        <option value="ADD">Add to base reward</option>
                        <option value="REPLACE">Replace base reward</option>
                      </select>
                      <p style={hint}>{form.baseRewardBehavior === "ADD" ? "A ₹1,000 order earns its base reward plus the tier." : "When a tier is reached, the order earns the tier instead of the base reward."}</p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Branches</label>
                  <MultiPicker options={options.branches} selected={form.branchIds} onChange={ids => patchForm({ branchIds: ids })} placeholder="All branches (search to limit)" />
                  <p style={hint}>Leave empty for every branch. Dine-in orders have no branch, so branch-limited rules only apply to delivery orders. Menu badges only show for all-branch rules.</p>
                </div>
                <div><label style={lbl}>Starts (optional)</label><input type="datetime-local" style={inp} value={form.startsAt} onChange={e => patchForm({ startsAt: e.target.value })} /></div>
                <div><label style={lbl}>Ends (optional)</label><input type="datetime-local" style={inp} value={form.endsAt} onChange={e => patchForm({ endsAt: e.target.value })} /></div>
                <div><label style={lbl}>Maximum Damru per order (optional)</label><input type="number" min={1} step={1} style={inp} value={form.maxDamruPerOrder} onChange={e => patchForm({ maxDamruPerOrder: e.target.value })} placeholder="No cap" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "#374151", alignSelf: "end", paddingBottom: 8 }}>
                  <input type="checkbox" checked={form.includeInCampaignBase} onChange={e => patchForm({ includeInCampaignBase: e.target.checked })} />
                  Campaign multipliers also apply to this rule
                </label>
              </div>
              <p style={hint}>Schedules follow the time the order is delivered. The whole reward is credited on delivery and reversed if the order is cancelled, fully refunded, or its COD payment fails.</p>

              <div style={{ marginTop: 16, border: "1px dashed #fdba74", borderRadius: 10, padding: 14, background: "#fff" }}>
                <p style={{ margin: "0 0 10px", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 6 }}><Calculator size={14} /> Preview (server calculation, nothing is saved)</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
                  <div><label style={lbl}>Sample order value (₹)</label><input type="number" min={0} style={inp} value={sampleValue} onChange={e => setSampleValue(e.target.value)} /></div>
                  <div>
                    <label style={lbl}>Sample dish (optional)</label>
                    <select style={inp} value={sampleDish} onChange={e => setSampleDish(e.target.value)}>
                      <option value="">No dish</option>
                      {sampleDishOptions.slice(0, 200).map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Quantity</label><input type="number" min={1} max={99} style={inp} value={sampleQty} onChange={e => setSampleQty(e.target.value)} /></div>
                  <button type="button" style={primary} onClick={runPreview} disabled={previewing}>{previewing ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Calculator size={13} />} Calculate</button>
                </div>
                {previewError && <p style={{ ...hint, color: "#dc2626" }}>{previewError}</p>}
                {preview && (
                  <div style={{ marginTop: 12, fontFamily: "DM Sans, sans-serif", fontSize: "0.82rem" }}>
                    <p style={{ margin: "0 0 6px" }}>Order value: <b>{rupees(Number(sampleValue) || 0)}</b></p>
                    <PreviewRow label="Base reward" value={preview.evaluation.baseReward.amount} note={preview.evaluation.baseReward.replacedByRuleId ? `replaced by order tier (would be ${preview.evaluation.baseReward.computedAmount})` : preview.evaluation.baseReward.enabled ? undefined : "base reward is off"} />
                    {preview.evaluation.orderValueRewards.map(r => <PreviewRow key={r.ruleId} label={`Order tier · ${r.code}`} value={r.amount} />)}
                    {preview.evaluation.itemRewards.map(r => <PreviewRow key={r.ruleId} label={`Dish reward · ${r.code}`} value={r.amount} />)}
                    {preview.evaluation.categoryRewards.map(r => <PreviewRow key={r.ruleId} label={`Category reward · ${r.code}`} value={r.amount} />)}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6, fontWeight: 700 }}>
                      <span>Estimated total</span><span>{preview.evaluation.totalDamru} Damru · ≈ ₹{preview.totalValue.toLocaleString("en-IN")}</span>
                    </div>
                    <p style={hint}>Includes every other active rule. Campaign bonuses and daily limits depend on the customer and aren&apos;t shown.</p>
                  </div>
                )}
              </div>

              {formError && <p style={{ color: "#dc2626", fontSize: "0.82rem", fontFamily: "DM Sans, sans-serif", margin: "12px 0 0" }}>{formError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button style={btn} onClick={() => setForm(null)} disabled={saving}>Cancel</button>
                {(form._id ? canEdit : canCreate) && <button style={btn} onClick={() => save(false)} disabled={saving}><Save size={13} /> {form._id ? "Save changes" : "Save as draft"}</button>}
                {canEdit && form.status !== "ACTIVE" && <button style={primary} onClick={() => save(true)} disabled={saving}>{saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Save &amp; activate</button>}
              </div>
            </section>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb", color: "#6b7280", textAlign: "left" }}>
                  {["Rule", tab === "ORDER_VALUE_TIER" ? "Tiers" : tab === "ITEM" ? "Dishes" : "Categories", "Reward", "Branches", "Schedule", "Status", ""].map(h => <th key={h} style={{ padding: "9px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No {TABS.find(t => t.key === tab)?.label.toLowerCase()} yet.</td></tr>
                )}
                {visible.map(rule => (
                  <tr key={rule._id} style={{ borderTop: "1px solid #f3f4f6", verticalAlign: "top" }}>
                    <td style={{ padding: 10 }}><b>{rule.name}</b><small style={{ display: "block", color: "#9ca3af" }}>{rule.code} · v{rule.version}</small></td>
                    <td style={{ padding: 10, maxWidth: 260 }}>
                      {rule.ruleType === "ITEM" && listNames(rule.menuItemIds, names.menu)}
                      {rule.ruleType === "CATEGORY" && listNames(rule.categoryIds, names.category)}
                      {rule.ruleType === "ORDER_VALUE_TIER" && [...rule.tiers].sort((a, b) => a.minAmount - b.minAmount).map(t => `${rupees(t.minAmount)} → ${t.damru}`).join(" · ")}
                    </td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {rule.ruleType === "ORDER_VALUE_TIER"
                        ? <>{MODE_LABEL[rule.tierMode ?? "HIGHEST_MATCH"]}<small style={{ display: "block", color: "#9ca3af" }}>{rule.baseRewardBehavior === "REPLACE" ? "Replaces base" : "Adds to base"}</small></>
                        : <>{rule.damruPerUnit} Damru<small style={{ display: "block", color: "#9ca3af" }}>{BASIS_LABEL[rule.basis ?? "PER_UNIT"]}</small></>}
                      {rule.maxDamruPerOrder ? <small style={{ display: "block", color: "#9ca3af" }}>Max {rule.maxDamruPerOrder}/order</small> : null}
                    </td>
                    <td style={{ padding: 10 }}>{rule.branchIds.length ? listNames(rule.branchIds, names.branch) : "All"}</td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {rule.startsAt || rule.endsAt
                        ? <>{rule.startsAt ? new Date(rule.startsAt).toLocaleString("en-IN") : "—"}<small style={{ display: "block", color: "#9ca3af" }}>to {rule.endsAt ? new Date(rule.endsAt).toLocaleString("en-IN") : "no end"}</small></>
                        : "Always"}
                    </td>
                    <td style={{ padding: 10 }}><span style={{ background: STATUS_STYLE[rule.status].bg, color: STATUS_STYLE[rule.status].color, padding: "2px 8px", borderRadius: 999, fontWeight: 600, fontSize: "0.72rem" }}>{rule.status}</span></td>
                    <td style={{ padding: 10 }}>
                      {canEdit && rule.status !== "ARCHIVED" && (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button style={btn} onClick={() => openEdit(rule)} disabled={busyId === rule._id}>Edit</button>
                          {rule.status !== "ACTIVE" && <button style={btn} onClick={() => changeStatus(rule, "ACTIVE")} disabled={busyId === rule._id}>Activate</button>}
                          {rule.status === "ACTIVE" && <button style={btn} onClick={() => changeStatus(rule, "PAUSED")} disabled={busyId === rule._id}>Pause</button>}
                          <button style={{ ...btn, color: "#b91c1c" }} onClick={() => changeStatus(rule, "ARCHIVED")} disabled={busyId === rule._id}>Archive</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span>{label}{note ? <small style={{ color: "#9ca3af" }}> — {note}</small> : null}</span>
      <span>{value} Damru</span>
    </div>
  );
}
