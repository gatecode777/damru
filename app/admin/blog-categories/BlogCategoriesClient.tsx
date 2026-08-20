"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Filter, ChevronDown, X, Check,
  Trash2, Eye, EyeOff, Download, Tag,
} from "lucide-react";
import { deleteBlogCategory, toggleBlogCategoryActive } from "@/app/actions/blog-categories";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/Toast";
import { useAdminConfirm } from "@/components/admin/ConfirmDialog";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

interface Category {
  _id: string; name: string; slug: string;
  description: string; sortOrder: number;
  isActive: boolean; createdAt: string;
}

interface Props { categories: Category[]; perms?: Perms; }

const PAGE_SIZE = 15;

export default function BlogCategoriesClient({ categories, perms }: Props) {
  const toast = useToast();
  const router = useRouter();
  const confirmAction = useAdminConfirm();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.blog_categories?.[action]);
  
  const canEdit = can("edit");
  const canDelete = can("delete");
  const canCreate = can("create");

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive">("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const filtered = useMemo(() => categories.filter(c => {
    if (statusFilter === "active"   && !c.isActive) return false;
    if (statusFilter === "inactive" && c.isActive)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) &&
          !c.slug.toLowerCase().includes(q) &&
          !c.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [categories, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFilterCount = [statusFilter !== "all"].filter(Boolean).length;

  const allOnPage  = paginated.length > 0 && paginated.every(c => selected.has(c._id));
  const someOnPage = paginated.some(c => selected.has(c._id));

  function toggleOne(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (allOnPage) setSelected(p => { const n = new Set(p); paginated.forEach(c => n.delete(c._id)); return n; });
    else           setSelected(p => { const n = new Set(p); paginated.forEach(c => n.add(c._id));    return n; });
  }
  function clearSel() { setSelected(new Set()); }

  async function handleBulkDelete() {
    if (!canDelete) return;
    if (!(await confirmAction({ title: "Delete selected categories?", description: `${selected.size} selected categor${selected.size === 1 ? "y" : "ies"} will be permanently deleted. This action cannot be undone.`, confirmLabel: "Delete categories" }))) return;
    setBulkLoading(true);
    for (const id of selected) await deleteBlogCategory(id);
    setBulkLoading(false); clearSel(); toast.success("Blog categories deleted"); router.refresh();
  }

  async function handleBulkToggle(activate: boolean) {
    if (!canEdit) return;
    setBulkLoading(true);
    const toChange = categories.filter(c => selected.has(c._id) && c.isActive !== activate);
    for (const c of toChange) await toggleBlogCategoryActive(c._id, c.isActive);
    setBulkLoading(false); clearSel(); toast.success(activate ? "Blog categories enabled" : "Blog categories disabled"); router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!canDelete) return;
    if (!(await confirmAction({ title: "Delete blog category?", description: `${name} will be deleted. Posts using it will retain the category as plain text.`, confirmLabel: "Delete category" }))) return;
    await deleteBlogCategory(id); toast.success("Blog category deleted"); router.refresh();
  }

  async function handleToggleActive(id: string, current: boolean) {
    if (!canEdit) return;
    await toggleBlogCategoryActive(id, current); toast.success(current ? "Blog category disabled" : "Blog category enabled"); router.refresh();
  }

  function handleExport() {
    const rows = [
      ["Name","Slug","Description","Sort Order","Status","Created"],
      ...filtered.map(c => [
        c.name, c.slug, c.description||"", c.sortOrder,
        c.isActive ? "Active" : "Inactive",
        new Date(c.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="blog-categories.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input placeholder="Search by name, slug or description…" className="search-inp"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }}
                style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button className={`btn-outline${showFilters?" filter-btn-active":""}`} onClick={() => setShowFilters(v=>!v)}>
            <Filter size={13}/> Filters
            {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
            <ChevronDown size={12} style={{ transition:"transform 0.15s", transform:showFilters?"rotate(180deg)":"none" }}/>
          </button>
        </div>
        <div className="toolbar-right">
          <button className="btn-outline" onClick={handleExport}><Download size={13}/> Export CSV</button>
          {canCreate && (
            <Link href="/admin/blog-categories/new" className="btn-primary">+ Add Category</Link>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
        {[
          { l:"All",      k:"all",      n:categories.length },
          { l:"Active",   k:"active",   n:categories.filter(c=>c.isActive).length },
          { l:"Inactive", k:"inactive", n:categories.filter(c=>!c.isActive).length },
        ].map(t => (
          <button key={t.k} className={`cat-tab${statusFilter===t.k?" tab-active":""}`}
            onClick={() => { setStatusFilter(t.k as "all"|"active"|"inactive"); setPage(1); clearSel(); }}>
            {t.l} <span className="cat-tab-count">{t.n}</span>
          </button>
        ))}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="cat-filter-panel">
          <div className="cat-filter-row">
            <div className="cat-filter-group">
              <label className="cat-filter-label">Status</label>
              <select className="cat-filter-select" value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as "all"|"active"|"inactive"); setPage(1); }}>
                <option value="all">All</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button className="cat-filter-clear" onClick={() => { setStatusFilter("all"); setPage(1); }}>
                <X size={13}/> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk bar - only show if user has edit or delete permissions */}
      {selected.size > 0 && (canEdit || canDelete) && (
        <div className="bulk-bar">
          <div className="bulk-left">
            <span className="bulk-count"><Check size={13}/> {selected.size} selected</span>
            <button className="bulk-clear-btn" onClick={clearSel}><X size={12}/> Clear</button>
          </div>
          <div className="bulk-actions">
            {canEdit && (
              <>
                <button className="bulk-btn bulk-activate"   onClick={() => handleBulkToggle(true)}  disabled={bulkLoading}><Eye    size={13}/> Set Active</button>
                <button className="bulk-btn bulk-deactivate" onClick={() => handleBulkToggle(false)} disabled={bulkLoading}><EyeOff size={13}/> Set Inactive</button>
              </>
            )}
            {canDelete && (
              <button className="bulk-btn bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkLoading}>
                <Trash2 size={13}/> {bulkLoading ? "Deleting…" : "Delete Selected"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {filtered.length === 0 && !search && statusFilter === "all" ? (
          <div className="empty-state">
            <Tag size={40}/>
            <p>
              No blog categories yet.
              {canCreate && (
                <Link href="/admin/blog-categories/new" style={{ color:"#f97316" }}>
                  {" "}Add the first one →
                </Link>
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {(canEdit || canDelete) && (
                      <th>
                        <input type="checkbox" className="cb-cat" checked={allOnPage}
                          ref={el => { if (el) el.indeterminate = !allOnPage && someOnPage; }}
                          onChange={toggleAll} />
                      </th>
                    )}
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th>Sort</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={(canEdit || canDelete) ? 8 : 7} style={{ textAlign:"center", padding:"48px 20px", color:"#9ca3af" }}>
                      No categories match your search or filters.
                    </td></tr>
                  ) : (
                    paginated.map(cat => (
                      <tr key={cat._id} className={selected.has(cat._id) ? "row-selected" : ""}>
                        {(canEdit || canDelete) && (
                          <td>
                            <input type="checkbox" className="cb-cat"
                              checked={selected.has(cat._id)} onChange={() => toggleOne(cat._id)} />
                          </td>
                        )}
                        <td>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ width:32, height:32, borderRadius:8, background:"#f0fdf4", border:"1.5px solid #bbf7d0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <Tag size={14} style={{ color:"#16a34a" }} />
                            </div>
                            <span style={{ fontWeight:500, color:"#111827", fontSize:"0.875rem" }}>{cat.name}</span>
                          </div>
                        </td>
                        <td><code className="slug-code">{cat.slug}</code></td>
                        <td style={{ maxWidth:240, color:"#6b7280", fontSize:"0.83rem" }}>
                          <span style={{ display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                            {cat.description || <em style={{ color:"#d1d5db" }}>No description</em>}
                          </span>
                        </td>
                        <td><span className="sort-badge">{cat.sortOrder}</span></td>
                        <td>
                          {canEdit ? (
                            <button onClick={() => handleToggleActive(cat._id, cat.isActive)}
                              style={{ background:"none", border:"none", cursor:"pointer", padding:0 }} title="Click to toggle">
                              {cat.isActive
                                ? <span className="badge-active"><span className="status-dot"/>Active</span>
                                : <span className="badge-inactive"><span className="status-dot"/>Inactive</span>}
                            </button>
                          ) : (
                            cat.isActive
                              ? <span className="badge-active"><span className="status-dot"/>Active</span>
                              : <span className="badge-inactive"><span className="status-dot"/>Inactive</span>
                          )}
                        </td>
                        <td style={{ color:"#9ca3af", fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                          {new Date(cat.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                        </td>
                        <td>
                          <div className="actions-cell">
                            {canEdit && (
                              <Link href={`/admin/blog-categories/edit/${cat._id}`} className="btn-edit">Edit</Link>
                            )}
                            {canDelete && (
                              <button className="btn-danger" onClick={() => handleDelete(cat._id, cat.name)}>
                                <Trash2 size={12}/> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span className="pag-info">
                {filtered.length === 0 ? "No results"
                  : `Showing ${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE,filtered.length)} of ${filtered.length} categories`}
              </span>
              <div className="pag-btns">
                <button className="pag-btn" disabled={safePage===1} onClick={() => setPage(p=>p-1)} style={{ opacity:safePage===1?0.4:1 }}>‹</button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-safePage)<=1)
                  .reduce<(number|"…")[]>((acc,p,idx,arr)=>{
                    if(idx>0&&typeof arr[idx-1]==="number"&&(p as number)-(arr[idx-1] as number)>1) acc.push("…");
                    acc.push(p); return acc;
                  },[])
                  .map((p,i)=> p==="…"
                    ? <span key={`d${i}`} className="pag-btn" style={{ cursor:"default",border:"none" }}>…</span>
                    : <button key={p} className={`pag-btn${p===safePage?" active":""}`} onClick={()=>setPage(p as number)}>{p}</button>
                  )}
                <button className="pag-btn" disabled={safePage===totalPages} onClick={()=>setPage(p=>p+1)} style={{ opacity:safePage===totalPages?0.4:1 }}>›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
