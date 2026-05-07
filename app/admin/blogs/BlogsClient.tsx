"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Filter, ChevronDown, X, Check, Trash2, Eye, EyeOff, Download } from "lucide-react";
import { deleteBlog, toggleBlogStatus } from "@/app/actions/blogs";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

interface Blog {
  _id: string; title: string; slug: string; excerpt: string;
  category: { _id: string; name: string } | null;
  author: { name: string } | string;
  status: string; views: number;
  sortOrder: number; publishedAt?: string; createdAt: string; tags: string[];
}

const PAGE_SIZE = 10;

export default function BlogsClient({ blogs, perms }: { blogs: Blog[]; perms?: Perms }) {
  const router = useRouter();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.blogs?.[action]);
  
  const canEdit = can("edit");
  const canDelete = can("delete");
  const canCreate = can("create");

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter,    setCatFilter]    = useState("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const categories = useMemo(() => [...new Set(blogs.map(b => b.category ? (typeof b.category === "string" ? b.category : b.category.name) : "").filter(Boolean))], [blogs]);

  const filtered = useMemo(() => blogs.filter(b => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (catFilter    !== "all") {
      const catName = b.category ? (typeof b.category === "string" ? b.category : b.category.name) : "";
      if (catName !== catFilter) return false;
    }
    if (search.trim()) {
      const q      = search.toLowerCase();
      const catStr = b.category ? (typeof b.category === "string" ? b.category : b.category.name) : "";
      const authStr= typeof b.author === "string" ? b.author : (b.author?.name || "");
      if (!b.title.toLowerCase().includes(q) &&
          !b.excerpt.toLowerCase().includes(q) &&
          !authStr.toLowerCase().includes(q) &&
          !catStr.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [blogs, statusFilter, catFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeFilters = [statusFilter !== "all", catFilter !== "all"].filter(Boolean).length;

  const allOnPage  = paginated.length > 0 && paginated.every(b => selected.has(b._id));
  const someOnPage = paginated.some(b => selected.has(b._id));

  function toggleOne(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (allOnPage) setSelected(p => { const n = new Set(p); paginated.forEach(b => n.delete(b._id)); return n; });
    else           setSelected(p => { const n = new Set(p); paginated.forEach(b => n.add(b._id));    return n; });
  }
  function clearSel() { setSelected(new Set()); }

  async function handleDelete(id: string, title: string) {
    if (!canDelete) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await deleteBlog(id); router.refresh();
  }

  async function handleToggle(id: string, status: string) {
    if (!canEdit) return;
    await toggleBlogStatus(id, status); router.refresh();
  }

  async function handleBulkDelete() {
    if (!canDelete) return;
    if (!confirm(`Delete ${selected.size} post(s)?`)) return;
    setBulkLoading(true);
    for (const id of selected) await deleteBlog(id);
    setBulkLoading(false); clearSel(); router.refresh();
  }

  async function handleBulkPublish(publish: boolean) {
    if (!canEdit) return;
    setBulkLoading(true);
    const toChange = blogs.filter(b => selected.has(b._id) && (b.status === "published") !== publish);
    for (const b of toChange) await toggleBlogStatus(b._id, b.status);
    setBulkLoading(false); clearSel(); router.refresh();
  }

  function handleExport() {
    const rows = [
      ["Title","Category","Author","Status","Views","Published","Created"],
      ...filtered.map(b => [
        b.title, b.category, b.author, b.status, b.views,
        b.publishedAt ? new Date(b.publishedAt).toLocaleDateString("en-IN") : "",
        new Date(b.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "blogs.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input placeholder="Search title, author, category…" className="search-inp"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => { setSearch(""); setPage(1); }} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}><X size={13}/></button>}
          </div>
          <button className={`btn-outline${showFilters ? " filter-btn-active" : ""}`} onClick={() => setShowFilters(v => !v)}>
            <Filter size={13}/> Filters
            {activeFilters > 0 && <span className="filter-count-badge">{activeFilters}</span>}
            <ChevronDown size={12} style={{ transition:"transform 0.15s", transform: showFilters ? "rotate(180deg)" : "none" }}/>
          </button>
        </div>
        <div className="toolbar-right">
          <button className="btn-outline" onClick={handleExport}><Download size={13}/> Export</button>
          {canCreate && (
            <Link href="/admin/blogs/new" className="btn-primary">+ New Post</Link>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
        {[
          { l:"All",       k:"all",       n: blogs.length },
          { l:"Published", k:"published", n: blogs.filter(b=>b.status==="published").length },
          { l:"Drafts",    k:"draft",     n: blogs.filter(b=>b.status==="draft").length },
        ].map(t => (
          <button key={t.k} className={`cat-tab${statusFilter===t.k?" tab-active":""}`}
            onClick={() => { setStatusFilter(t.k); setPage(1); clearSel(); }}>
            {t.l} <span className="cat-tab-count">{t.n}</span>
          </button>
        ))}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="menu-filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Category</label>
              <select className="filter-select" value={catFilter}
                onChange={e => { setCatFilter(e.target.value); setPage(1); }}>
                <option value="all">All</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {activeFilters > 0 && (
              <button className="filter-clear-btn" onClick={() => { setCatFilter("all"); setStatusFilter("all"); setPage(1); }}>
                <X size={13}/> Clear
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
                <button className="bulk-btn bulk-activate"   onClick={() => handleBulkPublish(true)}  disabled={bulkLoading}><Eye    size={13}/> Publish</button>
                <button className="bulk-btn bulk-deactivate" onClick={() => handleBulkPublish(false)} disabled={bulkLoading}><EyeOff size={13}/> Unpublish</button>
              </>
            )}
            {canDelete && (
              <button className="bulk-btn bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkLoading}>
                <Trash2 size={13}/> {bulkLoading ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {(canEdit || canDelete) && (
                  <th><input type="checkbox" className="cb-cat" checked={allOnPage}
                    ref={el => { if (el) el.indeterminate = !allOnPage && someOnPage; }}
                    onChange={toggleAll} /></th>
                )}
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Status</th>
                <th>Views</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={(canEdit || canDelete) ? 8 : 7} style={{ textAlign:"center", padding:"48px", color:"#9ca3af" }}>
                  No posts match your filters.
                </td></tr>
              ) : paginated.map(blog => (
                <tr key={blog._id} className={selected.has(blog._id) ? "row-selected" : ""}>
                  {(canEdit || canDelete) && (
                    <td><input type="checkbox" className="cb-cat" checked={selected.has(blog._id)} onChange={() => toggleOne(blog._id)} /></td>
                  )}
                  <td>
                    <div>
                      <p style={{ fontWeight:500, color:"#111827", fontSize:"0.875rem", marginBottom:2 }}>{blog.title}</p>
                      <p style={{ fontSize:"0.72rem", color:"#9ca3af" }}>/{blog.slug}</p>
                      {blog.tags.length > 0 && (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:3 }}>
                          {blog.tags.slice(0,3).map(t => (
                            <span key={t} style={{ fontSize:"0.65rem", background:"#f3f4f6", color:"#6b7280", padding:"1px 6px", borderRadius:10 }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize:"0.83rem", color:"#4b5563" }}>{blog.category ? (typeof blog.category === "string" ? blog.category : blog.category.name) : <em style={{ color:"#d1d5db" }}>Uncategorised</em>}</td>
                  <td style={{ fontSize:"0.83rem", color:"#4b5563" }}>{typeof blog.author === "string" ? blog.author : blog.author?.name}</td>
                  <td>
                    {canEdit ? (
                      <button onClick={() => handleToggle(blog._id, blog.status)} style={{ background:"none",border:"none",cursor:"pointer",padding:0 }} title="Click to toggle">
                        {blog.status === "published"
                          ? <span className="badge-active"><span className="status-dot"/>Published</span>
                          : <span className="badge-inactive"><span className="status-dot"/>Draft</span>}
                      </button>
                    ) : (
                      blog.status === "published"
                        ? <span className="badge-active"><span className="status-dot"/>Published</span>
                        : <span className="badge-inactive"><span className="status-dot"/>Draft</span>
                    )}
                  </td>
                  <td style={{ fontSize:"0.83rem", color:"#6b7280" }}>{blog.views}</td>
                  <td style={{ fontSize:"0.78rem", color:"#9ca3af", whiteSpace:"nowrap" }}>
                    {blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                  </td>
                  <td>
                    <div className="actions-cell">
                      {canEdit && (
                        <Link href={`/admin/blogs/edit/${blog._id}`} className="btn-edit">Edit</Link>
                      )}
                      {canDelete && (
                        <button className="btn-danger" onClick={() => handleDelete(blog._id, blog.title)}>
                          <Trash2 size={12}/> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span className="pag-info">
            {filtered.length === 0 ? "No results"
              : `Showing ${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE,filtered.length)} of ${filtered.length} posts`}
          </span>
          <div className="pag-btns">
            <button className="pag-btn" disabled={safePage===1} onClick={() => setPage(p=>p-1)} style={{ opacity:safePage===1?0.4:1 }}>‹</button>
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
            <button className="pag-btn" disabled={safePage===totalPages} onClick={() => setPage(p=>p+1)} style={{ opacity:safePage===totalPages?0.4:1 }}>›</button>
          </div>
        </div>
      </div>
    </>
  );
}