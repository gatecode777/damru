"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, Eye, ShoppingBag } from "lucide-react";
import type { OrderRow } from "./page";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  pending:          { bg: "#fffbeb", color: "#b45309", dot: "#f59e0b" },
  confirmed:        { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  preparing:        { bg: "#f5f3ff", color: "#6d28d9", dot: "#8b5cf6" },
  out_for_delivery: { bg: "#ecfeff", color: "#0e7490", dot: "#06b6d4" },
  delivered:        { bg: "#f0fdf4", color: "#15803d", dot: "#16a34a" },
  cancelled:        { bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626" },
};

const PAY_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "#f59e0b", label: "Pending" },
  paid:    { color: "#16a34a", label: "Paid"    },
  failed:  { color: "#dc2626", label: "Failed"  },
};

const PAY_METHOD: Record<string, string> = {
  cod:  "COD", upi: "UPI", card: "Card",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

const ALL_STATUSES = ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"];

export default function OrdersClient({ orders: initialOrders, perms }: { orders: OrderRow[]; perms?: Perms }) {
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.orders?.[action]);
  
  // Note: Orders page typically only needs view permission since edit/delete are on detail page
  const canView = can("view");

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter,    setPayFilter]    = useState("all");

  const filtered = useMemo(() => {
    return initialOrders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (payFilter    !== "all" && o.paymentMethod !== payFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!o.orderId.toLowerCase().includes(q) &&
            !o.userName.toLowerCase().includes(q) &&
            !o.userEmail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [initialOrders, search, statusFilter, payFilter]);

  // If user doesn't have view permission, show access denied
  if (!canView) {
    return (
      <div className="card" style={{ padding: 60, textAlign: "center" }}>
        <ShoppingBag size={40} style={{ color: "#dc2626", margin: "0 auto 12px", display: "block" }} />
        <p style={{ fontFamily: "DM Sans, sans-serif", color: "#dc2626" }}>
          You don't have permission to view orders.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input className="search-inp" placeholder="Search order ID, name, email…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0 }}><X size={13}/></button>}
          </div>

          {/* Status tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["all", ...ALL_STATUSES].map(k => (
              <button key={k} className={`cat-tab${statusFilter === k ? " tab-active" : ""}`}
                onClick={() => setStatusFilter(k)}
                style={{ whiteSpace: "nowrap" }}>
                {k === "all" ? "All" : k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Payment filter */}
          <select className="filter-select" value={payFilter} onChange={e => setPayFilter(e.target.value)}>
            <option value="all">All Payments</option>
            <option value="cod">COD</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "60px 20px" }}>
            <ShoppingBag size={40} />
            <p>{search || statusFilter !== "all" ? "No orders match your filters." : "No orders yet."}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order._id}>
                    <td>
                      <span style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "#f97316", letterSpacing: "0.03em" }}>
                        {order.orderId}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: "DM Sans,sans-serif" }}>
                        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", margin: 0 }}>{order.userName}</p>
                        <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{order.userEmail}</p>
                        {order.tableNumber && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", padding: "1px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700 }}>
                            Table: {order.tableNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151" }}>
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: "DM Sans,sans-serif" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#111827", margin: 0 }}>₹{order.total}</p>
                        {order.discount > 0 && (
                          <p style={{ fontSize: "0.72rem", color: "#16a34a", margin: 0 }}>−₹{order.discount} off</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem" }}>
                        <p style={{ fontWeight: 600, margin: 0 }}>{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</p>
                        <p style={{ color: PAY_STATUS[order.paymentStatus]?.color, margin: 0, fontWeight: 500 }}>
                          {PAY_STATUS[order.paymentStatus]?.label}
                        </p>
                      </div>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#6b7280" }}>
                        {fmtDate(order.createdAt)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${order._id}`}
                        style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#f97316", borderRadius: 7, padding: "6px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontFamily: "DM Sans,sans-serif" }}>
                        <Eye size={13}/> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.78rem", color: "#9ca3af", textAlign: "right" }}>
        Showing {filtered.length} of {initialOrders.length} orders
      </p>
    </>
  );
}