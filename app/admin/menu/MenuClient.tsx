"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search, Filter, ChevronDown, X, Check,
  Trash2, Eye, EyeOff, ImageOff, Download,
} from "lucide-react";
import { deleteMenuItem, toggleMenuItemActive } from "@/app/actions/menu";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/Toast";
import { useAdminConfirm } from "@/components/admin/ConfirmDialog";

interface Variant  { label: string; price: number }
interface Category { _id: string; name: string }
interface MenuItem {
  _id: string; name: string; slug: string; description: string;
  basePrice: number; variantType: string;
  variants: Variant[];
  isVeg: boolean; isActive: boolean; isFeatured: boolean;
  sortOrder: number; image?: string;
  category: { _id: string; name: string } | null;
  createdAt: string;
}
interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }
interface Props { items: MenuItem[]; categories: Category[]; perms?: Perms; }

const VARIANT_LABELS: Record<string, string> = {
  none: "Fixed Price", portion: "Half / Full", weight: "By Weight",
  pound: "By Pound", addon: "Add-ons", custom: "Custom",
};
const PAGE_SIZE = 12;

export default function MenuClient({ items, categories, perms }: Props) {
  const toast = useToast();
  const confirmAction = useAdminConfirm();
  const router = useRouter();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.menu?.[action]);

  // ── Filter state ─────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("all");
  const [vegFilter,    setVegFilter]    = useState<"all"|"veg"|"nonveg">("all");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive">("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [featFilter,   setFeatFilter]   = useState<"all"|"yes">("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);

  // ── Checkbox / bulk ──────────────────────────────────────────
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => items.filter(item => {
    if (catFilter    !== "all"    && item.category?._id !== catFilter)     return false;
    if (vegFilter    === "veg"    && !item.isVeg)                          return false;
    if (vegFilter    === "nonveg" && item.isVeg)                           return false;
    if (statusFilter === "active"   && !item.isActive)                     return false;
    if (statusFilter === "inactive" && item.isActive)                      return false;
    if (typeFilter   !== "all"    && item.variantType !== typeFilter)       return false;
    if (featFilter   === "yes"    && !item.isFeatured)                     return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) &&
          !item.description?.toLowerCase().includes(q) &&
          !item.category?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, catFilter, vegFilter, statusFilter, typeFilter, featFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeFilterCount = [
    vegFilter !== "all", statusFilter !== "all",
    typeFilter !== "all", featFilter !== "all",
  ].filter(Boolean).length;

  function resetFilters() {
    setVegFilter("all"); setStatusFilter("all");
    setTypeFilter("all"); setFeatFilter("all"); setPage(1);
  }

  // ── Checkbox helpers ─────────────────────────────────────────
  const allOnPage = paginated.length > 0 && paginated.every(i => selected.has(i._id));
  const someOnPage = paginated.some(i => selected.has(i._id));

  function toggleOne(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (allOnPage) setSelected(p => { const n = new Set(p); paginated.forEach(i => n.delete(i._id)); return n; });
    else           setSelected(p => { const n = new Set(p); paginated.forEach(i => n.add(i._id));    return n; });
  }
  function clearSel() { setSelected(new Set()); }

  // ── Bulk actions ─────────────────────────────────────────────
  async function handleBulkDelete() {
    if (!can("delete")) return;
    if (!(await confirmAction({ title: "Delete selected menu items?", description: `${selected.size} selected item${selected.size === 1 ? "" : "s"} will be permanently deleted. This action cannot be undone.`, confirmLabel: "Delete items" }))) return;
    setBulkLoading(true);
    for (const id of selected) await deleteMenuItem(id);
    setBulkLoading(false); clearSel(); toast.success("Menu items deleted"); router.refresh();
  }
  async function handleBulkToggle(activate: boolean) {
    if (!can("edit")) return;
    setBulkLoading(true);
    const toChange = items.filter(i => selected.has(i._id) && i.isActive !== activate);
    for (const i of toChange) await toggleMenuItemActive(i._id, i.isActive);
    setBulkLoading(false); clearSel(); toast.success("Availability updated"); router.refresh();
  }

  // ── Single actions ───────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!can("delete")) return;
    if (!(await confirmAction({ title: "Delete menu item?", description: `${name} will be permanently deleted. This action cannot be undone.`, confirmLabel: "Delete item" }))) return;
    await deleteMenuItem(id); toast.success("Menu item deleted"); router.refresh();
  }
  async function handleToggleActive(id: string, current: boolean) {
    if (!can("edit")) return;
    await toggleMenuItemActive(id, current); toast.success("Availability updated"); router.refresh();
  }

  // ── Export CSV ───────────────────────────────────────────────
  function handleExport() {
    const rows = [
      ["Name","Category","Type","Price","Veg","Active","Featured","Sort","Created"],
      ...filtered.map(i => [
        i.name, i.category?.name || "",
        VARIANT_LABELS[i.variantType] || i.variantType,
        i.variantType === "none" ? i.basePrice : (i.variants[0]?.price || 0),
        i.isVeg ? "Veg" : "",
        i.isActive ? "Active" : "Inactive",
        i.isFeatured ? "Yes" : "No",
        i.sortOrder,
        new Date(i.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "menu-items.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input
              placeholder="Search name, description, category…"
              className="search-inp"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }}
                style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            className={`btn-outline${showFilters ? " filter-btn-active" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
            <ChevronDown size={12} style={{ transition:"transform 0.15s", transform: showFilters ? "rotate(180deg)" : "none" }} />
          </button>
        </div>
        <div className="toolbar-right">
          <button className="btn-outline" onClick={handleExport}><Download size={13} /> Export CSV</button>
          {can("create") && (
            <Link href="/admin/menu/new" className="btn-primary">+ Add Item</Link>
          )}
        </div>
      </div>

      {/* ── Category quick tabs ── */}
      <div className="cat-tabs">
        <button className={`cat-tab${catFilter==="all"?" tab-active":""}`}
          onClick={() => { setCatFilter("all"); setPage(1); clearSel(); }}>
          All Items <span className="cat-tab-count">{items.length}</span>
        </button>
        {categories.map(cat => {
          const count = items.filter(i => i.category?._id === cat._id).length;
          return (
            <button key={cat._id}
              className={`cat-tab${catFilter===cat._id?" tab-active":""}`}
              onClick={() => { setCatFilter(cat._id); setPage(1); clearSel(); }}>
              {cat.name} <span className="cat-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Advanced filter panel ── */}
      {showFilters && (
        <div className="menu-filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Diet Type</label>
              <select className="filter-select" value={vegFilter}
                onChange={e => { setVegFilter(e.target.value as "all"|"veg"|"nonveg"); setPage(1); }}>
                <option value="all">All</option>
                <option value="veg">🟢 Veg Only</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select className="filter-select" value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as "all"|"active"|"inactive"); setPage(1); }}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Pricing Type</label>
              <select className="filter-select" value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
                <option value="all">All Types</option>
                <option value="none">Fixed Price</option>
                <option value="portion">Half / Full</option>
                <option value="weight">By Weight</option>
                <option value="pound">By Pound</option>
                <option value="addon">Add-ons</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Featured</label>
              <select className="filter-select" value={featFilter}
                onChange={e => { setFeatFilter(e.target.value as "all"|"yes"); setPage(1); }}>
                <option value="all">All</option>
                <option value="yes">Featured Only</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button className="filter-clear-btn" onClick={resetFilters}>
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk bar (only show if user has edit or delete permissions) ── */}
      {selected.size > 0 && (can("edit") || can("delete")) && (
        <div className="bulk-bar">
          <div className="bulk-left">
            <span className="bulk-count"><Check size={13} /> {selected.size} selected</span>
            <button className="bulk-clear-btn" onClick={clearSel}><X size={12} /> Clear</button>
          </div>
          <div className="bulk-actions">
            {can("edit") && (
              <>
                <button className="bulk-btn bulk-activate"   onClick={() => handleBulkToggle(true)}  disabled={bulkLoading}><Eye    size={13} /> Set Active</button>
                <button className="bulk-btn bulk-deactivate" onClick={() => handleBulkToggle(false)} disabled={bulkLoading}><EyeOff size={13} /> Set Inactive</button>
              </>
            )}
            {can("delete") && (
              <button className="bulk-btn bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkLoading}>
                <Trash2 size={13} /> {bulkLoading ? "Deleting…" : "Delete Selected"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {(can("edit") || can("delete")) && (
                  <th>
                    <input type="checkbox" className="cb-menu"
                      checked={allOnPage}
                      ref={el => { if (el) el.indeterminate = !allOnPage && someOnPage; }}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th>Item</th>
                <th>Category</th>
                <th>Type &amp; Price</th>
                <th>Diet</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Sort</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={can("edit") || can("delete") ? 9 : 8} style={{ textAlign:"center", padding:"52px 20px", color:"#9ca3af" }}>
                  {search || activeFilterCount > 0 || catFilter !== "all"
                    ? "No items match your filters." : "No menu items yet."}
                </td></tr>
              ) : paginated.map(item => {
                const isChecked    = selected.has(item._id);
                const displayPrice = item.variantType === "none"
                  ? `₹${item.basePrice}`
                  : item.variants.length > 0
                    ? `₹${item.variants[0].price}–₹${item.variants[item.variants.length-1].price}`
                    : "—";

                return (
                  <tr key={item._id} className={isChecked ? "row-selected" : ""}>
                    {(can("edit") || can("delete")) && (
                      <td>
                        <input type="checkbox" className="cb-menu" checked={isChecked} onChange={() => toggleOne(item._id)} />
                      </td>
                    )}
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {item.image ? (
                          <Image src={`/uploads/menu-items/${item.image}`} alt={item.name}
                            width={48} height={48} className="menu-thumb" />
                        ) : (
                          <div className="menu-thumb-ph"><ImageOff size={18} /></div>
                        )}
                        <div>
                          <p style={{ fontWeight:500, color:"#111827", fontSize:"0.875rem", marginBottom:1 }}>{item.name}</p>
                          <p style={{ fontSize:"0.72rem", color:"#9ca3af" }}>
                            {item.description?.slice(0,45)}{(item.description?.length??0)>45?"…":""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:"0.83rem", color:"#4b5563" }}>
                      {item.category?.name ?? <em style={{ color:"#d1d5db" }}>None</em>}
                    </td>
                    <td>
                      <span className="variant-tag">{VARIANT_LABELS[item.variantType]??item.variantType}</span>
                      <p style={{ fontSize:"0.82rem", fontWeight:600, color:"#111827", marginTop:3 }}>{displayPrice}</p>
                    </td>
                    <td>
                      {item.isVeg
                        ? <span className="badge-veg">🟢 Veg</span>
                        : ''}
                    </td>
                    <td>
                      {can("edit") ? (
                        <button onClick={() => handleToggleActive(item._id, item.isActive)}
                          title="Click to toggle" style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                          {item.isActive
                            ? <span className="badge-active"><span className="status-dot" />Active</span>
                            : <span className="badge-inactive"><span className="status-dot" />Inactive</span>}
                        </button>
                      ) : (
                        item.isActive
                          ? <span className="badge-active"><span className="status-dot" />Active</span>
                          : <span className="badge-inactive"><span className="status-dot" />Inactive</span>
                      )}
                    </td>
                    <td>
                      {item.isFeatured
                        ? <span style={{ fontSize:"0.82rem", color:"#7c3aed", fontWeight:600 }}>★ Yes</span>
                        : <span style={{ fontSize:"0.78rem", color:"#d1d5db" }}>—</span>}
                    </td>
                    <td><span className="sort-badge">{item.sortOrder}</span></td>
                    <td>
                      <div className="actions-cell">
                        {can("edit") && (
                          <Link href={`/admin/menu/edit/${item._id}`} className="btn-edit">Edit</Link>
                        )}
                        {can("delete") && (
                          <button className="btn-danger" onClick={() => handleDelete(item._id, item.name)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="pagination">
          <span className="pag-info">
            {filtered.length === 0 ? "No results"
              : `Showing ${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE,filtered.length)} of ${filtered.length} items`}
          </span>
          <div className="pag-btns">
            <button className="pag-btn" disabled={safePage===1} onClick={() => setPage(p=>p-1)}
              style={{ opacity: safePage===1 ? 0.4 : 1 }}>‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-safePage)<=1)
              .reduce<(number|"…")[]>((acc,p,idx,arr) => {
                if (idx>0 && typeof arr[idx-1]==="number" && (p as number)-(arr[idx-1] as number)>1) acc.push("…");
                acc.push(p); return acc;
              }, [])
              .map((p,i) => p==="…"
                ? <span key={`d${i}`} className="pag-btn" style={{ cursor:"default",border:"none" }}>…</span>
                : <button key={p} className={`pag-btn${p===safePage?" active":""}`} onClick={() => setPage(p as number)}>{p}</button>
              )}
            <button className="pag-btn" disabled={safePage===totalPages} onClick={() => setPage(p=>p+1)}
              style={{ opacity: safePage===totalPages ? 0.4 : 1 }}>›</button>
          </div>
        </div>
      </div>
    </>
  );
}
