"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, ChevronLeft, ChevronRight, History, Loader2, Plus, Save, Search, X } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { useAdminConfirm } from "@/components/admin/ConfirmDialog";

type Basis = "PER_UNIT" | "PER_LINE" | "PER_ORDER";
type RuleStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface DishReward {
  ruleId: string; code: string; name: string; status: RuleStatus; live: boolean;
  damruPerUnit: number; basis: Basis; branchIds: string[]; startsAt: string | null; endsAt: string | null;
  maxDamruPerOrder: number | null; version: number; sharedWith: number;
}
interface DishRow {
  _id: string; name: string; slug: string; categoryId: string; categoryName: string; price: number; dishActive: boolean;
  reward: DishReward | null; otherRules: number; categoryReward: { code: string; damruPerUnit: number; basis: string } | null;
}
interface Option { _id: string; name: string }
interface HistoryEntry { action: string; at: string; admin: string | null; version: number | null; status: string | null; damruPerUnit: number | null; basis: string | null }
interface DishForm {
  dish: { _id: string; name: string } | null;
  ruleId?: string; version?: number; currentDamru?: number | null;
  damruPerUnit: string; basis: Basis; branchIds: string[]; startsAt: string; endsAt: string;
  maxDamruPerOrder: string; status: "ACTIVE" | "DRAFT" | "PAUSED";
}

const BASIS_LABEL: Record<Basis, string> = { PER_UNIT: "Per item", PER_LINE: "Per cart line", PER_ORDER: "Once per order" };
const BASIS_HELP: Record<Basis, string> = {
  PER_UNIT: "Every unit earns it: quantity 3 earns 3×.",
  PER_LINE: "Once per cart line, whatever the quantity.",
  PER_ORDER: "Once per order, however many of this dish.",
};
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: "#dcfce7", color: "#15803d", label: "Active" },
  SCHEDULED: { bg: "#e0f2fe", color: "#0369a1", label: "Scheduled" },
  ENDED: { bg: "#f3f4f6", color: "#6b7280", label: "Ended" },
  PAUSED: { bg: "#fef3c7", color: "#b45309", label: "Paused" },
  DRAFT: { bg: "#f3f4f6", color: "#374151", label: "Draft" },
};

const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", fontFamily: "DM Sans, sans-serif", display: "block", marginBottom: 4 };
const hint: React.CSSProperties = { fontSize: "0.72rem", color: "#6b7280", fontFamily: "DM Sans, sans-serif", margin: "4px 0 0", lineHeight: 1.45 };
const btn: React.CSSProperties = { border: "1.5px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 11px", fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#374151", display: "inline-flex", alignItems: "center", gap: 5 };
const primary: React.CSSProperties = { ...btn, background: "#f97316", borderColor: "#f97316", color: "#fff" };

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const rewardStatus = (r: DishReward) => {
  if (r.status !== "ACTIVE") return r.status;
  if (r.live) return "ACTIVE";
  return r.startsAt && new Date(r.startsAt) > new Date() ? "SCHEDULED" : "ENDED";
};

function emptyForm(dish: DishForm["dish"] = null): DishForm {
  return { dish, damruPerUnit: "", basis: "PER_UNIT", branchIds: [], startsAt: "", endsAt: "", maxDamruPerOrder: "", status: "ACTIVE" };
}

function formFromRow(row: DishRow): DishForm {
  const r = row.reward!;
  return {
    dish: { _id: row._id, name: row.name }, ruleId: r.ruleId, version: r.version, currentDamru: r.damruPerUnit,
    damruPerUnit: String(r.damruPerUnit), basis: r.basis, branchIds: r.branchIds, startsAt: toLocalInput(r.startsAt), endsAt: toLocalInput(r.endsAt),
    maxDamruPerOrder: r.maxDamruPerOrder ? String(r.maxDamruPerOrder) : "", status: r.status === "ARCHIVED" ? "PAUSED" : r.status,
  };
}

/** Numbers are sent as typed; the server validates (whole numbers, ranges, conflicts). */
function toPayload(form: DishForm) {
  return {
    ruleType: "ITEM",
    menuItemIds: form.dish ? [form.dish._id] : [],
    damruPerUnit: form.damruPerUnit.trim() === "" ? NaN : Number(form.damruPerUnit),
    basis: form.basis,
    branchIds: form.branchIds,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    maxDamruPerOrder: form.maxDamruPerOrder.trim() === "" ? null : Number(form.maxDamruPerOrder),
    status: form.status,
  };
}

export default function DishRewardsClient({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const toast = useToast();
  const confirmAction = useAdminConfirm();
  const [rows, setRows] = useState<DishRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [options, setOptions] = useState<{ categories: Option[]; branches: Option[] }>({ categories: [], branches: [] });
  const [filters, setFilters] = useState({ q: "", category: "", branch: "", status: "", configured: "", sort: "name" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [baseInfo, setBaseInfo] = useState<{ rupeesPerDamru: number; enabled: boolean; dishRewardBaseBehavior: "ADD" | "REPLACE" } | null>(null);
  const [form, setForm] = useState<DishForm | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ damruPerUnit: string; basis: Basis; status: "ACTIVE" | "DRAFT" } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [preview, setPreview] = useState<{ qty: number; damru: number }[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [history, setHistory] = useState<{ dish: string; entries: HistoryEntry[] } | null>(null);
  const [dishSearch, setDishSearch] = useState("");
  const [dishMatches, setDishMatches] = useState<DishRow[]>([]);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true); setLoadError("");
    try {
      const params = new URLSearchParams({ view: "dishes", page: String(page), limit: String(limit), sort: filters.sort });
      for (const key of ["q", "category", "branch", "status", "configured"] as const) if (filters[key]) params.set(key, filters[key]);
      const res = await fetch(`/api/admin/rewards/earn-rules?${params}`);
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      if (!res.ok) throw new Error(data.error || "Could not load dishes.");
      setRows(data.rows || []); setTotal(data.total || 0);
      if (data.page && data.page !== page) setPage(data.page);
      if (data.options) setOptions(data.options);
    } catch (err) {
      if (seq === requestSeq.current) setLoadError(err instanceof Error ? err.message : "Could not load dishes.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/admin/rewards/config").then(r => r.json()).then(d => { if (d.config) setBaseInfo(d.config.orderEarn); }).catch(() => undefined);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Debounced search box → filters.q
  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => (f.q === query ? f : { ...f, q: query })); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Quantity preview (server evaluator) whenever the draft reward changes.
  useEffect(() => {
    if (!form?.dish || form.damruPerUnit.trim() === "") return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/rewards/earn-rules/preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rule: toPayload(form), ruleId: form.ruleId, orderValue: 0, quantities: [1, 2, 3] }),
        });
        const data = await res.json();
        if (!res.ok) { setPreview(null); setPreviewError(data.error || "Preview unavailable."); return; }
        setPreview(data.dishQuantityPreview); setPreviewError("");
      } catch { setPreview(null); setPreviewError("Preview unavailable."); }
    }, 300);
    return () => clearTimeout(t);
  }, [form]);

  // Dish picker for "+ Add Dish Reward"
  useEffect(() => {
    if (!form || form.dish || form.ruleId) return;
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ view: "dishes", configured: "no", limit: "20", q: dishSearch });
      const res = await fetch(`/api/admin/rewards/earn-rules?${params}`);
      const data = await res.json();
      if (res.ok) setDishMatches(data.rows || []);
    }, 250);
    return () => clearTimeout(t);
  }, [dishSearch, form]);

  const branchName = useMemo(() => new Map(options.branches.map(b => [b._id, b.name])), [options.branches]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const setFilter = (key: keyof typeof filters, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const patchForm = (patch: Partial<DishForm>) => setForm(prev => prev ? { ...prev, ...patch } : prev);

  function openEdit(row: DishRow) {
    setPreview(null); setPreviewError(""); setFormError("");
    setForm(row.reward && row.reward.sharedWith === 0 ? formFromRow(row) : emptyForm({ _id: row._id, name: row.name }));
  }

  async function saveDish(f: DishForm): Promise<{ ok: boolean; error?: string }> {
    const payload = toPayload(f);
    const res = await fetch(f.ruleId ? `/api/admin/rewards/earn-rules/${f.ruleId}` : "/api/admin/rewards/earn-rules", {
      method: f.ruleId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f.ruleId ? { ...payload, version: f.version } : payload),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error || "Could not save the dish reward." };
  }

  async function submitForm() {
    if (!form?.dish) { setFormError("Choose a dish."); return; }
    if (form.status === "ACTIVE" && form.currentDamru !== undefined && form.currentDamru !== null && String(form.currentDamru) !== form.damruPerUnit.trim()) {
      const ok = await confirmAction({
        title: `Change ${form.dish.name} to ${form.damruPerUnit} Damru?`,
        description: `Orders delivered from now on earn the new amount. Orders already credited keep ${form.currentDamru} Damru and are reversed at that amount if refunded.`,
        confirmLabel: "Save new reward",
      });
      if (!ok) return;
    }
    setSaving(true); setFormError("");
    try {
      const result = await saveDish(form);
      if (!result.ok) { setFormError(result.error!); return; }
      toast.success(form.ruleId ? "Dish reward updated" : "Dish reward created", `${form.dish.name}: ${form.damruPerUnit} Damru ${BASIS_LABEL[form.basis].toLowerCase()}.`);
      setForm(null);
      await load();
    } finally { setSaving(false); }
  }

  async function changeStatus(row: DishRow, status: RuleStatus) {
    const r = row.reward!;
    if (status === "ARCHIVED" && !(await confirmAction({ title: `Archive ${row.name}'s reward?`, description: "New orders stop earning this dish reward. Past credits and reports stay unchanged.", confirmLabel: "Archive" }))) return;
    setBusyId(row._id);
    try {
      const res = await fetch(`/api/admin/rewards/earn-rules/${r.ruleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, version: r.version }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Could not update the dish reward", data.error); return; }
      toast.success(status === "ACTIVE" ? "Dish reward enabled" : status === "PAUSED" ? "Dish reward disabled" : "Dish reward archived");
      await load();
    } finally { setBusyId(null); }
  }

  async function openHistory(row: DishRow) {
    const res = await fetch(`/api/admin/rewards/earn-rules/${row.reward!.ruleId}`);
    const data = await res.json();
    if (!res.ok) { toast.error("Could not load history", data.error); return; }
    setHistory({ dish: row.name, entries: data.history || [] });
  }

  async function runBulk() {
    if (!bulk) return;
    const targets = rows.filter(r => selected.has(r._id));
    if (!(await confirmAction({ title: `Set ${targets.length} dish rewards?`, description: `Each selected dish will earn ${bulk.damruPerUnit} Damru ${BASIS_LABEL[bulk.basis].toLowerCase()}. Dishes covered by a shared multi-dish rule are skipped.`, confirmLabel: "Apply" }))) return;
    setBulkRunning(true);
    let done = 0; const failed: string[] = []; const skipped: string[] = [];
    try {
      for (const row of targets) {
        if (row.reward && row.reward.sharedWith > 0) { skipped.push(row.name); continue; }
        const base = row.reward ? formFromRow(row) : emptyForm({ _id: row._id, name: row.name });
        const result = await saveDish({ ...base, damruPerUnit: bulk.damruPerUnit, basis: bulk.basis, status: bulk.status });
        if (result.ok) done++; else failed.push(`${row.name}: ${result.error}`);
      }
      if (failed.length) toast.error(`${done} updated, ${failed.length} failed`, failed.slice(0, 3).join(" · "));
      else toast.success(`${done} dish rewards set`, skipped.length ? `Skipped (shared rule): ${skipped.join(", ")}` : undefined);
      setBulk(null); setSelected(new Set());
      await load();
    } finally { setBulkRunning(false); }
  }

  const allOnPageSelected = rows.length > 0 && rows.every(r => selected.has(r._id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "DM Sans, sans-serif" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>How dish rewards combine</p>
          <p style={{ ...hint, margin: "2px 0 0" }}>
            A dish earns only its own configured reward — no reward is shown or credited for dishes without an active rule.
            {baseInfo && <> Base order reward: {baseInfo.enabled ? `1 Damru per ₹${baseInfo.rupeesPerDamru}` : "off"}; dish rewards currently <b>{baseInfo.dishRewardBaseBehavior === "REPLACE" ? "replace" : "add to"}</b> it.</>}
          </p>
        </div>
        <a href="/admin/rewards" style={{ ...btn, textDecoration: "none" }}>Change in Damru Configuration</a>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}>
          <div style={{ gridColumn: "span 2", position: "relative" }}>
            <label style={lbl}>Search dish or code</label>
            <Search size={14} style={{ position: "absolute", left: 10, top: 31, color: "#9ca3af" }} />
            <input style={{ ...inp, paddingLeft: 30 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. biryani" />
          </div>
          <div><label style={lbl}>Category</label><select style={inp} value={filters.category} onChange={e => setFilter("category", e.target.value)}><option value="">All</option>{options.categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label style={lbl}>Branch</label><select style={inp} value={filters.branch} onChange={e => setFilter("branch", e.target.value)}><option value="">All</option>{options.branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
          <div><label style={lbl}>Reward</label><select style={inp} value={filters.configured} onChange={e => setFilter("configured", e.target.value)}><option value="">All dishes</option><option value="yes">Configured</option><option value="no">Not configured</option></select></div>
          <div><label style={lbl}>Status</label><select style={inp} value={filters.status} onChange={e => setFilter("status", e.target.value)}><option value="">Any</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          <div><label style={lbl}>Sort</label><select style={inp} value={filters.sort} onChange={e => setFilter("sort", e.target.value)}><option value="name">Name</option><option value="reward_desc">Reward: high → low</option><option value="reward_asc">Reward: low → high</option></select></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canEdit && selected.size > 0 && <button style={primary} onClick={() => setBulk({ damruPerUnit: "", basis: "PER_UNIT", status: "ACTIVE" })}>Set reward for {selected.size} selected</button>}
            {selected.size > 0 && <button style={btn} onClick={() => setSelected(new Set())}>Clear selection</button>}
          </div>
          {canCreate && <button style={primary} onClick={() => { setForm(emptyForm()); setDishSearch(""); setPreview(null); setFormError(""); }}><Plus size={14} /> Add Dish Reward</button>}
        </div>
      </div>

      {bulk && (
        <section className="card" style={{ padding: 16, border: "1.5px solid #fed7aa" }}>
          <p style={{ margin: "0 0 10px", fontFamily: "Syne, sans-serif", fontWeight: 700 }}>Set reward for {selected.size} dishes</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
            <div><label style={lbl}>Damru reward</label><input type="number" min={0} step={1} style={inp} value={bulk.damruPerUnit} onChange={e => setBulk({ ...bulk, damruPerUnit: e.target.value })} placeholder="20" /></div>
            <div><label style={lbl}>Reward basis</label><select style={inp} value={bulk.basis} onChange={e => setBulk({ ...bulk, basis: e.target.value as Basis })}>{(Object.keys(BASIS_LABEL) as Basis[]).map(b => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}</select></div>
            <div><label style={lbl}>Status</label><select style={inp} value={bulk.status} onChange={e => setBulk({ ...bulk, status: e.target.value as "ACTIVE" | "DRAFT" })}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option></select></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={primary} onClick={runBulk} disabled={bulkRunning || bulk.damruPerUnit.trim() === ""}>{bulkRunning ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={13} />} Apply</button>
              <button style={btn} onClick={() => setBulk(null)} disabled={bulkRunning}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {form && (
        <section className="card" style={{ padding: 18, border: "1.5px solid #fed7aa", background: "#fffdf9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem" }}>{form.ruleId ? `Edit reward — ${form.dish?.name}` : form.dish ? `New reward — ${form.dish.name}` : "Add dish reward"}</p>
            <button style={btn} onClick={() => setForm(null)} aria-label="Close"><X size={13} /></button>
          </div>

          {!form.dish && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Dish</label>
              <input style={inp} value={dishSearch} onChange={e => setDishSearch(e.target.value)} placeholder="Search dishes without a reward…" autoFocus />
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: 8, marginTop: 6 }}>
                {dishMatches.length === 0 && <p style={{ ...hint, padding: 8 }}>No unconfigured dishes match.</p>}
                {dishMatches.map(d => (
                  <button key={d._id} type="button" onClick={() => patchForm({ dish: { _id: d._id, name: d.name } })}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontSize: "0.82rem" }}>
                    <b>{d.name}</b> <span style={{ color: "#9ca3af" }}>· {d.categoryName} · ₹{d.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.dish && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div>
                  <label style={lbl}>Damru reward</label>
                  <input type="number" min={0} step={1} style={inp} value={form.damruPerUnit} onChange={e => patchForm({ damruPerUnit: e.target.value })} placeholder="50" autoFocus />
                  <p style={hint}>Whole number. 0 = this dish explicitly earns no dish reward.</p>
                </div>
                <div>
                  <label style={lbl}>Reward basis</label>
                  <select style={inp} value={form.basis} onChange={e => patchForm({ basis: e.target.value as Basis })}>
                    {(Object.keys(BASIS_LABEL) as Basis[]).map(b => <option key={b} value={b}>{BASIS_LABEL[b]}{b === "PER_UNIT" ? " (default)" : ""}</option>)}
                  </select>
                  <p style={hint}>{BASIS_HELP[form.basis]} Variants and add-ons don&apos;t change it.</p>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={form.status} onChange={e => patchForm({ status: e.target.value as DishForm["status"] })}>
                    <option value="ACTIVE">Active</option><option value="PAUSED">Disabled</option><option value="DRAFT">Draft</option>
                  </select>
                </div>
                <div><label style={lbl}>Maximum Damru per order (optional)</label><input type="number" min={1} step={1} style={inp} value={form.maxDamruPerOrder} onChange={e => patchForm({ maxDamruPerOrder: e.target.value })} placeholder="No cap" /></div>
                <div><label style={lbl}>Starts (optional)</label><input type="datetime-local" style={inp} value={form.startsAt} onChange={e => patchForm({ startsAt: e.target.value })} /></div>
                <div><label style={lbl}>Ends (optional)</label><input type="datetime-local" style={inp} value={form.endsAt} onChange={e => patchForm({ endsAt: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={lbl}>Branches</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <label style={{ ...hint, margin: 0, display: "flex", alignItems: "center", gap: 6, color: "#111827" }}>
                    <input type="checkbox" checked={form.branchIds.length === 0} onChange={() => patchForm({ branchIds: [] })} /> All branches
                  </label>
                  {options.branches.map(b => (
                    <label key={b._id} style={{ ...hint, margin: 0, display: "flex", alignItems: "center", gap: 6, color: "#111827" }}>
                      <input type="checkbox" checked={form.branchIds.includes(b._id)}
                        onChange={e => patchForm({ branchIds: e.target.checked ? [...form.branchIds, b._id] : form.branchIds.filter(x => x !== b._id) })} /> {b.name}
                    </label>
                  ))}
                </div>
                <p style={hint}>Branch-specific rewards apply to delivery orders from that branch (dine-in orders have no branch) and aren&apos;t shown as menu badges.</p>
              </div>

              <div style={{ marginTop: 14, border: "1px dashed #fdba74", borderRadius: 10, padding: 12, background: "#fff", fontFamily: "DM Sans, sans-serif", fontSize: "0.82rem" }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Calculator size={14} /> Preview (server calculation)</p>
                {form.currentDamru !== undefined && form.currentDamru !== null && <p style={{ margin: "0 0 6px" }}>Current reward: <b>{form.currentDamru} Damru</b> → New reward: <b>{form.damruPerUnit || "—"} Damru</b></p>}
                {preview ? preview.map(p => <div key={p.qty}>{p.qty} item{p.qty > 1 ? "s" : ""} → <b>{p.damru} Damru</b></div>) : <p style={{ ...hint, margin: 0 }}>{previewError || "Enter a Damru reward to preview."}</p>}
              </div>
            </>
          )}

          {formError && <p style={{ color: "#dc2626", fontSize: "0.82rem", fontFamily: "DM Sans, sans-serif", margin: "12px 0 0" }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <button style={btn} onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            {((form.ruleId && canEdit) || (!form.ruleId && canCreate)) && form.dish && (
              <button style={primary} onClick={submitForm} disabled={saving}>{saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={13} />} Save</button>
            )}
          </div>
        </section>
      )}

      {loadError && <div style={{ padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.84rem" }}>{loadError}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ background: "#f9fafb", color: "#6b7280", textAlign: "left" }}>
                <th style={{ padding: "9px 10px", width: 30 }}>
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPageSelected}
                    onChange={() => setSelected(prev => { const next = new Set(prev); rows.forEach(r => allOnPageSelected ? next.delete(r._id) : next.add(r._id)); return next; })} />
                </th>
                {["Dish", "Damru reward", "Branches", "Schedule", "Status", ""].map(h => <th key={h} style={{ padding: "9px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}><Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No dishes match these filters.</td></tr>}
              {rows.map(row => {
                const r = row.reward;
                const st = r ? STATUS_STYLE[rewardStatus(r)] : null;
                return (
                  <tr key={row._id} style={{ borderTop: "1px solid #f3f4f6", verticalAlign: "top", opacity: row.dishActive ? 1 : 0.6 }}>
                    <td style={{ padding: 10 }}><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.has(row._id)} onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(row._id)) next.delete(row._id); else next.add(row._id); return next; })} /></td>
                    <td style={{ padding: 10 }}>
                      <b>{row.name}</b>{!row.dishActive && <small style={{ color: "#b45309" }}> · hidden from menu</small>}
                      <small style={{ display: "block", color: "#9ca3af" }}>{row.categoryName}{row.price ? ` · ₹${row.price}` : ""}</small>
                    </td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {r ? <>
                        <b>{r.damruPerUnit} Damru</b> <span style={{ color: "#6b7280" }}>{BASIS_LABEL[r.basis].toLowerCase()}</span>
                        <small style={{ display: "block", color: "#9ca3af" }}>{r.code} · v{r.version}{r.maxDamruPerOrder ? ` · max ${r.maxDamruPerOrder}/order` : ""}{r.sharedWith > 0 ? ` · shared with ${r.sharedWith} dish${r.sharedWith > 1 ? "es" : ""}` : ""}</small>
                        {row.otherRules > 0 && <small style={{ display: "block", color: "#b45309" }}>{row.otherRules} more inactive rule{row.otherRules > 1 ? "s" : ""}</small>}
                      </> : <>
                        <span style={{ color: "#9ca3af" }}>Not configured</span>
                        {row.categoryReward && <small style={{ display: "block", color: "#9ca3af" }}>Category reward {row.categoryReward.code}: {row.categoryReward.damruPerUnit}</small>}
                      </>}
                    </td>
                    <td style={{ padding: 10 }}>{r ? (r.branchIds.length ? r.branchIds.map(id => branchName.get(id) ?? "Unknown").join(", ") : "All") : "—"}</td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {r && (r.startsAt || r.endsAt)
                        ? <>{r.startsAt ? new Date(r.startsAt).toLocaleString("en-IN") : "—"}<small style={{ display: "block", color: "#9ca3af" }}>to {r.endsAt ? new Date(r.endsAt).toLocaleString("en-IN") : "no end"}</small></>
                        : r ? "Always" : "—"}
                    </td>
                    <td style={{ padding: 10 }}>{st ? <span style={{ background: st.bg, color: st.color, padding: "2px 8px", borderRadius: 999, fontWeight: 600, fontSize: "0.72rem" }}>{st.label}</span> : "—"}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {r && r.sharedWith > 0 ? (
                          <a href="/admin/rewards/earn-rules" style={{ ...btn, textDecoration: "none" }}>Edit shared rule</a>
                        ) : (
                          ((r && canEdit) || (!r && canCreate)) && <button style={btn} onClick={() => openEdit(row)} disabled={busyId === row._id}>{r ? "Edit" : "Set reward"}</button>
                        )}
                        {r && canEdit && r.sharedWith === 0 && (r.status === "ACTIVE"
                          ? <button style={btn} onClick={() => changeStatus(row, "PAUSED")} disabled={busyId === row._id}>Disable</button>
                          : <button style={btn} onClick={() => changeStatus(row, "ACTIVE")} disabled={busyId === row._id}>Enable</button>)}
                        {r && canEdit && r.sharedWith === 0 && <button style={{ ...btn, color: "#b91c1c" }} onClick={() => changeStatus(row, "ARCHIVED")} disabled={busyId === row._id}>Archive</button>}
                        {r && <button style={btn} onClick={() => openHistory(row)} aria-label="Version history"><History size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: "1px solid #f3f4f6", fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem", color: "#6b7280" }}>
          <span>{total} dish{total === 1 ? "" : "es"}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={btn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={13} /></button>
            <span>Page {page} of {totalPages}</span>
            <button style={btn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Next page"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {history && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={() => setHistory(null)}>
          <div className="card" style={{ padding: 18, maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ margin: 0, fontFamily: "Syne, sans-serif", fontWeight: 700 }}>{history.dish} — reward history</p>
              <button style={btn} onClick={() => setHistory(null)} aria-label="Close"><X size={13} /></button>
            </div>
            {history.entries.length === 0 && <p style={hint}>No recorded changes yet.</p>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem" }}>
              <tbody>
                {history.entries.map((h, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>{new Date(h.at).toLocaleString("en-IN")}</td>
                    <td style={{ padding: 8 }}>v{h.version ?? "?"} · {h.action.replace("earn_rule_", "").replace(/_/g, " ")}</td>
                    <td style={{ padding: 8 }}>{h.damruPerUnit ?? "—"} Damru {h.basis ? BASIS_LABEL[h.basis as Basis]?.toLowerCase() : ""}</td>
                    <td style={{ padding: 8 }}>{h.status ?? ""}</td>
                    <td style={{ padding: 8, color: "#6b7280" }}>{h.admin ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={hint}>Orders keep the version they were credited under; changes only affect orders delivered afterwards.</p>
          </div>
        </div>
      )}
    </div>
  );
}
