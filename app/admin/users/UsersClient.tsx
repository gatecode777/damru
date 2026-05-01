"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search, Filter, Download, Mail, Phone,
  Trash2, UserCheck, UserX, ChevronDown, X, Check
} from "lucide-react";
import { deleteUser, toggleUserStatus } from "@/app/actions/users";
import { useRouter } from "next/navigation";

interface User {
  _id: string; name: string; email: string;
  phone?: string;
  status: string; totalSpend: number;
  avatar?: string; createdAt: string;
}

interface Props {
  users: User[];
  countMap: Record<string, number>;
  fromDB: boolean;
}

const AVATAR_COLORS = ["#f97316","#2563eb","#7c3aed","#059669","#e11d48","#d97706","#0284c7","#16a34a"];
const STATUS_BADGE: Record<string, { cls: string; dot: string }> = {
  active:    { cls: "sbadge-active",    dot: "#22c55e" },
  inactive:  { cls: "sbadge-inactive",  dot: "#9ca3af" },
  suspended: { cls: "sbadge-suspended", dot: "#ef4444" },
};

export default function UsersClient({ users, countMap, fromDB }: Props) {
  const router   = useRouter();
  const [, startTransition] = useTransition();

  // ── Filter / search state ──────────────────────────────────────
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<string>("all");
  const [spendMin,       setSpendMin]        = useState<string>("");
  const [spendMax,       setSpendMax]        = useState<string>("");
  const [showFilters,    setShowFilters]     = useState(false);

  // ── Checkbox / bulk selection ──────────────────────────────────
  const [selected,       setSelected]        = useState<Set<string>>(new Set());
  const [bulkLoading,    setBulkLoading]      = useState(false);

  // ── Pagination ─────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Filtered + searched users ─────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter(u => {
      // Status tab
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      // Spend range
      if (spendMin !== "" && u.totalSpend < Number(spendMin)) return false;
      if (spendMax !== "" && u.totalSpend > Number(spendMax)) return false;
      // Search — name, email, phone
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          u.name.toLowerCase().includes(q)  ||
          u.email.toLowerCase().includes(q) ||
          (u.phone?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [users, statusFilter, spendMin, spendMax, search]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Checkbox helpers ───────────────────────────────────────────
  const allOnPageSelected = paginated.length > 0 && paginated.every(u => selected.has(u._id));
  const someSelected      = selected.size > 0;

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        paginated.forEach(u => next.delete(u._id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        paginated.forEach(u => next.add(u._id));
        return next;
      });
    }
  }

  function clearSelection() { setSelected(new Set()); }

  // ── Active filter count (for badge) ───────────────────────────
  const activeFilterCount = [
    spendMin !== "",
    spendMax !== "",
  ].filter(Boolean).length;

  // ── Bulk delete ────────────────────────────────────────────────
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected user(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    for (const id of selected) { await deleteUser(id); }
    setBulkLoading(false);
    setSelected(new Set());
    router.refresh();
  }

  // ── Bulk status ────────────────────────────────────────────────
  async function handleBulkStatus(targetStatus: "active" | "inactive") {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const toChange = users.filter(u => selected.has(u._id) && u.status !== targetStatus);
    for (const u of toChange) { await toggleUserStatus(u._id, u.status); }
    setBulkLoading(false);
    setSelected(new Set());
    router.refresh();
  }

  // ── Single delete ──────────────────────────────────────────────
  async function handleDelete(id: string, name: string, avatar?: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteUser(id);
      router.refresh();
    });
  }

  // ── Export CSV ─────────────────────────────────────────────────
  function handleExport() {
    const rows = [
      ["Name","Email","Phone","Status","Total Spend","Joined"],
      ...filtered.map(u => [
        u.name, u.email, u.phone || "",
        u.status, u.totalSpend,
        new Date(u.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
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
              placeholder="Search name, email, phone..."
              className="search-inp"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter toggle button */}
          <button
            className={`btn-outline${showFilters ? " filter-active" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
            <ChevronDown size={12} style={{ transition: "transform 0.15s", transform: showFilters ? "rotate(180deg)" : "none" }} />
          </button>
        </div>

        <div className="toolbar-right">
          <button className="btn-outline" onClick={handleExport}>
            <Download size={13} /> Export CSV
          </button>
          <Link href="/admin/users/new" className="btn-primary">
            + Add User
          </Link>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-panel-inner">
            <div className="filter-group">
              <label className="filter-label">Min Spend (₹)</label>
              <input
                type="number" min={0} placeholder="0"
                className="filter-inp"
                value={spendMin}
                onChange={e => { setSpendMin(e.target.value); setPage(1); }}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Max Spend (₹)</label>
              <input
                type="number" min={0} placeholder="Any"
                className="filter-inp"
                value={spendMax}
                onChange={e => { setSpendMax(e.target.value); setPage(1); }}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                className="filter-clear-btn"
                onClick={() => {
                  setSpendMin("");
                  setSpendMax("");
                  setPage(1);
                }}
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Status tabs ── */}
      <div className="status-tabs">
        {[
          { l: "All Users",  k: "all",       n: users.length           },
          { l: "Active",     k: "active",    n: countMap.active    || 0 },
          { l: "Inactive",   k: "inactive",  n: countMap.inactive  || 0 },
          { l: "Suspended",  k: "suspended", n: countMap.suspended || 0 },
        ].map(t => (
          <button
            key={t.k}
            className={`stab${statusFilter === t.k ? " stab-active" : ""}`}
            onClick={() => { setStatusFilter(t.k); setPage(1); clearSelection(); }}
          >
            {t.l} <span className="stab-count">{t.n}</span>
          </button>
        ))}
      </div>

      {/* ── Bulk action bar — shown when items selected ── */}
      {someSelected && (
        <div className="bulk-bar">
          <div className="bulk-bar-left">
            <span className="bulk-count">
              <Check size={13} /> {selected.size} selected
            </span>
            <button className="bulk-bar-clear" onClick={clearSelection}>
              <X size={12} /> Clear
            </button>
          </div>
          <div className="bulk-bar-actions">
            <button
              className="bulk-btn bulk-activate"
              onClick={() => handleBulkStatus("active")}
              disabled={bulkLoading}
            >
              <UserCheck size={13} /> Set Active
            </button>
            <button
              className="bulk-btn bulk-deactivate"
              onClick={() => handleBulkStatus("inactive")}
              disabled={bulkLoading}
            >
              <UserX size={13} /> Set Inactive
            </button>
            <button
              className="bulk-btn bulk-delete"
              onClick={handleBulkDelete}
              disabled={bulkLoading}
            >
              <Trash2 size={13} /> {bulkLoading ? "Deleting…" : "Delete Selected"}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="cb"
                    checked={allOnPageSelected}
                    ref={el => {
                      if (el) el.indeterminate = !allOnPageSelected && paginated.some(u => selected.has(u._id));
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th>User</th>
                <th>Contact</th>
                <th>Total Spend</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af" }}>
                    {search || activeFilterCount > 0
                      ? "No users match your search/filters."
                      : "No users yet."
                    }
                  </td>
                </tr>
              ) : (
                paginated.map((u, i) => {
                  const ac       = AVATAR_COLORS[(users.indexOf(u)) % AVATAR_COLORS.length];
                  const initials = u.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  const badge    = STATUS_BADGE[u.status] || STATUS_BADGE.inactive;
                  const isChecked = selected.has(u._id);

                  return (
                    <tr key={u._id} className={isChecked ? "row-selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          className="cb"
                          checked={isChecked}
                          onChange={() => toggleOne(u._id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            className="user-av"
                            style={!u.avatar ? { background: `${ac}18`, color: ac, border: `1.5px solid ${ac}40` } : {}}
                          >
                            {u.avatar ? (
                              <Image
                                src={`/uploads/avatars/${u.avatar}`}
                                alt={u.name}
                                width={38} height={38}
                                style={{ objectFit: "cover", borderRadius: 10 }}
                              />
                            ) : (
                              <span style={{ fontSize: "0.78rem", fontFamily: "DM Sans, sans-serif", fontWeight: 700 }}>
                                {initials}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="user-name">{u.name}</p>
                            <p className="user-email">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <span className="contact-row"><Mail size={11} /> {u.email}</span>
                          <span className="contact-row"><Phone size={11} /> {u.phone || "—"}</span>
                        </div>
                      </td>
                      <td className="spend-cell">₹{u.totalSpend.toLocaleString("en-IN")}</td>
                      <td>
                        <span className={badge.cls}>
                          <span className="sdot" style={{ background: badge.dot }} />
                          {u.status}
                        </span>
                      </td>
                      <td className="date-cell">
                        {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <Link href={`/admin/users/edit/${u._id}`} className="btn-edit">Edit</Link>
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(u._id, u.name, u.avatar)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="pagination">
          <span className="pag-info">
            {filtered.length === 0
              ? "No results"
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} ${fromDB ? "users" : "demo users"}`
            }
          </span>
          <div className="pag-btns">
            <button
              className="pag-btn"
              disabled={safePage === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ opacity: safePage === 1 ? 0.4 : 1 }}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx-1] === "number" && (p as number) - (arr[idx-1] as number) > 1)
                  acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`dots-${i}`} className="pag-btn" style={{ cursor: "default", border: "none" }}>…</span>
                ) : (
                  <button
                    key={p}
                    className={`pag-btn${p === safePage ? " active" : ""}`}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )
            }
            <button
              className="pag-btn"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ opacity: safePage === totalPages ? 0.4 : 1 }}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </>
  );
}