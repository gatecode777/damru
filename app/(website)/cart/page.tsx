"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";

interface AvailableCoupon {
  code: string; description: string; type: string;
  value: number; maxDiscount: number | null; minOrderValue: number;
  usageLimit: number | null; usedCount: number;
}

interface SuggestedItem {
  _id: string; name: string; desc: string; image: string; price: number;
  hasVariants: boolean; category: string; catSlug: string; isFeatured: boolean;
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQty, totalPrice, clearCart, loading, addItem, isLoggedIn } = useCart();

  // ── Empty-cart suggestions ──────────────────────────────────
  const [suggestions,        setSuggestions]        = useState<SuggestedItem[]>([]);
  const [suggestionsLoaded,  setSuggestionsLoaded]  = useState(false);
  const [addingId,           setAddingId]           = useState("");

  // ── Coupon state ──────────────────────────────────────────
  const [couponCode,       setCouponCode]       = useState("");
  const [appliedCoupon,    setAppliedCoupon]    = useState<{ code: string; discount: number; description: string } | null>(null);
  const [couponError,      setCouponError]      = useState("");
  const [couponLoading,    setCouponLoading]    = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [showCoupons,      setShowCoupons]      = useState(false);
  const [couponsLoaded,    setCouponsLoaded]    = useState(false);
  const [taxRate,          setTaxRate]          = useState(5);
  const [freeAbove,        setFreeAbove]        = useState(500);
  const [deliveryCharge,   setDeliveryCharge]   = useState(50);

  // Fetch available coupons when section opens
  async function loadAvailableCoupons() {
    if (couponsLoaded) { setShowCoupons(v => !v); return; }
    try {
      const res  = await fetch("/api/coupons");
      const data = await res.json();
      setAvailableCoupons(data.coupons || []);
      setCouponsLoaded(true);
      setShowCoupons(true);
    } catch { setAvailableCoupons([]); }
  }

  // Apply coupon by code
  async function handleApplyCoupon() {
    if (!couponCode.trim()) { setCouponError("Please enter a coupon code."); return; }
    setCouponLoading(true); setCouponError("");
    try {
      const res  = await fetch("/api/coupons", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: couponCode.trim(), cartTotal: totalPrice }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.coupon.code, discount: data.discount, description: data.coupon.description });
        setCouponError("");
        setShowCoupons(false);
      } else {
        setCouponError(data.message);
        setAppliedCoupon(null);
      }
    } catch { setCouponError("Could not verify coupon. Try again."); }
    finally { setCouponLoading(false); }
  }

  // Apply a coupon from the available list
  async function handleSelectCoupon(code: string) {
    setCouponCode(code);
    setCouponLoading(true); setCouponError("");
    try {
      const res  = await fetch("/api/coupons", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code, cartTotal: totalPrice }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.coupon.code, discount: data.discount, description: data.coupon.description });
        setShowCoupons(false); setCouponError("");
      } else {
        setCouponError(data.message);
        setAppliedCoupon(null);
      }
    } catch { setCouponError("Could not verify coupon. Try again."); }
    finally { setCouponLoading(false); }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null); setCouponCode(""); setCouponError("");
  }

  // Re-validate coupon if cart total changes
  // Load site settings for dynamic tax/delivery
  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setTaxRate(d.settings.taxRate ?? 5);
          setFreeAbove(d.settings.freeDeliveryAbove ?? 500);
          setDeliveryCharge(d.settings.deliveryCharge ?? 50);
        }
      }).catch(() => {});
  }, []);

  // Load suggested items whenever the cart is seen empty
  useEffect(() => {
    if (loading || items.length > 0 || suggestionsLoaded) return;
    fetch("/api/menu/suggestions")
      .then(r => r.json())
      .then(d => { setSuggestions(d.items || []); setSuggestionsLoaded(true); })
      .catch(() => setSuggestionsLoaded(true));
  }, [loading, items.length, suggestionsLoaded]);

  async function quickAdd(item: SuggestedItem) {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    setAddingId(item._id);
    try {
      await addItem({ id: `${item._id}-plain`, menuItemId: item._id, name: item.name, custom: "", price: item.price, image: item.image, variantType: "none" }, 1);
    } finally {
      setAddingId("");
    }
  }

  useEffect(() => {
    if (appliedCoupon) {
      fetch("/api/coupons", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: appliedCoupon.code, cartTotal: totalPrice }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data.valid) { setAppliedCoupon(null); setCouponError(data.message); }
          else setAppliedCoupon(prev => prev ? { ...prev, discount: data.discount } : null);
        })
        .catch(() => {});
    }
  }, [totalPrice]);

  // ── Price calculations ────────────────────────────────────
  const discount       = appliedCoupon?.discount ?? 0;
  const subtotalAfterDiscount = Math.max(0, totalPrice - discount);
  const shippingAmount = items.length > 0 ? (subtotalAfterDiscount >= freeAbove ? 0 : deliveryCharge) : 0;
  const taxAmount      = items.length > 0 ? Math.round(subtotalAfterDiscount * taxRate / 100) : 0;
  const grandTotal     = subtotalAfterDiscount + taxAmount + shippingAmount;

  if (loading) {
    return (
      <div className="cart-page-section">
        <div style={{ textAlign: "center", padding: "80px 20px", fontFamily: "Poppins, sans-serif", color: "#aaa" }}>
          Loading cart...
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-section">
      <div className="container">

        {/* Left */}
        <div className="cart-left" id="cart-items-container">
          <span className="list-eyebrow">Your Selection</span>
          <h2 className="list-title">Cart Items List</h2>
          <div id="items-list">
            {items.length === 0 ? (
              <div className="empty-cart">
                <p className="empty-cart__title">Your cart is empty</p>
                <p className="empty-cart__sub">
                  Add at least one item to your cart before checking out. Here are some of our most-loved picks to get you started.
                </p>
                {suggestions.length > 0 && (
                  <div className="empty-cart__grid">
                    {suggestions.map(item => (
                      <div key={item._id} className="suggest-card">
                        {item.image ? (
                          <img src={`/uploads/menu-items/${item.image}`} alt={item.name} className="suggest-card__img" />
                        ) : (
                          <div className="suggest-card__img" style={{ background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🍽️</div>
                        )}
                        {item.isFeatured && <span className="suggest-card__badge">⭐ Chef&apos;s Pick</span>}
                        <p className="suggest-card__name">{item.name}</p>
                        <p className="suggest-card__price">{item.hasVariants ? "from " : ""}₹{item.price}</p>
                        {item.hasVariants ? (
                          <Link href={`/menu?category=${encodeURIComponent(item.catSlug)}`} className="suggest-card__btn suggest-card__btn--link">
                            View Options
                          </Link>
                        ) : (
                          <button className="suggest-card__btn" disabled={addingId === item._id} onClick={() => quickAdd(item)}>
                            {addingId === item._id ? "Adding…" : "Add to Cart"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/menu" className="empty-cart__browse">Browse Full Menu →</Link>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="item-info">
                    {item.image ? (
                      <img src={`/uploads/menu-items/${item.image}`} alt={item.name} className="item-img" />
                    ) : (
                      <div className="item-img" style={{ background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>🍽️</div>
                    )}
                    <div className="item-details">
                      <h4>{item.name}</h4>
                      {item.custom && <p>{item.custom}</p>}
                      <span style={{ fontSize: "0.8rem", color: "#999" }}>₹{item.price} each</span>
                    </div>
                  </div>
                  <div className="qty-controls">
                    <span className="qty-btn" onClick={() => updateQty(item, item.qty - 1)}>−</span>
                    <span className="qty-num">{item.qty}</span>
                    <span className="qty-btn" onClick={() => updateQty(item, item.qty + 1)}>+</span>
                  </div>
                  <div className="item-price">₹{item.price * item.qty}</div>
                  <div className="remove-icon" onClick={() => removeItem(item)}>×</div>
                </div>
              ))
            )}
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="clear-cart-btn">
              Clear Cart
            </button>
          )}
        </div>

        {/* Right */}
        <div className="cart-right">
          <div className="summary-card">
            <h3>Order Summary</h3>

            {/* ── Coupon section ── */}
            <div className="promo-box">
              <label>Discount code / Promo code</label>

              {/* Applied coupon pill */}
              {appliedCoupon ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginTop: 8 }}>
                  <div>
                    <span style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#15803d", letterSpacing: "0.05em" }}>{appliedCoupon.code}</span>
                    {appliedCoupon.description && (
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#16a34a", fontFamily: "Poppins,sans-serif" }}>{appliedCoupon.description}</p>
                    )}
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#16a34a", fontFamily: "Poppins,sans-serif" }}>You save ₹{appliedCoupon.discount} 🎉</p>
                  </div>
                  <button onClick={handleRemoveCoupon}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "1.1rem", padding: "4px 6px", lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      className="promo-input"
                      placeholder="Enter code"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading}
                      style={{ background: "#e67e22", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontFamily: "Poppins,sans-serif", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", opacity: couponLoading ? 0.7 : 1 }}>
                      {couponLoading ? "…" : "Apply"}
                    </button>
                  </div>
                  {couponError && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#dc2626", fontFamily: "Poppins,sans-serif" }}>⚠ {couponError}</p>
                  )}
                </>
              )}

              {/* View available coupons toggle */}
              {!appliedCoupon && items.length > 0 && (
                <button onClick={loadAvailableCoupons}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#e67e22", fontFamily: "Poppins,sans-serif", fontSize: "0.78rem", fontWeight: 600, padding: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                  🏷️ {showCoupons ? "Hide" : "View"} available coupons
                </button>
              )}

              {/* Available coupons list */}
              {showCoupons && availableCoupons.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {availableCoupons.map(c => {
                    const meetsMin = totalPrice >= (c.minOrderValue || 0);
                    return (
                      <div key={c.code}
                        style={{ border: `1.5px dashed ${meetsMin ? "#fed7aa" : "#e5e7eb"}`, borderRadius: 10, padding: "10px 12px", background: meetsMin ? "#fff7ed" : "#fafafa", opacity: meetsMin ? 1 : 0.6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#e67e22", letterSpacing: "0.06em" }}>{c.code}</span>
                            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#6b7280", fontFamily: "Poppins,sans-serif" }}>
                              {c.type === "flat" ? `₹${c.value} off` : `${c.value}% off${c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ""}`}
                              {c.minOrderValue > 0 ? ` · Min ₹${c.minOrderValue}` : ""}
                            </p>
                            {c.description && (
                              <p style={{ margin: "1px 0 0", fontSize: "0.72rem", color: "#9ca3af", fontFamily: "Poppins,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</p>
                            )}
                            {!meetsMin && (
                              <p style={{ margin: "3px 0 0", fontSize: "0.7rem", color: "#dc2626", fontFamily: "Poppins,sans-serif" }}>
                                Add ₹{c.minOrderValue - totalPrice} more to use this
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => meetsMin && handleSelectCoupon(c.code)}
                            disabled={!meetsMin || couponLoading}
                            style={{ background: meetsMin ? "#e67e22" : "#e5e7eb", color: meetsMin ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, padding: "6px 12px", cursor: meetsMin ? "pointer" : "not-allowed", fontFamily: "Poppins,sans-serif", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                            Apply
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {showCoupons && couponsLoaded && availableCoupons.length === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "#aaa", fontFamily: "Poppins,sans-serif" }}>No coupons available right now.</p>
              )}
            </div>

            {/* Summary rows — unchanged class names */}
            <div className="summary-row"><span>Subtotal</span><span>₹{totalPrice}</span></div>

            {/* Discount row — only shown when coupon applied */}
            {appliedCoupon && (
              <div className="summary-row" style={{ color: "#16a34a" }}>
                <span>Discount ({appliedCoupon.code})</span>
                <span>− ₹{appliedCoupon.discount}</span>
              </div>
            )}

            <div className="summary-row"><span>Estimated Tax</span><span>₹{taxAmount}</span></div>
            <div className="summary-row"><span>Shipping {subtotalAfterDiscount >= freeAbove ? <span style={{color:"#16a34a",fontSize:"0.7rem"}}>(Free!)</span> : <span style={{color:"#9ca3af",fontSize:"0.7rem"}}>(Free above ₹{freeAbove})</span>}</span><span>₹{shippingAmount}</span></div>
            <div className="summary-row total"><span>Total</span><span>₹{grandTotal}</span></div>
            <button
              className="checkout-btn"
              disabled={items.length === 0}
              title={items.length === 0 ? "Add at least one item to your cart to checkout" : undefined}
              onClick={() => {
                if (items.length === 0) return;
                if (appliedCoupon) sessionStorage.setItem("appliedCoupon", JSON.stringify({ code: appliedCoupon.code, discount: appliedCoupon.discount }));
                else sessionStorage.removeItem("appliedCoupon");
                router.push("/checkout");
              }}>
              Checkout
            </button>
            {items.length === 0 && (
              <p className="checkout-btn__hint">Add at least one item to your cart to checkout.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}