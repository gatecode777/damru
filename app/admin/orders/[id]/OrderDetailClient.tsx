"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, ChevronDown, MapPin, QrCode,
  ShoppingBag, CreditCard, Package, CheckCircle, Truck, XCircle, Clock, RotateCcw, Undo2,
} from "lucide-react";
import { updateOrderStatus, updatePaymentStatus, cancelOrder } from "@/app/actions/orders";
import { useToast } from "@/components/admin/Toast";
import { getAdminResponseError } from "@/lib/admin-error";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

const ORDER_STATUSES = [
  { key: "pending",          label: "Pending",       icon: Clock,        color: "#f59e0b" },
  { key: "confirmed",        label: "Confirmed",     icon: CheckCircle,  color: "#3b82f6" },
  { key: "preparing",        label: "Preparing",     icon: Package,      color: "#8b5cf6" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck,     color: "#06b6d4" },
  { key: "delivered",        label: "Delivered",     icon: CheckCircle,  color: "#16a34a" },
  { key: "cancelled",        label: "Cancelled",     icon: XCircle,      color: "#dc2626" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending:          { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  confirmed:        { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  preparing:        { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
  out_for_delivery: { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" },
  delivered:        { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  cancelled:        { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
};

const PAY_COLORS: Record<string, string> = {
  pending: "#f59e0b", paid: "#16a34a", failed: "#dc2626",
  refund_pending: "#f59e0b", partially_refunded: "#0e7490", refunded: "#6d28d9",
};
const PAY_LABELS: Record<string, string> = {
  pending: "Pending", paid: "Paid", failed: "Failed",
  refund_pending: "Refund Processing", partially_refunded: "Partially Refunded", refunded: "Refunded",
};
const PAY_METHOD: Record<string, string>  = { cod: "Cash on Delivery", razorpay: "Online Payment (Razorpay)", upi: "UPI (Legacy Razorpay)", card: "Card (Legacy Razorpay)" };

const lbl: React.CSSProperties = { fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };
const val: React.CSSProperties = { fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", color: "#111827", fontWeight: 500 };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.95rem", fontWeight: 700, color: "#111827", margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

export default function OrderDetailClient({ order: initialOrder, perms }: { order: any; perms?: Perms }) {
  const router = useRouter();
  const toast = useToast();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.orders?.[action]);
  
  const [order,      setOrder]      = useState(initialOrder);
  const [isPending,  startTransition] = useTransition();
  const [showStatus, setShowStatus] = useState(false);
  const [showPay,    setShowPay]    = useState(false);

  // Refund modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  // One id per refund ATTEMPT (not per click of the input) — reused across
  // retries of the same submission so a double-click/network-retry can't
  // create two refunds; cleared once a new modal session starts.
  const refundRequestIdRef = useRef<string | null>(null);

  const [reconciling, setReconciling] = useState(false);

  const statusesToUse = ORDER_STATUSES.filter(s => {
    if (order.tableNumber && s.key === "out_for_delivery") return false;
    return true;
  }).map(s => {
    if (s.key === "delivered" && order.tableNumber) {
      return { ...s, label: "Served" };
    }
    return s;
  });

  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
  const currentStatusDef = statusesToUse.find(s => s.key === order.status);

  function notify(msg: string) { toast.success(msg); }

  function handleStatusChange(status: string) {
    if (!can("edit")) return;
    if (status === order.status) { setShowStatus(false); return; }
    setShowStatus(false);
    startTransition(async () => {
      await updateOrderStatus(order._id, status);
      setOrder((prev: any) => ({ ...prev, status }));
      notify(`Status updated to ${status.replace(/_/g, " ")}`);
      router.refresh();
    });
  }

  function handlePayChange(paymentStatus: string) {
    if (!can("edit")) return;
    if (paymentStatus === order.paymentStatus) { setShowPay(false); return; }
    setShowPay(false);
    startTransition(async () => {
      await updatePaymentStatus(order._id, paymentStatus);
      setOrder((prev: any) => ({ ...prev, paymentStatus }));
      notify("Payment status updated");
      router.refresh();
    });
  }

  function handleCancel() {
    if (!can("delete")) return;
    if (!confirm(`Cancel order ${order.orderId}? This cannot be undone.`)) return;
    startTransition(async () => {
      await cancelOrder(order._id);
      setOrder((prev: any) => ({ ...prev, status: "cancelled" }));
      notify("Order cancelled");
      router.refresh();
    });
  }

  const remainingRefundable = order.paymentAmount != null
    ? Math.max(0, order.paymentAmount - (order.refundedAmount || 0) - (order.pendingRefundAmount || 0))
    : 0;

  function openRefundModal() {
    if (!refundRequestIdRef.current) {
      refundRequestIdRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setRefundAmount(String(remainingRefundable));
    setRefundReason("");
    setRefundNote("");
    setRefundError("");
    setShowRefundModal(true);
  }

  async function submitRefund() {
    if (!can("delete")) return;
    const amount = Math.round(Number(refundAmount));
    if (!amount || amount <= 0) { setRefundError("Enter a valid refund amount."); return; }
    if (amount > remainingRefundable) { setRefundError(`Cannot exceed the remaining refundable amount (₹${remainingRefundable}).`); return; }
    if (!refundReason.trim()) { setRefundError("A refund reason is required."); return; }

    setRefundSubmitting(true);
    setRefundError("");
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount, reason: refundReason.trim(), note: refundNote.trim() || undefined,
          refundRequestId: refundRequestIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { const message = await getAdminResponseError(res, "Refund could not be initiated. Please try again or check the payment status."); setRefundError(message); toast.error("Unable to submit refund", message); return; }

      refundRequestIdRef.current = null; // this attempt is done — a fresh refund gets a new id
      setShowRefundModal(false);
      notify(data.refund?.status === "processed" ? "Refund processed" : "Refund request submitted");
      router.refresh();
    } catch {
      setRefundError("Something went wrong. Please try again.");
    } finally {
      setRefundSubmitting(false);
    }
  }

  async function handleRecheckPayment() {
    if (!can("edit") || reconciling) return;
    setReconciling(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/reconcile-payment`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) { toast.error("Unable to refresh payment status", await getAdminResponseError(res, "Please try again.")); return; }
      toast.success("Payment status refreshed");
      if (data.reconciled) router.refresh();
    } catch {
      toast.error("Unable to refresh payment status", "Please try again.");
    } finally {
      setReconciling(false);
    }
  }

  const progressIdx   = statusesToUse.findIndex(s => s.key === order.status);
  const isCancelled   = order.status === "cancelled";
  const isDelivered   = order.status === "delivered";

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back + header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/admin/orders"
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280", textDecoration: "none", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", background: "#f3f4f6", borderRadius: 8, padding: "7px 12px" }}>
            <ArrowLeft size={14}/> Back to Orders
          </Link>
          <div>
            <h2 style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#111827", margin: 0 }}>{order.orderId}</h2>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{fmtDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Actions - only show if user has edit or delete permissions */}
        {(can("edit") || can("delete")) && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isPending && <Loader2 size={16} style={{ color: "#f97316", animation: "spin 0.8s linear infinite" }} />}

            {/* Change Status dropdown - only if can edit */}
            {!isCancelled && can("edit") && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatus(v => !v)}
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {currentStatusDef?.label ?? order.status.replace(/_/g," ")}
                  <ChevronDown size={13}/>
                </button>
                {showStatus && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 999, minWidth: 200, overflow: "hidden" }}>
                    {statusesToUse.filter(s => s.key !== "cancelled").map(s => {
                      const Icon = s.icon;
                      return (
                        <button key={s.key} onClick={() => handleStatusChange(s.key)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: order.status === s.key ? "#fff7ed" : "none", border: "none", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: order.status === s.key ? "#f97316" : "#374151", fontWeight: order.status === s.key ? 600 : 400, textAlign: "left" }}>
                          <Icon size={14} style={{ color: s.color, flexShrink: 0 }} />
                          {s.label}
                          {order.status === s.key && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓ Current</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Payment status dropdown — COD only. For Razorpay orders, paymentStatus
                is backend-authoritative (verify/webhook/reconciliation/refunds) and
                must never be hand-typed by an admin; see the Refund/Recheck actions
                below instead. */}
            {can("edit") && order.paymentMethod === "cod" && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowPay(v => !v)}
                  style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: PAY_COLORS[order.paymentStatus] ?? "#374151" }}>
                  <CreditCard size={13}/>
                  {PAY_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  <ChevronDown size={13}/>
                </button>
                {showPay && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 999, minWidth: 160, overflow: "hidden" }}>
                    {["pending","paid","failed"].map(p => (
                      <button key={p} onClick={() => handlePayChange(p)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: order.paymentStatus === p ? "#fff7ed" : "none", border: "none", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: order.paymentStatus === p ? "#f97316" : "#374151", fontWeight: order.paymentStatus === p ? 600 : 400, textAlign: "left" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: PAY_COLORS[p], flexShrink: 0 }}/>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                        {order.paymentStatus === p && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recheck Payment — syncs internal state to Razorpay's own trusted
                record; never lets the admin directly set "Paid". */}
            {can("edit") && order.paymentMethod !== "cod" && order.paymentStatus === "pending" && order.razorpayOrderId && (
              <button onClick={handleRecheckPayment} disabled={reconciling}
                style={{ background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <RotateCcw size={13} style={reconciling ? { animation: "spin 0.8s linear infinite" } : undefined} />
                {reconciling ? "Checking…" : "Recheck Payment"}
              </button>
            )}

            {/* Refund — only for a Razorpay order with remaining refundable balance */}
            {can("delete") && order.paymentMethod !== "cod" && remainingRefundable > 0 && (
              <button onClick={openRefundModal}
                style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Undo2 size={13}/> Refund
              </button>
            )}

            {/* Cancel - only if can delete and order not cancelled/delivered */}
            {!isCancelled && !isDelivered && can("delete") && (
              <button onClick={handleCancel} disabled={isPending}
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                Cancel Order
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress pipeline - visible even without edit perms */}
      {!isCancelled && (
        <Card>
          <CardHeader title="Order Progress" />
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {statusesToUse.filter(s => s.key !== "cancelled").map((s, i, arr) => {
              const active  = progressIdx >= i;
              const current = order.status === s.key;
              const Icon    = s.icon;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : "none", minWidth: 80 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: active ? s.color : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", border: current ? `3px solid ${s.color}` : "3px solid transparent", boxShadow: current ? `0 0 0 3px ${s.color}30` : "none", transition: "all 0.2s" }}>
                      <Icon size={16} style={{ color: active ? "#fff" : "#9ca3af" }} />
                    </div>
                    <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.68rem", fontWeight: current ? 700 : 400, color: active ? s.color : "#9ca3af", textAlign: "center", whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, height: 3, background: progressIdx > i ? s.color : "#f3f4f6", margin: "0 4px", marginTop: -16, borderRadius: 2, transition: "background 0.2s" }} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Order items */}
          <Card>
            <CardHeader title="Order Items" subtitle={`${order.items?.length} item${order.items?.length !== 1 ? "s" : ""}`} />
            <div style={{ padding: "0 20px" }}>
              {order.items?.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < order.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  {item.image ? (
                    <img src={`/uploads/menu-items/${item.image}`} alt={item.name} style={{ width: 52, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 44, background: "#f3f4f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>🍽️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    {item.custom && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#6b7280", margin: 0 }}>{item.custom}</p>}
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>₹{item.price} × {item.qty}</p>
                  </div>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "#111827", margin: 0, flexShrink: 0 }}>₹{item.price * item.qty}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader title="Order Notes" />
              <div style={{ padding: "14px 20px" }}>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", color: "#374151", margin: 0, fontStyle: "italic" }}>"{order.notes}"</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Price summary */}
          <Card>
            <CardHeader title="Price Summary" />
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Subtotal",  value: `₹${order.subtotal}` },
                ...(order.discount > 0 ? [{ label: `Discount (${order.couponCode})`, value: `−₹${order.discount}`, green: true }] : []),
                { label: "Tax",       value: `₹${order.tax}` },
                { label: "Shipping",  value: `₹${order.shipping}` },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ ...lbl, textTransform: "none", marginBottom: 0, fontSize: "0.82rem", color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 500, color: (row as any).green ? "#16a34a" : "#374151" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ borderTop: "1.5px solid #f3f4f6", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>Total</span>
                <span style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#f97316" }}>₹{order.total}</span>
              </div>
            </div>
          </Card>

          {/* Payment info */}
          <Card>
            <CardHeader title="Payment" />
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={lbl}>Method</span>
                <span style={val}>{PAY_METHOD[order.paymentMethod] ?? order.paymentMethod}</span>
              </div>
              <div>
                <span style={lbl}>Status</span>
                <span style={{ ...val, color: PAY_COLORS[order.paymentStatus] ?? "#374151", fontWeight: 700 }}>
                  {PAY_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </div>
              {order.paymentAmount != null && (
                <div>
                  <span style={lbl}>Captured Amount (Razorpay)</span>
                  <span style={val}>₹{order.paymentAmount}</span>
                </div>
              )}
              {order.refundedAmount > 0 && (
                <div>
                  <span style={lbl}>Refunded Amount</span>
                  <span style={{ ...val, color: "#6d28d9" }}>₹{order.refundedAmount}</span>
                </div>
              )}
              {order.paymentMethod !== "cod" && order.paymentAmount > 0 && (
                <div>
                  <span style={lbl}>Remaining Refundable</span>
                  <span style={val}>₹{remainingRefundable}</span>
                </div>
              )}
              {order.razorpayOrderId && (
                <div>
                  <span style={lbl}>Razorpay Order ID</span>
                  <span style={{ ...val, fontFamily: "monospace", fontSize: "0.78rem" }}>{order.razorpayOrderId}</span>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div>
                  <span style={lbl}>Razorpay Payment ID</span>
                  <span style={{ ...val, fontFamily: "monospace", fontSize: "0.78rem" }}>{order.razorpayPaymentId}</span>
                </div>
              )}
              {order.paidAt && (
                <div>
                  <span style={lbl}>Paid At</span>
                  <span style={val}>{fmtDate(order.paidAt)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader title="Customer" />
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={lbl}>Name</span>
                <span style={val}>{order.userName}</span>
              </div>
              <div>
                <span style={lbl}>Email</span>
                <a href={`mailto:${order.userEmail}`} style={{ ...val, color: "#f97316", textDecoration: "none" }}>{order.userEmail}</a>
              </div>
              {order.userPhone && (
                <div>
                  <span style={lbl}>Phone</span>
                  <a href={`tel:${order.userPhone}`} style={{ ...val, color: "#f97316", textDecoration: "none" }}>{order.userPhone}</a>
                </div>
              )}
            </div>
          </Card>

          {/* Delivery address OR Dine-In Table */}
          <Card>
            <CardHeader title={order.tableNumber ? "Dine-in Table" : "Delivery Address"} />
            <div style={{ padding: "14px 20px" }}>
              {order.tableNumber ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <QrCode size={16} style={{ color: "#f97316", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", lineHeight: 1.7 }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>Dine-in Order</p>
                    <p style={{ margin: 0 }}>Table Number: <strong>{order.tableNumber}</strong></p>
                    {order.tableName && <p style={{ margin: 0 }}>Table Label: {order.tableName}</p>}
                    <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Type: QR Code Scan Ordering</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <MapPin size={16} style={{ color: "#f97316", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", lineHeight: 1.7 }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>{order.deliveryAddress?.fullName}</p>
                    <p style={{ margin: 0 }}>{order.deliveryAddress?.house}{order.deliveryAddress?.area ? `, ${order.deliveryAddress.area}` : ""}</p>
                    <p style={{ margin: 0 }}>{order.deliveryAddress?.city}, {order.deliveryAddress?.state} {order.deliveryAddress?.pincode}</p>
                    <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{order.deliveryAddress?.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showStatus || showPay) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => { setShowStatus(false); setShowPay(false); }} />
      )}

      {/* Refund confirmation modal — high-impact action, requires deliberate confirmation */}
      {showRefundModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => !refundSubmitting && setShowRefundModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "#111827", margin: "0 0 4px" }}>Refund Order {order.orderId}</p>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", color: "#6b7280", margin: "0 0 16px" }}>
              Customer: {order.userName} · Captured: ₹{order.paymentAmount} · Already refunded: ₹{order.refundedAmount || 0}
            </p>

            <label style={{ ...lbl, marginBottom: 6 }}>Refund Amount (max ₹{remainingRefundable})</label>
            <input type="number" min={1} max={remainingRefundable} value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "DM Sans,sans-serif", fontSize: "0.9rem", marginBottom: 14 }} />

            <label style={{ ...lbl, marginBottom: 6 }}>Reason</label>
            <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "DM Sans,sans-serif", fontSize: "0.9rem", marginBottom: 14 }}>
              <option value="">Select a reason…</option>
              <option value="Customer cancellation">Customer cancellation</option>
              <option value="Item unavailable">Item unavailable</option>
              <option value="Duplicate payment">Duplicate payment</option>
              <option value="Service issue">Service issue</option>
              <option value="Admin correction">Admin correction</option>
              <option value="Other">Other</option>
            </select>

            <label style={{ ...lbl, marginBottom: 6 }}>Note (optional)</label>
            <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)} rows={2}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "DM Sans,sans-serif", fontSize: "0.85rem", resize: "vertical", marginBottom: 14 }} />

            {refundError && (
              <p style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", margin: "0 0 14px" }}>
                {refundError}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowRefundModal(false)} disabled={refundSubmitting}
                style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "9px 16px", fontFamily: "DM Sans,sans-serif", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={submitRefund} disabled={refundSubmitting}
                style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontFamily: "DM Sans,sans-serif", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: refundSubmitting ? 0.6 : 1 }}>
                {refundSubmitting ? "Processing…" : `Refund ₹${refundAmount || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
