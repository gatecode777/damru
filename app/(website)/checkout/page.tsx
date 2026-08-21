"use client";

import "@/styles/website/checkout.css";
import { fmtINR } from "@/lib/formatDate";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";
import { useRewards } from "@/lib/rewards/RewardsProvider";
import { trackRewardEvent } from "@/lib/rewards/rewardAnalytics";
import { useToast } from "@/components/website/Toast";
import { getSafeUserMessage, getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

// Minimal shape of the global Razorpay Checkout constructor loaded via the
// external checkout.js script — not the full SDK, just what this page uses.
interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: () => void) => void;
}
interface RazorpayCheckoutOptions {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

interface Address {
  _id: string; label: string; fullName: string; phone: string;
  house: string; area: string; city: string; state: string;
  pincode: string; isDefault: boolean;
}

const emptyForm = {
  label: "Home", fullName: "", phone: "", house: "",
  area: "", city: "", state: "", pincode: "", isDefault: false,
};

export default function CheckoutPage() {
  const toast = useToast();
  const router = useRouter();
  const { items, clearCart, syncCart, isLoggedIn } = useCart();
  const { dashboard: rewardsDashboard } = useRewards();
  const [requestedDamru, setRequestedDamru] = useState("");
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [quote, setQuote] = useState<{ subtotal: number; couponDiscount: number; deliveryFee: number; taxAmount: number; damruDiscount: number; finalAmount: number; freeDeliveryApplied: boolean } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  // ── Dine-in state ─────────────────────────────────────────
  const [isDineIn, setIsDineIn] = useState(false);
  const [tableInfo, setTableInfo] = useState<{ tableId: string; tableNumber: string; tableName?: string; token: string } | null>(null);

  // ── Step state ────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Address state ─────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(true);
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [addrForm, setAddrForm] = useState({ ...emptyForm });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState("");
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [addrDeleting, setAddrDeleting] = useState(false);

  // ── Payment state ─────────────────────────────────────────
  const [payMethod, setPayMethod] = useState<"cod" | "razorpay" | null>(null);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isPaymentStarting, setIsPaymentStarting] = useState(false);
  const paymentStartingRef = useRef(false);
  const retryHydratedRef = useRef(false);
  const [placedOrder, setPlacedOrder] = useState<{
    orderId: string; internalOrderId: string; total: number;
    redeemedAmount?: number; redeemedDiscount?: number; redeemError?: string;
    // Only meaningful for non-COD orders — COD's paymentStatus stays undefined,
    // which the success screen below treats identically to "paid".
    paymentStatus?: "paid" | "pending" | "failed";
  } | null>(null);

  useEffect(() => {
    if (retryHydratedRef.current) return;
    retryHydratedRef.current = true;
    const retryOrderId = new URLSearchParams(window.location.search).get("retryOrder");
    if (!retryOrderId) return;
    fetch("/api/orders").then(async (response) => {
      const data = await response.json();
      const order = (data.orders || []).find((item: { _id: string }) => item._id === retryOrderId);
      if (!order || order.paymentMethod === "cod" || order.paymentStatus === "paid" || order.status === "cancelled") {
        setOrderError("This order is not available for payment retry.");
        return;
      }
      setPayMethod("razorpay");
      setPlacedOrder({ orderId: order.orderId, internalOrderId: order._id, total: order.paymentAmount ?? order.total, paymentStatus: order.paymentStatus === "failed" ? "failed" : "pending" });
    }).catch(() => setOrderError("Unable to load the order for payment retry."));
  }, []);

  // Loads Razorpay's Checkout script on demand — never globally, only when an
  // online payment is actually about to start.
  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  // Backend determines and freezes the payable amount (order.total net of any
  // Damru already redeemed for this order) — this only ever opens Razorpay
  // Checkout for that server-returned amount, never a frontend-computed one.
  async function startRazorpayPayment(internalOrderId: string) {
    if (paymentStartingRef.current) return;
    paymentStartingRef.current = true;
    setIsPaymentStarting(true);
    setPaymentError("");
    toast.info("Preparing secure payment…", "Please wait while Razorpay is initialized.", { id: `payment-${internalOrderId}` });
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
      setPaymentError("Unable to load Razorpay. Please try again.");
      toast.error("Payment could not start", "Unable to load Razorpay. Please try again.", { id: `payment-${internalOrderId}` });
      paymentStartingRef.current = false;
      setIsPaymentStarting(false);
      return;
    }

    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: internalOrderId }),
      });
      const data = await res.json();
      if (data.error) {
        setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
        setPaymentError("Unable to prepare payment.");
        toast.error("Payment could not start", getUserResponseError(res,data,"Unable to prepare payment."), { id: `payment-${internalOrderId}` });
        paymentStartingRef.current = false;
        setIsPaymentStarting(false);
        return;
      }

      // Coupon/Damru covered the order entirely — backend already finalized
      // it as paid; never open a gateway popup for ₹0.
      if (data.zeroPayable) {
        await syncCart();
        setPlacedOrder(prev => prev && { ...prev, paymentStatus: "paid" });
        toast.success("Order confirmed", "No additional payment was required.", { id: `payment-${internalOrderId}` });
        paymentStartingRef.current = false;
        setIsPaymentStarting(false);
        return;
      }

      if (!window.Razorpay) {
        setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
        setPaymentError("Unable to load Razorpay. Please try again.");
        toast.error("Payment could not start", "Unable to load Razorpay. Please try again.", { id: `payment-${internalOrderId}` });
        paymentStartingRef.current = false;
        setIsPaymentStarting(false);
        return;
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Damru By Namo",
        description: `Order ${placedOrder?.orderId ?? ""}`,
        order_id: data.razorpayOrderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: internalOrderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              await syncCart();
              setPlacedOrder(prev => prev && { ...prev, paymentStatus: "paid" });
              toast.success("Payment successful", "Your order is now confirmed.", { id: `payment-${internalOrderId}` });
            } else {
              setPaymentError("Payment could not be verified. If money was deducted, please check your order status or contact support.");
              toast.error("Payment verification failed", "If money was deducted, check My Orders or contact support.", { id: `payment-${internalOrderId}` });
              setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
            }
          } catch {
            // The verify call itself failed (e.g. lost connection) — the payment
            // may still have gone through. Don't claim failure here; the
            // Razorpay webhook reconciles this asynchronously either way.
            setPaymentError("We couldn't confirm your payment right away. Check My Orders shortly — it updates automatically once confirmed.");
            toast.info("Payment verification pending", "Check My Orders shortly; it will update automatically.", { id: `payment-${internalOrderId}` });
          }
        },
        modal: {
          ondismiss: () => {
            void fetch("/api/payments/razorpay/fail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: internalOrderId, razorpayOrderId: data.razorpayOrderId }) });
            setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
            setPaymentError("Payment was cancelled.");
            toast.warning("Payment cancelled", "Your order is not confirmed. You can retry payment.", { id: `payment-${internalOrderId}` });
          },
        },
        theme: { color: "#e67e22" },
      });
      rzp.on("payment.failed", () => {
        void fetch("/api/payments/razorpay/fail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: internalOrderId, razorpayOrderId: data.razorpayOrderId }) });
        setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
        setPaymentError("Payment failed. You can retry below.");
        toast.error("Payment failed", "No payment was confirmed. Please retry.", { id: `payment-${internalOrderId}` });
      });
      rzp.open();
      paymentStartingRef.current = false;
      setIsPaymentStarting(false);
    } catch (error) {
      setPlacedOrder(prev => prev && { ...prev, paymentStatus: "failed" });
      setPaymentError("Unable to start payment. Please try again.");
      toast.error("Payment could not start", getUserErrorMessage(error), { id: `payment-${internalOrderId}` });
      paymentStartingRef.current = false;
      setIsPaymentStarting(false);
    }
  }

  // ── Coupon from cart (passed via sessionStorage) ──────────
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    // Display metadata only. All monetary values come from /api/checkout/quote.
    fetch("/api/checkout/config")
      .then(r => r.json())
      .then(cfg => setTaxLabel(cfg.tax?.label || "Tax"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!items.length || (!isDineIn && !selectedAddr)) { setQuote(null); setQuoteError(""); setQuoteLoading(false); return; }
      setQuoteLoading(true); setQuoteError("");
      try {
        const response = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            addressId: selectedAddr,
            couponCode,
            requestedDamru: Number(requestedDamru || 0),
            tableToken: isDineIn ? tableInfo?.token : undefined,
            items: items.map(item => ({ menuItemId: item.menuItemId, custom: item.custom, qty: item.qty })),
          }),
        });
        const data = await response.json();
        if (!response.ok) { setQuote(data.partialTotals || null); setQuoteError(data.error || "Unable to calculate order total."); return; }
        setQuote(data.totals);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") { setQuote(null); setQuoteError("Unable to calculate order total. Please try again."); }
      } finally { if (!controller.signal.aborted) setQuoteLoading(false); }
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [items, selectedAddr, couponCode, requestedDamru, isDineIn, tableInfo]);

  useEffect(() => {
    // Check for dine-in table session
    const tblSaved = sessionStorage.getItem("dinein_table");
    let isDineInOrder = false;
    if (tblSaved) {
      const tblObj = JSON.parse(tblSaved);
      setIsDineIn(true);
      setTableInfo(tblObj);
      setStep(3); // Start directly at Step 3 (Payment & Summary)
      isDineInOrder = true;
    }

    // Read applied coupon from sessionStorage if cart page set it
    const saved = sessionStorage.getItem("appliedCoupon");
    if (saved) { const c = JSON.parse(saved); setCouponCode(c.code); }
    loadAddresses(isDineInOrder);
  }, []);

  async function loadAddresses(isDineInOrder: boolean = false) {
    setAddrLoading(true);
    try {
      const res = await fetch("/api/address");
      const data = await res.json();
      if (res.status === 401) {
        if (isDineInOrder) {
          // Ignore redirection if guest is ordering directly at a table
          setAddresses([]);
          return;
        }
        router.push("/");
        return;
      }
      setAddresses(data.addresses || []);
      const def = (data.addresses || []).find((a: Address) => a.isDefault);
      if (def) setSelectedAddr(def._id);
      else if (data.addresses?.length) setSelectedAddr(data.addresses[0]._id);
    } catch { setAddresses([]); }
    finally { setAddrLoading(false); }
  }



  // ── Address form ──────────────────────────────────────────
  function openAddNew() { setEditingAddr(null); setAddrForm({ ...emptyForm }); setAddrError(""); setShowAddrModal(true); }
  function openEdit(a: Address) { setEditingAddr(a); setAddrForm({ label: a.label, fullName: a.fullName, phone: a.phone, house: a.house, area: a.area, city: a.city, state: a.state, pincode: a.pincode, isDefault: a.isDefault }); setAddrError(""); setShowAddrModal(true); }
  function closeModal() { setShowAddrModal(false); setEditingAddr(null); setAddrError(""); }

  async function handleSaveAddress() {
    if (!addrForm.fullName || !addrForm.phone || !addrForm.house || !addrForm.city || !addrForm.state || !addrForm.pincode) { setAddrError("All required fields must be filled."); toast.error("Address not saved", "All required fields must be filled."); return; }
    if (!/^[6-9]\d{9}$/.test(addrForm.phone.trim())) { setAddrError("Please enter a valid 10-digit phone number."); toast.error("Address not saved", "Please enter a valid 10-digit phone number."); return; }

    setAddrSaving(true); setAddrError("");
    try {
      const res = await fetch("/api/address", {
        method: editingAddr ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingAddr ? { id: editingAddr._id, ...addrForm } : addrForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) { const message=getUserResponseError(res,data,"Unable to save address.");setAddrError(message);toast.error("Address not saved",message,{id:"checkout-address"});return; }
      await loadAddresses();
      if (data.address) setSelectedAddr(data.address._id);
      toast.success(editingAddr ? "Address updated" : "Address added");
      closeModal();
    } catch { setAddrError("Failed to save. Please try again."); toast.error("Address not saved", "Please try again."); }
    finally { setAddrSaving(false); }
  }

  async function handleDeleteAddress() {
    if (!addressToDelete || addrDeleting) return;
    const id = addressToDelete._id;
    setAddrDeleting(true);
    try {
      const response = await fetch("/api/address", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) { const data=await response.json().catch(()=>null);toast.error("Address not deleted",getUserResponseError(response,data,"Please try again."),{id:"checkout-address-delete"});return; }
      if (selectedAddr === id) setSelectedAddr(null);
      setAddressToDelete(null);
      await loadAddresses();
      toast.success("Address deleted");
    } catch {
      toast.error("Address not deleted", "Please check your connection and try again.", { id: "checkout-address-delete" });
    } finally {
      setAddrDeleting(false);
    }
  }

  // ── Place order ───────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!isDineIn && !selectedAddr) { setOrderError("Please select a delivery address."); toast.error("Order not placed", "Please select a delivery address."); return; }
    if (items.length === 0) { setOrderError("Your cart is empty."); toast.error("Order not placed", "Your cart is empty."); return; }
    if (!payMethod) { setOrderError("Please select Cash on Delivery or Pay Online."); toast.error("Choose a payment method", "Select Cash on Delivery or Pay Online."); return; }
    if (!quote || quoteLoading || quoteError) { setOrderError(quoteError || "Please wait while we calculate your order total."); toast.error("Order total unavailable", quoteError || "Please wait and try again."); return; }
    if (payMethod !== "cod" && !isLoggedIn) {
      setOrderError("Online payment requires login. Please log in, or choose Cash on Delivery.");
      toast.error("Login required", "Log in for online payment or choose Cash on Delivery.");
      return;
    }
    setPlacing(true); setOrderError(""); setPaymentError("");
    try {
      const body: Record<string, unknown> = {
        paymentMethod: payMethod,
        couponCode,
        notes,
        requestedDamru: Number(requestedDamru || 0),
      };

      if (isDineIn && tableInfo) {
        body.tableToken = tableInfo.token;
        if (!isLoggedIn) {
          body.items = items.map(i => ({
            menuItemId: i.menuItemId,
            custom: i.custom,
            qty: i.qty
          }));
        }
      } else {
        body.addressId = selectedAddr;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) { const message=getUserResponseError(res,data,"Unable to prepare your order.");setOrderError(message);toast.error("Order not placed",message,{id:"checkout-order"});return; }

      sessionStorage.removeItem("appliedCoupon");
      sessionStorage.removeItem("dinein_table");

      const result: {
        orderId: string; internalOrderId: string; total: number;
        redeemedAmount?: number; redeemedDiscount?: number; redeemError?: string;
        paymentStatus?: "paid" | "pending" | "failed";
      } = {
        orderId: data.order.orderId, internalOrderId: data.order._id, total: data.order.total,
      };

      if (data.redemption) {
        if (data.redemption.success) {
          result.redeemedAmount = data.redemption.amount;
          result.redeemedDiscount = data.redemption.discount;
          trackRewardEvent("damru_redeemed", { amount: data.redemption.amount });
          toast.success("Damru redeemed", `${data.redemption.amount} Damru applied for a ₹${data.redemption.discount} discount.`, { id: "checkout-damru" });
        } else {
          result.redeemError = getSafeUserMessage(data.redemption.error,"Redemption failed.");
          toast.error("Damru not redeemed", result.redeemError, { id: "checkout-damru" });
        }
      }

      if (payMethod === "cod") {
        await clearCart();
        toast.success("Order confirmed", `Order #${result.orderId} is confirmed for Cash on Delivery.`, { id: "checkout-order" });
        setPlacedOrder(result);
      } else {
        setPlacedOrder({ ...result, paymentStatus: "pending" });
        await startRazorpayPayment(data.order._id);
      }
    } catch (error) { const message=getUserErrorMessage(error);setOrderError(message);toast.error("Order not placed",message,{id:"checkout-order"}); }
    finally { setPlacing(false); }
  }

  // ── Order success / payment-pending screen ─────────────────
  if (placedOrder) {
    // Non-COD order whose Razorpay payment hasn't been confirmed yet — do NOT
    // show "Order Placed!" until backend verification succeeds (webhook or
    // client verify). Failed/cancelled attempts get a Retry action using the
    // same internal order — no duplicate order is created.
    if (placedOrder.paymentStatus === "pending" || placedOrder.paymentStatus === "failed") {
      const failed = placedOrder.paymentStatus === "failed";
      return (
        <div className="checkout-container">
          <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Poppins, sans-serif" }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>{failed ? "⚠️" : "⏳"}</div>
            <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "1.8rem", color: "#111", marginBottom: 8 }}>
              {failed ? "Payment Not Completed" : "Processing Payment…"}
            </h2>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#e67e22", marginBottom: 4 }}>Order ID: {placedOrder.orderId}</p>
            <p style={{ color: "#666", marginBottom: 4 }}>
              {failed
                ? "Your order was saved but payment didn't go through. Your Damru balance wasn't affected."
                : "Confirming your payment — this only takes a moment."}
            </p>
            {paymentError && (
              <p style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 16px", display: "inline-block", margin: "12px 0", fontSize: 13, maxWidth: 420 }}>
                {paymentError}
              </p>
            )}
            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => startRazorpayPayment(placedOrder.internalOrderId)} disabled={isPaymentStarting}
                  style={{ background: "#e67e22", color: "#fff", border: "none", borderRadius: 10, padding: "12px 32px", fontFamily: "Poppins,sans-serif", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
                  {isPaymentStarting ? "Preparing secure payment…" : failed ? "Retry Payment" : "Pay Now"}
              </button>
              <button onClick={() => router.push("/my-profile?tab=orders")}
                style={{ background: "#f5f5f5", color: "#333", border: "none", borderRadius: 10, padding: "12px 32px", fontFamily: "Poppins,sans-serif", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
                View My Orders
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="checkout-container">
        <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Poppins, sans-serif" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "1.8rem", color: "#111", marginBottom: 8 }}>Order Placed!</h2>
          <p style={{ color: "#666", marginBottom: 4 }}>
            {isDineIn && tableInfo
              ? `Your order has been sent directly to Table ${tableInfo.tableNumber}.`
              : "Your order has been confirmed."}
          </p>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#e67e22", marginBottom: 4 }}>Order ID: {placedOrder.orderId}</p>
          <p style={{ color: "#666", marginBottom: 16 }}>Total: ₹{placedOrder.total} · Payment: {payMethod === "cod" ? (isDineIn ? "Pay at Counter / Cash" : "Cash on Delivery") : "Online Payment (Paid via Razorpay)"}</p>

          {placedOrder.redeemedAmount != null && (
            <p style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", display: "inline-block", marginBottom: 12, fontSize: 14 }}>
              🪙 {placedOrder.redeemedAmount} Damru Redeemed → {fmtINR(placedOrder.redeemedDiscount || 0)} discount recorded
            </p>
          )}
          {placedOrder.redeemError && (
            <p style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 16px", display: "inline-block", marginBottom: 12, fontSize: 13, maxWidth: 420 }}>
              Damru redemption didn&apos;t go through: {placedOrder.redeemError}. Your balance wasn&apos;t affected.
            </p>
          )}
          <p style={{ color: "#999", fontSize: 13, marginBottom: 32 }}>🎁 Damru from qualifying orders is credited once your order is delivered.</p>

          <button onClick={() => router.push("/menu")}
            style={{ background: "#e67e22", color: "#fff", border: "none", borderRadius: 10, padding: "12px 32px", fontFamily: "Poppins,sans-serif", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
            Order More Items
          </button>
        </div>
      </div>
    );
  }

  // ── Totals ────────────────────────────────────────────────
  const shipping = quote?.deliveryFee ?? 0;
  const tax = quote?.taxAmount ?? 0;
  const grandTotal = quote?.finalAmount ?? 0;

  const selectedAddress = addresses.find(a => a._id === selectedAddr);

  return (
    <div className="checkout-container">

      {/* ── STEPPER ── */}
      <div className="stepper">
        {(isDineIn ? [
          { n: 3, icon: "fa-solid fa-utensils", label: "Dine-in Order" },
        ] : [
          { n: 1, icon: "fa-solid fa-location-dot", label: "Address" },
          { n: 2, icon: "fa-solid fa-truck", label: "Shipping" },
          { n: 3, icon: "fa-solid fa-credit-card", label: "Payment" },
        ]).map(s => (
          <div key={s.n} className={`step${step >= s.n ? " active" : ""}`} id={`step${s.n}-tab`}>
            <div className="step-icon"><i className={s.icon}></i></div>
            <div className="step-text"><b>{isDineIn ? "Dine-in Mode" : `Step ${s.n}`}</b><span>{s.label}</span></div>
          </div>
        ))}
      </div>

      {/* ══ STEP 1: ADDRESS ══ */}
      {step === 1 && (
        <div className="checkout-layout active" id="layout-step1">
          <h2>Select Address</h2>

          {addrLoading ? (
            <p style={{ color: "#aaa", fontFamily: "Poppins,sans-serif" }}>Loading addresses…</p>
          ) : addresses.length === 0 ? (
            <p style={{ color: "#aaa", fontFamily: "Poppins,sans-serif" }}>No addresses saved. Add one below.</p>
          ) : (
            addresses.map(addr => (
              <div key={addr._id} className={`address-card${selectedAddr === addr._id ? " selected" : ""}`}
                onClick={() => {
                  setSelectedAddr(addr._id);
                  toast.info("Delivery address selected", addr.label, { id: "checkout-address-selected" });
                }}>
                <div className="radio-circle"></div>
                <div className="info">
                  <b>{addr.fullName} <span className="tag">{addr.label}</span></b>
                  <p style={{ fontSize: 13, color: "#666", margin: "8px 0" }}>
                    {addr.house}{addr.area ? `, ${addr.area}` : ""}, {addr.city}, {addr.state} {addr.pincode}
                  </p>
                  <span>{addr.phone}</span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                  <i className="fa-solid fa-pencil" style={{ color: "#e66a00", fontSize: 16, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); openEdit(addr); }}></i>
                  <i className="fa-solid fa-xmark" style={{ color: "#888", fontSize: 16, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); setAddressToDelete(addr); }}></i>
                </div>
              </div>
            ))
          )}

          <div className="add-address-bar" onClick={openAddNew}>
            <div className="plus-icon"><i className="fa-solid fa-plus"></i></div>
            <br />
            <span>Add New Address</span>
          </div>

          <div className="btn-row">
            <button className="btn btn-next" onClick={() => { if (!selectedAddr) { toast.error("Address required", "Please select or add an address."); return; } setStep(2); }}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* ══ STEP 2: SHIPPING ══ */}
      {step === 2 && (
        <div className="checkout-layout active" id="layout-step2">
          <h2>Shipment Method</h2>
          <div className="shipping-option">
            <div className="shipping-left">
              <div className="radio-circle" style={{ borderColor: "#e66a00", background: "#e66a00", boxShadow: "inset 0 0 0 4px #fff" }}></div>
              <b>{quote ? fmtINR(shipping) : quoteLoading ? "Calculating…" : fmtINR(0)}</b>
              <span style={{ color: "#666", fontSize: 13 }}>Regular shipment</span>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-back" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-next" onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      )}

      {/* ══ STEP 3: PAYMENT & SUMMARY ══ */}
      {step === 3 && (
        <div className="checkout-layout active" id="layout-step3">
          <div className="payment-grid">

            {/* Summary */}
            <div className="summary-card">
              <h3>Summary</h3>
              {items.map(item => (
                <div key={item.id} className="summary-item">
                  {item.image
                    ? <img src={`/uploads/menu-items/${item.image}`} alt={item.name} />
                    : <div style={{ width: 50, height: 50, background: "#f5f5f5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🍽️</div>
                  }
                  <div style={{ flex: 1, margin: "0 10px" }}>
                    <b>{item.name}</b>
                    {item.custom && <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{item.custom}</p>}
                    <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>× {item.qty}</p>
                  </div>
                  <b>₹{item.price * item.qty}</b>
                </div>
              ))}

              {isDineIn && tableInfo ? (
                <>
                  <p style={{ color: "#666", marginTop: 16 }}><strong>Dine-in Table:</strong></p>
                  <p style={{ color: "#e67e22", marginBottom: 10, fontSize: 14, fontWeight: 700 }}>
                    Table {tableInfo.tableNumber} {tableInfo.tableName ? `(${tableInfo.tableName})` : ""}
                  </p>
                </>
              ) : selectedAddress ? (
                <>
                  <p style={{ color: "#666", marginTop: 16 }}><strong>Delivery Address:</strong></p>
                  <p style={{ color: "#888", marginBottom: 10, fontSize: 13 }}>
                    {selectedAddress.fullName} · {selectedAddress.phone}<br />
                    {selectedAddress.house}{selectedAddress.area ? `, ${selectedAddress.area}` : ""}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                  </p>
                </>
              ) : null}

              <div style={{ marginTop: 16, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Subtotal</span><b>{quote ? fmtINR(quote.subtotal) : fmtINR(0)}</b>
                </div>
                {(quote?.couponDiscount || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#16a34a" }}>
                    <span>Coupon ({couponCode})</span><b>− {fmtINR(quote!.couponDiscount)}</b>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>{taxLabel}</span><b>{quote ? fmtINR(tax) : fmtINR(0)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Delivery</span><b>{fmtINR(quote ? shipping : 0)}</b>
                </div>
                {(quote?.damruDiscount || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#16a34a" }}><span>Damru</span><b>− {fmtINR(quote!.damruDiscount)}</b></div>}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <b style={{ fontSize: 18, color: "#e67e22" }}>{quote ? fmtINR(grandTotal) : quoteLoading ? "Calculating…" : fmtINR(0)}</b>
                </div>
                {quoteError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{quoteError}</p>}
              </div>

              {/* Redeem Damru */}
              {isLoggedIn && rewardsDashboard && rewardsDashboard.damruBalance > 0 && (
                <div className="rewards__redeem-box">
                  <p className="rewards__redeem-title">🪙 Redeem Damru — Available: {rewardsDashboard.damruBalance}</p>
                  <input
                    type="number"
                    min={0}
                    max={rewardsDashboard.damruBalance}
                    value={requestedDamru}
                    onChange={e => setRequestedDamru(e.target.value)}
                    placeholder="0"
                    style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontFamily: "Poppins,sans-serif", fontSize: 13, boxSizing: "border-box" }}
                  />
                  <p className="rewards__redeem-note">The backend validates your balance and shows the exact discount above.</p>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontFamily: "Poppins,sans-serif", fontSize: 13, color: "#666", display: "block", marginBottom: 4 }}>Order notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="e.g. No onions, extra spicy…"
                  style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", fontFamily: "Poppins,sans-serif", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Payment */}
            <div>
              <h3>Payment</h3>
              <div className="tab-header" role="radiogroup" aria-label="Payment method">
                {(["cod", "razorpay"] as const).map(m => (
                  <button key={m} type="button" role="radio" aria-checked={payMethod === m} className={`tab-link${payMethod === m ? " active" : ""}`} onClick={() => setPayMethod(m)}>
                    {m === "cod" ? "Cash on Delivery" : "Pay Online"}
                  </button>
                ))}
              </div>
              {!payMethod && <p style={{color:"#b45309",fontFamily:"Poppins,sans-serif",fontSize:13,marginTop:10}}>Choose how you want to pay before placing the order.</p>}

              {/* COD */}
              {payMethod === "cod" && (
                <div className="payment-method active" id="pay-cod">
                  <p>Pay with cash when your order is delivered.</p>
                  <div style={{ margin: "20px 0" }}>
                    <i className="fa-solid fa-money-bill-1-wave" style={{ fontSize: 40, color: "#2e7d32" }}></i>
                  </div>
                  <p>Pay the delivery agent in cash at the time of delivery.</p>
                  <p>Please keep exact change ready if possible.</p>
                  {orderError && <p style={{ color: "#dc2626", fontFamily: "Poppins,sans-serif", fontSize: 13 }}>⚠ {orderError}</p>}
                  <div className="btn-row">
                    {!isDineIn && <button className="btn btn-back" onClick={() => setStep(2)}>Back</button>}
<button className="btn btn-next" onClick={handlePlaceOrder} disabled={placing || quoteLoading || !quote || Boolean(quoteError)}>
                      {placing ? "Placing…" : "Place Order"}
                    </button>
                  </div>
                </div>
              )}

              {payMethod === "razorpay" && (
                <div className="payment-method active" id="pay-razorpay">
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 18, marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Secure Online Payment</p>
                    <p style={{ margin: "0 0 8px", color: "#555" }}>UPI · Credit/Debit Cards · Net Banking · Wallets</p>
                    <p style={{ margin: 0, color: "#777", fontSize: 12 }}>Payments are securely processed by Razorpay. Damru does not store your card, CVV, or UPI credentials.</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eee" }}><span>Order total</span><strong>{fmtINR(grandTotal)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}><span>Payable</span><strong>{fmtINR(grandTotal)}</strong></div>
                  {orderError && <p style={{ color: "#dc2626", fontFamily: "Poppins,sans-serif", fontSize: 13 }}>⚠ {orderError}</p>}
                  <div className="btn-row">
                    {!isDineIn && <button className="btn btn-back" onClick={() => setStep(2)}>Back</button>}
<button className="btn btn-next" onClick={handlePlaceOrder} disabled={placing || quoteLoading || !quote || Boolean(quoteError)}>
                      {placing ? "Preparing secure payment…" : !quote || quoteError ? "Total unavailable" : `Pay ${fmtINR(grandTotal)} Securely`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {addressToDelete && (
        <div
          className="address-confirm-overlay"
          onMouseDown={event => { if (event.target === event.currentTarget && !addrDeleting) setAddressToDelete(null); }}
        >
          <div className="address-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-address-title">
            <button
              type="button"
              className="address-confirm__close"
              aria-label="Close delete address dialog"
              disabled={addrDeleting}
              onClick={() => setAddressToDelete(null)}
            >
              <i className="fa-solid fa-xmark" />
            </button>

            <div className="address-confirm__icon"><i className="fa-regular fa-trash-can" /></div>
            <span className="address-confirm__eyebrow">Address book</span>
            <h2 id="delete-address-title">Remove this address?</h2>
            <p className="address-confirm__copy">This saved address will be removed from your Damru account.</p>

            <div className="address-confirm__preview">
              <div className="address-confirm__pin"><i className="fa-solid fa-location-dot" /></div>
              <div>
                <strong>{addressToDelete.label}</strong>
                <span>{addressToDelete.fullName} · {addressToDelete.phone}</span>
                <p>{addressToDelete.house}{addressToDelete.area ? `, ${addressToDelete.area}` : ""}, {addressToDelete.city}, {addressToDelete.state} {addressToDelete.pincode}</p>
              </div>
            </div>

            <div className="address-confirm__actions">
              <button type="button" className="address-confirm__cancel" disabled={addrDeleting} onClick={() => setAddressToDelete(null)}>Keep address</button>
              <button type="button" className="address-confirm__delete" disabled={addrDeleting} onClick={handleDeleteAddress}>
                {addrDeleting ? <><i className="fa-solid fa-spinner fa-spin" /> Removing…</> : <><i className="fa-regular fa-trash-can" /> Remove address</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT ADDRESS MODAL ══ */}
      {showAddrModal && (
        <div className="modal-overlay" id="addressModal" style={{ display: "flex" }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{editingAddr ? "Edit Address" : "New Address"}</h2>
              <i className="fa-solid fa-xmark" style={{ cursor: "pointer", fontSize: 20 }} onClick={closeModal}></i>
            </div>

            {addrError && <p style={{ color: "#dc2626", fontFamily: "Poppins,sans-serif", fontSize: 13, margin: "8px 0 0" }}>⚠ {addrError}</p>}

            <div className="form-grid">
              <div className="input-group full-width">
                <label>Label *</label>
                <select value={addrForm.label} onChange={e => setAddrForm(p => ({ ...p, label: e.target.value }))}>
                  <option>Home</option>
                  <option>Office</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="input-group">
                <label>Full Name *</label>
                <input type="text" placeholder="Full Name" value={addrForm.fullName}
                  onChange={e => setAddrForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Phone *</label>
                <input type="text" placeholder="e.g. 9876543210" value={addrForm.phone}
                  maxLength={10}
                  onChange={e => setAddrForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
              </div>
              <div className="input-group full-width">
                <label>House / Flat / Street *</label>
                <input type="text" placeholder="208, Shiv Vihar, MG Road" value={addrForm.house}
                  onChange={e => setAddrForm(p => ({ ...p, house: e.target.value }))} />
              </div>
              <div className="input-group full-width">
                <label>Area / Landmark</label>
                <input type="text" placeholder="Near City Mall (optional)" value={addrForm.area}
                  onChange={e => setAddrForm(p => ({ ...p, area: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Pincode *</label>
                <input type="text" placeholder="302034" value={addrForm.pincode}
                  maxLength={6}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setAddrForm(p => ({ ...p, pincode: val }));
                    if (val.length === 6) {
                      fetch(`https://api.postalpincode.in/pincode/${val}`)
                        .then(r => r.json())
                        .then(res => {
                          if (res && res[0] && res[0].Status === "Success" && res[0].PostOffice && res[0].PostOffice.length > 0) {
                            const po = res[0].PostOffice[0];
                            setAddrForm(p => ({
                              ...p,
                              city: po.District || po.Block || p.city,
                              state: po.State || p.state
                            }));
                          }
                        })
                        .catch(() => {});
                    }
                  }} />
              </div>
              <div className="input-group">
                <label>City *</label>
                <input type="text" placeholder="Jaipur" value={addrForm.city}
                  onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>State *</label>
                <input type="text" placeholder="Rajasthan" value={addrForm.state}
                  onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginTop: 15, fontSize: 13, fontFamily: "Poppins,sans-serif" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={addrForm.isDefault}
                  onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))} />
                Set as default address
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="btn btn-save" onClick={handleSaveAddress} disabled={addrSaving}>
                {addrSaving ? "Saving…" : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
