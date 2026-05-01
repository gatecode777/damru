"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, ChevronDown, MapPin,
  ShoppingBag, CreditCard, Package, CheckCircle, Truck, XCircle, Clock,
} from "lucide-react";
import { updateOrderStatus, updatePaymentStatus, cancelOrder } from "@/app/actions/orders";

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

const PAY_COLORS: Record<string, string> = { pending: "#f59e0b", paid: "#16a34a", failed: "#dc2626" };
const PAY_METHOD: Record<string, string>  = { cod: "Cash on Delivery", upi: "UPI", card: "Credit Card" };

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

export default function OrderDetailClient({ order: initialOrder }: { order: any }) {
  const router = useRouter();
  const [order,      setOrder]      = useState(initialOrder);
  const [isPending,  startTransition] = useTransition();
  const [showStatus, setShowStatus] = useState(false);
  const [showPay,    setShowPay]    = useState(false);
  const [feedback,   setFeedback]   = useState("");

  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
  const currentStatusDef = ORDER_STATUSES.find(s => s.key === order.status);

  function notify(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); }

  function handleStatusChange(status: string) {
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
    if (!confirm(`Cancel order ${order.orderId}? This cannot be undone.`)) return;
    startTransition(async () => {
      await cancelOrder(order._id);
      setOrder((prev: any) => ({ ...prev, status: "cancelled" }));
      notify("Order cancelled");
      router.refresh();
    });
  }

  const progressIdx   = ORDER_STATUSES.findIndex(s => s.key === order.status);
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

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isPending && <Loader2 size={16} style={{ color: "#f97316", animation: "spin 0.8s linear infinite" }} />}

          {/* Change Status dropdown */}
          {!isCancelled && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowStatus(v => !v)}
                style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {currentStatusDef?.label ?? order.status.replace(/_/g," ")}
                <ChevronDown size={13}/>
              </button>
              {showStatus && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 999, minWidth: 200, overflow: "hidden" }}>
                  {ORDER_STATUSES.filter(s => s.key !== "cancelled").map(s => {
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

          {/* Payment status dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowPay(v => !v)}
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: PAY_COLORS[order.paymentStatus] ?? "#374151" }}>
              <CreditCard size={13}/>
              {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
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

          {/* Cancel */}
          {!isCancelled && !isDelivered && (
            <button onClick={handleCancel} disabled={isPending}
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "10px 16px", borderRadius: 10, fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>
          ✓ {feedback}
        </div>
      )}

      {/* Progress pipeline */}
      {!isCancelled && (
        <Card>
          <CardHeader title="Order Progress" />
          <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {ORDER_STATUSES.filter(s => s.key !== "cancelled").map((s, i, arr) => {
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
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </span>
              </div>
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

          {/* Delivery address */}
          <Card>
            <CardHeader title="Delivery Address" />
            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <MapPin size={16} style={{ color: "#f97316", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#374151", lineHeight: 1.7 }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>{order.deliveryAddress?.fullName}</p>
                  <p style={{ margin: 0 }}>{order.deliveryAddress?.house}{order.deliveryAddress?.area ? `, ${order.deliveryAddress.area}` : ""}</p>
                  <p style={{ margin: 0 }}>{order.deliveryAddress?.city}, {order.deliveryAddress?.state} {order.deliveryAddress?.pincode}</p>
                  <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{order.deliveryAddress?.phone}</p>
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showStatus || showPay) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => { setShowStatus(false); setShowPay(false); }} />
      )}
    </>
  );
}