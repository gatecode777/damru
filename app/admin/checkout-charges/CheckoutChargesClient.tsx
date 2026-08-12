"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, History, Loader2, Plus, ReceiptIndianRupee, Save, Settings2, Trash2, Truck } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { getAdminResponseError } from "@/lib/admin-error";

type Slab = { min: number; max: number | null; fee: number };
type BranchRule = { branchId: string; fee: number; freeDeliveryThreshold: number | null };
type Config = {
  version: string;
  tax: { enabled: boolean; name: string; code: string; calculationType: "PERCENTAGE" | "FIXED"; rate: number; fixedAmount: number; applyOn: "MERCHANDISE_SUBTOTAL" | "AFTER_DISCOUNTS"; taxDeliveryFee: boolean };
  delivery: { enabled: boolean; mode: "FLAT" | "ORDER_VALUE" | "DISTANCE" | "BRANCH_BASED"; flatFee: number; freeDeliveryThreshold: number | null; minimumOrder: number; maximumDistanceKm: number | null; orderValueSlabs: Slab[]; distanceSlabs: Slab[]; branchRules: BranchRule[] };
  currency: "INR";
};
type Branch = { _id: string; name: string; latitude?: number; longitude?: number };
type Audit = { _id: string; action: string; actorEmail: string; summary: string; createdAt: string };
type Totals = { subtotal: number; couponDiscount: number; eligibleSubtotal: number; deliveryFee: number; taxAmount: number; damruDiscount: number; finalAmount: number; appliedDeliveryRule: string };

const tabs = [
  { id: "tax", label: "Tax Rules", icon: ReceiptIndianRupee },
  { id: "delivery", label: "Delivery Rules", icon: Truck },
  { id: "configuration", label: "Configuration", icon: Settings2 },
  { id: "history", label: "Change History", icon: History },
] as const;

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={`cc-toggle${checked ? " active" : ""}`} aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

function MoneyInput({ value, onChange, disabled }: { value: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  return <div className="cc-money"><span>₹</span><input type="number" min="0" step="0.01" value={value ?? ""} disabled={disabled} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} /></div>;
}

export default function CheckoutChargesClient({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("tax");
  const [config, setConfig] = useState<Config | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewInput, setPreviewInput] = useState({ subtotal: 500, couponDiscount: 50, damruDiscount: 0, orderType: "delivery", branchId: "", distanceKm: 5 });
  const [preview, setPreview] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/checkout-charges", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load checkout charges.");
      setConfig(data.config); setBranches(data.branches || []); setHistory(data.history || []);
    } catch (error) { toast.error("Unable to load checkout charges", error instanceof Error ? error.message : "Please try again."); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  function updateTax<K extends keyof Config["tax"]>(key: K, value: Config["tax"][K]) { setConfig(current => current ? { ...current, tax: { ...current.tax, [key]: value } } : current); }
  function updateDelivery<K extends keyof Config["delivery"]>(key: K, value: Config["delivery"][K]) { setConfig(current => current ? { ...current, delivery: { ...current.delivery, [key]: value } } : current); }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/checkout-charges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      if (!response.ok) { toast.error("Unable to update checkout charges", await getAdminResponseError(response, "Check the entered rules and try again.")); return; }
      const data = await response.json(); setConfig(data.config); toast.success("Checkout charges updated successfully"); await load();
    } catch { toast.error("Unable to update checkout charges", "Check your connection and try again."); }
    finally { setSaving(false); }
  }

  async function calculatePreview() {
    setPreviewing(true);
    try {
      const response = await fetch("/api/admin/checkout-charges/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(previewInput) });
      const data = await response.json();
      if (!response.ok) { toast.error("Preview unavailable", data.error || "Check the preview values."); return; }
      setPreview(data.totals);
    } catch { toast.error("Preview unavailable", "Please try again."); }
    finally { setPreviewing(false); }
  }

  function updateSlab(kind: "orderValueSlabs" | "distanceSlabs", index: number, key: keyof Slab, value: number | null) {
    if (!config) return;
    const rows = config.delivery[kind].map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
    updateDelivery(kind, rows);
  }

  if (loading || !config) return <div className="cc-loading"><Loader2 className="spin" /> Loading checkout rules…</div>;
  const relevantSlabs = config.delivery.mode === "DISTANCE" ? "distanceSlabs" : "orderValueSlabs";

  return <div className="cc-shell">
    <header className="cc-hero"><div><span className="cc-eyebrow">SYSTEM / COMMERCE</span><h1>Tax & Delivery</h1><p>One authoritative configuration for website, mobile, COD, and Razorpay orders.</p></div><button className="cc-save" onClick={save} disabled={!canEdit || saving}>{saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save configuration</button></header>
    <nav className="cc-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><Icon size={16} />{label}</button>)}</nav>

    {active === "tax" && <section className="cc-grid"><div className="cc-card cc-card-main"><h2>Tax rule</h2><p className="cc-muted">A single default rule is applied deterministically to new orders.</p>
      <label className="cc-row"><span><b>Tax enabled</b><small>Disabled means tax is exactly ₹0.</small></span><Toggle checked={config.tax.enabled} disabled={!canEdit} onChange={value => updateTax("enabled", value)} /></label>
      <div className="cc-fields"><label>Tax name<input value={config.tax.name} disabled={!canEdit} onChange={e => updateTax("name", e.target.value)} /></label><label>Tax code<input value={config.tax.code} disabled={!canEdit} onChange={e => updateTax("code", e.target.value)} /></label>
      <label>Calculation<select value={config.tax.calculationType} disabled={!canEdit} onChange={e => updateTax("calculationType", e.target.value as Config["tax"]["calculationType"])}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed per order</option></select></label>
      <label>{config.tax.calculationType === "PERCENTAGE" ? "Rate (%)" : "Fixed amount"}<input type="number" min="0" step="0.01" value={config.tax.calculationType === "PERCENTAGE" ? config.tax.rate : config.tax.fixedAmount} disabled={!canEdit} onChange={e => updateTax(config.tax.calculationType === "PERCENTAGE" ? "rate" : "fixedAmount", Number(e.target.value))} /></label>
      <label>Apply tax on<select value={config.tax.applyOn} disabled={!canEdit} onChange={e => updateTax("applyOn", e.target.value as Config["tax"]["applyOn"])}><option value="AFTER_DISCOUNTS">After discounts</option><option value="MERCHANDISE_SUBTOTAL">Merchandise subtotal</option></select></label></div>
      <label className="cc-row"><span><b>Apply tax on delivery fee</b><small>Adds delivery to the taxable base.</small></span><Toggle checked={config.tax.taxDeliveryFee} disabled={!canEdit} onChange={value => updateTax("taxDeliveryFee", value)} /></label>
    </div><PreviewCard values={previewInput} setValues={setPreviewInput} branches={branches} busy={previewing} result={preview} calculate={calculatePreview} /></section>}

    {active === "delivery" && <section className="cc-grid"><div className="cc-card cc-card-main"><h2>Delivery rules</h2><p className="cc-muted">Charges apply only to delivery orders. Dine-in remains free.</p>
      <label className="cc-row"><span><b>Delivery charges enabled</b><small>When disabled, delivery fee is ₹0.</small></span><Toggle checked={config.delivery.enabled} disabled={!canEdit} onChange={value => updateDelivery("enabled", value)} /></label>
      <div className="cc-fields"><label>Mode<select value={config.delivery.mode} disabled={!canEdit} onChange={e => updateDelivery("mode", e.target.value as Config["delivery"]["mode"])}><option value="FLAT">Flat</option><option value="ORDER_VALUE">Order value</option><option value="BRANCH_BASED">Branch based</option><option value="DISTANCE">Distance</option></select></label><label>Default flat fee<MoneyInput value={config.delivery.flatFee} disabled={!canEdit} onChange={value => updateDelivery("flatFee", value || 0)} /></label><label>Free delivery above<MoneyInput value={config.delivery.freeDeliveryThreshold} disabled={!canEdit} onChange={value => updateDelivery("freeDeliveryThreshold", value)} /></label><label>Minimum delivery order<MoneyInput value={config.delivery.minimumOrder} disabled={!canEdit} onChange={value => updateDelivery("minimumOrder", value || 0)} /></label></div>
      {config.delivery.mode === "DISTANCE" && <label className="cc-distance">Maximum distance (km)<input type="number" min="0" step="0.1" value={config.delivery.maximumDistanceKm ?? ""} disabled={!canEdit} onChange={e => updateDelivery("maximumDistanceKm", e.target.value === "" ? null : Number(e.target.value))} /></label>}
      {(config.delivery.mode === "ORDER_VALUE" || config.delivery.mode === "DISTANCE") && <RuleTable title={config.delivery.mode === "DISTANCE" ? "Distance slabs (km)" : "Order-value slabs (₹)"} rows={config.delivery[relevantSlabs]} disabled={!canEdit} update={(index, key, value) => updateSlab(relevantSlabs, index, key, value)} add={() => updateDelivery(relevantSlabs, [...config.delivery[relevantSlabs], { min: 0, max: null, fee: 0 }])} remove={index => updateDelivery(relevantSlabs, config.delivery[relevantSlabs].filter((_, i) => i !== index))} />}
      {config.delivery.mode === "BRANCH_BASED" && <div className="cc-rules"><div className="cc-rules-head"><h3>Branch rules</h3><button disabled={!canEdit} onClick={() => updateDelivery("branchRules", [...config.delivery.branchRules, { branchId: branches[0]?._id || "", fee: 0, freeDeliveryThreshold: null }])}><Plus size={14} /> Add branch</button></div>{config.delivery.branchRules.map((rule, index) => <div className="cc-branch-row" key={`${rule.branchId}-${index}`}><select value={rule.branchId} disabled={!canEdit} onChange={e => updateDelivery("branchRules", config.delivery.branchRules.map((item, i) => i === index ? { ...item, branchId: e.target.value } : item))}>{branches.map(branch => <option value={branch._id} key={branch._id}>{branch.name}</option>)}</select><MoneyInput value={rule.fee} disabled={!canEdit} onChange={value => updateDelivery("branchRules", config.delivery.branchRules.map((item, i) => i === index ? { ...item, fee: value || 0 } : item))} /><MoneyInput value={rule.freeDeliveryThreshold} disabled={!canEdit} onChange={value => updateDelivery("branchRules", config.delivery.branchRules.map((item, i) => i === index ? { ...item, freeDeliveryThreshold: value } : item))} /><button className="cc-icon-danger" disabled={!canEdit} onClick={() => updateDelivery("branchRules", config.delivery.branchRules.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}</div>}
    </div><PreviewCard values={previewInput} setValues={setPreviewInput} branches={branches} busy={previewing} result={preview} calculate={calculatePreview} /></section>}

    {active === "configuration" && <section className="cc-card"><h2>General configuration</h2><div className="cc-summary"><Summary label="Tax" value={config.tax.enabled ? `${config.tax.name} · ${config.tax.calculationType === "PERCENTAGE" ? `${config.tax.rate}%` : `₹${config.tax.fixedAmount}`}` : "Disabled"} /><Summary label="Tax basis" value={config.tax.applyOn.replaceAll("_", " ")} /><Summary label="Tax delivery" value={config.tax.taxDeliveryFee ? "Yes" : "No"} /><Summary label="Delivery" value={config.delivery.enabled ? config.delivery.mode.replaceAll("_", " ") : "Disabled"} /><Summary label="Free above" value={config.delivery.freeDeliveryThreshold === null ? "Not configured" : `₹${config.delivery.freeDeliveryThreshold}`} /><Summary label="Minimum order" value={`₹${config.delivery.minimumOrder}`} /><Summary label="Currency" value={config.currency} /><Summary label="Version" value={config.version} /></div></section>}
    {active === "history" && <section className="cc-card"><h2>Change history</h2>{history.length === 0 ? <p className="cc-empty">No configuration changes recorded yet.</p> : <div className="cc-history">{history.map(row => <article key={row._id}><span className="cc-history-dot" /><div><b>{row.summary}</b><p>{row.actorEmail} · {new Date(row.createdAt).toLocaleString("en-IN")}</p></div></article>)}</div>}</section>}
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

function RuleTable({ title, rows, disabled, update, add, remove }: { title: string; rows: Slab[]; disabled: boolean; update: (index: number, key: keyof Slab, value: number | null) => void; add: () => void; remove: (index: number) => void }) {
  return <div className="cc-rules"><div className="cc-rules-head"><h3>{title}</h3><button disabled={disabled} onClick={add}><Plus size={14} /> Add row</button></div><div className="cc-slab-head"><span>From</span><span>To</span><span>Fee</span><span /></div>{rows.map((row, index) => <div className="cc-slab-row" key={index}><input type="number" min="0" step="0.01" value={row.min} disabled={disabled} onChange={e => update(index, "min", Number(e.target.value))} /><input type="number" min="0" step="0.01" placeholder="No limit" value={row.max ?? ""} disabled={disabled} onChange={e => update(index, "max", e.target.value === "" ? null : Number(e.target.value))} /><MoneyInput value={row.fee} disabled={disabled} onChange={value => update(index, "fee", value || 0)} /><button className="cc-icon-danger" disabled={disabled} onClick={() => remove(index)}><Trash2 size={15} /></button></div>)}</div>;
}

function PreviewCard({ values, setValues, branches, busy, result, calculate }: { values: { subtotal: number; couponDiscount: number; damruDiscount: number; orderType: string; branchId: string; distanceKm: number }; setValues: React.Dispatch<React.SetStateAction<typeof values>>; branches: Branch[]; busy: boolean; result: Totals | null; calculate: () => void }) {
  return <aside className="cc-card cc-preview"><div className="cc-preview-title"><Calculator size={18} /><div><h2>Preview calculator</h2><p>Uses the saved backend rules.</p></div></div><label>Merchandise subtotal<MoneyInput value={values.subtotal} onChange={value => setValues(current => ({ ...current, subtotal: value || 0 }))} /></label><label>Coupon discount<MoneyInput value={values.couponDiscount} onChange={value => setValues(current => ({ ...current, couponDiscount: value || 0 }))} /></label><label>Damru discount<MoneyInput value={values.damruDiscount} onChange={value => setValues(current => ({ ...current, damruDiscount: value || 0 }))} /></label><label>Order type<select value={values.orderType} onChange={e => setValues(current => ({ ...current, orderType: e.target.value }))}><option value="delivery">Delivery</option><option value="dine_in">Dine-in</option></select></label><label>Branch<select value={values.branchId} onChange={e => setValues(current => ({ ...current, branchId: e.target.value }))}><option value="">Default policy</option>{branches.map(branch => <option value={branch._id} key={branch._id}>{branch.name}</option>)}</select></label><label>Distance (km)<input type="number" min="0" step="0.1" value={values.distanceKm} onChange={e => setValues(current => ({ ...current, distanceKm: Number(e.target.value) }))} /></label><button className="cc-preview-btn" onClick={calculate} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Calculator size={15} />} Calculate</button>{result && <div className="cc-result"><Summary label="Subtotal" value={`₹${result.subtotal}`} /><Summary label="Coupon" value={`−₹${result.couponDiscount}`} /><Summary label="Delivery" value={result.deliveryFee === 0 ? "FREE" : `₹${result.deliveryFee}`} /><Summary label="Tax" value={`₹${result.taxAmount}`} /><Summary label="Damru" value={`−₹${result.damruDiscount}`} /><div className="cc-result-total"><span>Final payable</span><b>₹{result.finalAmount}</b></div><small>{result.appliedDeliveryRule}</small></div>}</aside>;
}
