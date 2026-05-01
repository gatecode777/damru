"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";

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
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [taxRate,        setTaxRate]        = useState(5);
  const [freeAbove,      setFreeAbove]      = useState(500);
  const [deliveryCharge, setDeliveryCharge] = useState(50);

  // ── Step state ────────────────────────────────────────────
  const [step,            setStep]            = useState(1);

  // ── Address state ─────────────────────────────────────────
  const [addresses,       setAddresses]       = useState<Address[]>([]);
  const [selectedAddr,    setSelectedAddr]    = useState<string | null>(null);
  const [addrLoading,     setAddrLoading]     = useState(true);
  const [showAddrModal,   setShowAddrModal]   = useState(false);
  const [editingAddr,     setEditingAddr]     = useState<Address | null>(null);
  const [addrForm,        setAddrForm]        = useState({ ...emptyForm });
  const [addrSaving,      setAddrSaving]      = useState(false);
  const [addrError,       setAddrError]       = useState("");

  // ── Payment state ─────────────────────────────────────────
  const [payMethod,       setPayMethod]       = useState<"cod" | "upi" | "card">("cod");
  const [notes,           setNotes]           = useState("");
  const [placing,         setPlacing]         = useState(false);
  const [orderError,      setOrderError]      = useState("");
  const [placedOrder,     setPlacedOrder]     = useState<{ orderId: string; total: number } | null>(null);

  // ── Coupon from cart (passed via sessionStorage) ──────────
  const [couponCode,      setCouponCode]      = useState("");
  const [discount,        setDiscount]        = useState(0);

  useEffect(() => {
    // Read applied coupon from sessionStorage if cart page set it
    const saved = sessionStorage.getItem("appliedCoupon");
    if (saved) { const c = JSON.parse(saved); setCouponCode(c.code); setDiscount(c.discount); }
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setAddrLoading(true);
    try {
      const res  = await fetch("/api/address");
      const data = await res.json();
      if (res.status === 401) { router.push("/"); return; }
      setAddresses(data.addresses || []);
      const def = (data.addresses || []).find((a: Address) => a.isDefault);
      if (def) setSelectedAddr(def._id);
      else if (data.addresses?.length) setSelectedAddr(data.addresses[0]._id);
    } catch { setAddresses([]); }
    finally { setAddrLoading(false); }
  }

  // ── Totals ────────────────────────────────────────────────
  const subtotalAfterDiscount = Math.max(0, totalPrice - discount);
  const shipping  = items.length > 0 ? (subtotalAfterDiscount >= freeAbove ? 0 : deliveryCharge) : 0;
  const tax       = items.length > 0 ? Math.round(subtotalAfterDiscount * taxRate / 100) : 0;
  const grandTotal = subtotalAfterDiscount + tax + shipping;

  // ── Address form ──────────────────────────────────────────
  function openAddNew() { setEditingAddr(null); setAddrForm({ ...emptyForm }); setAddrError(""); setShowAddrModal(true); }
  function openEdit(a: Address) { setEditingAddr(a); setAddrForm({ label: a.label, fullName: a.fullName, phone: a.phone, house: a.house, area: a.area, city: a.city, state: a.state, pincode: a.pincode, isDefault: a.isDefault }); setAddrError(""); setShowAddrModal(true); }
  function closeModal() { setShowAddrModal(false); setEditingAddr(null); setAddrError(""); }

  async function handleSaveAddress() {
    if (!addrForm.fullName || !addrForm.phone || !addrForm.house || !addrForm.city || !addrForm.state || !addrForm.pincode)
      { setAddrError("All required fields must be filled."); return; }

    setAddrSaving(true); setAddrError("");
    try {
      const res  = await fetch("/api/address", {
        method:  editingAddr ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(editingAddr ? { id: editingAddr._id, ...addrForm } : addrForm),
      });
      const data = await res.json();
      if (data.error) { setAddrError(data.error); return; }
      await loadAddresses();
      if (data.address) setSelectedAddr(data.address._id);
      closeModal();
    } catch { setAddrError("Failed to save. Please try again."); }
    finally { setAddrSaving(false); }
  }

  async function handleDeleteAddress(id: string) {
    if (!confirm("Delete this address?")) return;
    await fetch("/api/address", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (selectedAddr === id) setSelectedAddr(null);
    await loadAddresses();
  }

  // ── Place order ───────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!selectedAddr) { setOrderError("Please select a delivery address."); return; }
    if (items.length === 0) { setOrderError("Your cart is empty."); return; }
    setPlacing(true); setOrderError("");
    try {
      const res  = await fetch("/api/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ addressId: selectedAddr, paymentMethod: payMethod, couponCode, notes }),
      });
      const data = await res.json();
      if (data.error) { setOrderError(data.error); return; }
      sessionStorage.removeItem("appliedCoupon");
      setPlacedOrder({ orderId: data.order.orderId, total: data.order.total });
      await clearCart();
    } catch { setOrderError("Something went wrong. Please try again."); }
    finally { setPlacing(false); }
  }

  // ── Order success screen ──────────────────────────────────
  if (placedOrder) {
    return (
      <div className="checkout-container">
        <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "Poppins, sans-serif" }}>
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "1.8rem", color: "#111", marginBottom: 8 }}>Order Placed!</h2>
          <p style={{ color: "#666", marginBottom: 4 }}>Your order has been confirmed.</p>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#e67e22", marginBottom: 4 }}>Order ID: {placedOrder.orderId}</p>
          <p style={{ color: "#666", marginBottom: 32 }}>Total: ₹{placedOrder.total} · Payment: Cash on Delivery</p>
          <button onClick={() => router.push("/menu")}
            style={{ background: "#e67e22", color: "#fff", border: "none", borderRadius: 10, padding: "12px 32px", fontFamily: "Poppins,sans-serif", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const selectedAddress = addresses.find(a => a._id === selectedAddr);

  return (
    <div className="checkout-container">

      {/* ── STEPPER ── */}
      <div className="stepper">
        {[
          { n: 1, icon: "fa-solid fa-location-dot", label: "Address" },
          { n: 2, icon: "fa-solid fa-truck",         label: "Shipping" },
          { n: 3, icon: "fa-solid fa-credit-card",   label: "Payment"  },
        ].map(s => (
          <div key={s.n} className={`step${step >= s.n ? " active" : ""}`} id={`step${s.n}-tab`}>
            <div className="step-icon"><i className={s.icon}></i></div>
            <div className="step-text"><b>Step {s.n}</b><span>{s.label}</span></div>
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
                onClick={() => setSelectedAddr(addr._id)}>
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
                    onClick={e => { e.stopPropagation(); handleDeleteAddress(addr._id); }}></i>
                </div>
              </div>
            ))
          )}

          <div className="add-address-bar" onClick={openAddNew}>
            <div className="plus-icon"><i className="fa-solid fa-plus"></i></div>
            <br/>
            <span>Add New Address</span>
          </div>

          <div className="btn-row">
            <button className="btn btn-next" onClick={() => { if (!selectedAddr) { alert("Please select or add an address."); return; } setStep(2); }}>
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
              <b>Free</b>
              <span style={{ color: "#666", fontSize: 13 }}>Regular shipment</span>
            </div>
            <b>{new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>
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
              <h3 className="checkout-pay-heading">Summary</h3>
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

              {selectedAddress && (
                <>
                  <p style={{ color: "#666", marginTop: 16 }}><strong>Delivery Address:</strong></p>
                  <p style={{ color: "#888", marginBottom: 10, fontSize: 13 }}>
                    {selectedAddress.fullName} · {selectedAddress.phone}<br/>
                    {selectedAddress.house}{selectedAddress.area ? `, ${selectedAddress.area}` : ""}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                  </p>
                </>
              )}

              <div style={{ marginTop: 16, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Subtotal</span><b>₹{totalPrice}</b>
                </div>
                {discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#16a34a" }}>
                    <span>Discount ({couponCode})</span><b>− ₹{discount}</b>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Tax</span><b>₹{tax}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Shipping</span><b>₹{shipping}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <b style={{ fontSize: 18, color: "#e67e22" }}>₹{grandTotal}</b>
                </div>
              </div>

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
              <h3 className="checkout-pay-heading">Payment</h3>
              <div className="tab-header">
                {(["cod","upi","card"] as const).map(m => (
                  <div key={m} className={`tab-link${payMethod === m ? " active" : ""}`} onClick={() => setPayMethod(m)}>
                    {m === "cod" ? "Cash on Delivery" : m === "upi" ? "UPI" : "Credit Card"}
                  </div>
                ))}
              </div>

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
                    <button className="btn btn-back" onClick={() => setStep(2)}>Back</button>
                    <button className="btn btn-next" onClick={handlePlaceOrder} disabled={placing}>
                      {placing ? "Placing…" : "Place Order"}
                    </button>
                  </div>
                </div>
              )}

              {/* UPI */}
              {payMethod === "upi" && (
                <div className="payment-method active" id="pay-upi">
                  <div className="upi-options">
                    <div className="upi-item"><img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="GPay"/>Google Pay</div>
                    <div className="upi-item"><img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/phonepe-logo-icon.png" alt="PhonePe"/>PhonePe</div>
                    <div className="upi-item"><img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" alt="Paytm"/>Paytm</div>
                    <p><strong>Note:</strong> UPI payment integration coming soon. Please use COD for now.</p>
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-back" onClick={() => setStep(2)}>Back</button>
                    <button className="btn btn-next" disabled>Pay via UPI</button>
                  </div>
                </div>
              )}

              {/* Card */}
              {payMethod === "card" && (
                <div className="payment-method active" id="pay-card">
                  <div className="card-visual">
                    <div className="chip"></div>
                    <div className="number">•••• •••• •••• ••••</div>
                    <div className="bottom"><span>Cardholder</span>
                      <img src="https://img.icons8.com/color/48/000000/mastercard-logo.png" width="35" alt="MC"/>
                    </div>
                  </div>
                  <div className="input-group"><input type="text" placeholder="Cardholder Name" style={{ background:"none", border:"1px solid #eee" }}/></div>
                  <div className="input-group"><input type="text" placeholder="Card Number" style={{ background:"none", border:"1px solid #eee" }}/></div>
                  <div className="input-group"><input type="text" placeholder="Exp Date" style={{ background:"none", border:"1px solid #eee" }}/></div>
                  <div className="input-group"><input type="text" placeholder="CVV" style={{ background:"none", border:"1px solid #eee" }}/></div>
                  <p style={{ color: "#aaa", fontFamily: "Poppins,sans-serif", fontSize: 13 }}>Card payment integration coming soon. Please use COD for now.</p>
                  <div className="btn-row">
                    <button className="btn btn-back" onClick={() => setStep(2)}>Back</button>
                    <button className="btn btn-next" disabled>Pay</button>
                  </div>
                </div>
              )}
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
                <input type="text" placeholder="+91-xxxxxxxxxx" value={addrForm.phone}
                  onChange={e => setAddrForm(p => ({ ...p, phone: e.target.value }))} />
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
                <label>City *</label>
                <input type="text" placeholder="Jaipur" value={addrForm.city}
                  onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>State *</label>
                <input type="text" placeholder="Rajasthan" value={addrForm.state}
                  onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Pincode *</label>
                <input type="text" placeholder="302034" value={addrForm.pincode}
                  onChange={e => setAddrForm(p => ({ ...p, pincode: e.target.value }))} />
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