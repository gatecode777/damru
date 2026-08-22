"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";
import { useToast } from "@/components/website/Toast";
interface Variant { label: string; price: number }

interface Props {
  menuItemId:  string;
  name:        string;
  description: string;
  image?:      string;
  basePrice:   number;
  variantType: string;
  variants:    Variant[];
  isVeg:       boolean;
  reverse?:    boolean;
}

export default function MenuItemCard({
  menuItemId, name, description, image, basePrice,
  variantType, variants, isVeg, reverse = false,
}: Props) {
  const { addItem, replaceCart, isLoggedIn } = useCart();
  const toast = useToast();
  const router = useRouter();

  // qty is only used for fixed-price items (added directly)
  const [qty, setQty] = useState(1);

  const [modalOpen,       setModalOpen]       = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [checkedAddons,   setCheckedAddons]   = useState<boolean[]>(variants.map(() => false));
  const [isOrderNowFlow,  setIsOrderNowFlow]  = useState(false);
  const [orderPending, setOrderPending] = useState(false);

  // Fix double-increment: use separate handlers with stopPropagation
  function handleInc(e: React.MouseEvent) {
    e.stopPropagation();
    setQty(q => q + 1);
  }
  function handleDec(e: React.MouseEvent) {
    e.stopPropagation();
    setQty(q => Math.max(1, q - 1));
  }

  // Price shown on card
  const displayPrice = variantType === "none"
    ? basePrice
    : variants.length > 0 ? variants[0].price : basePrice;

  // Price shown in modal footer
  const modalTotal = (() => {
    if (variantType === "addon") {
      return basePrice + variants.reduce((sum, v, i) => sum + (checkedAddons[i] ? v.price : 0), 0);
    }
    return variants[selectedVariant]?.price ?? basePrice;
  })();

  function openModal() { setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  // Add fixed-price item directly to cart
  async function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    setIsOrderNowFlow(false);
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    if (variantType === "none") {
      try { await addItem({ id: `${menuItemId}-plain`, menuItemId, name, custom: "", price: basePrice, image, variantType: "none" }, qty); toast.success("Added to cart", `${qty} × ${name}`, { id: `cart-add-${menuItemId}` }); }
      catch { toast.error("Item not added", "Please try again.", { id: `cart-add-${menuItemId}` }); }
    } else {
      openModal();
    }
  }

  async function handleOrderNow(e: React.MouseEvent) {
    e.stopPropagation();
    if (orderPending) return;
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    setIsOrderNowFlow(true);
    if (variantType === "none") {
      setOrderPending(true);
      try {
        await replaceCart([{ id: `${menuItemId}-plain`, menuItemId, name, custom: "", price: basePrice, image, variantType: "none", qty }]);
        router.push("/checkout");
      } catch {
        setOrderPending(false);
        toast.error("Order not prepared", "Please try again.", { id: `order-now-${menuItemId}` });
      }
    } else {
      openModal();
    }
  }

  // Add variant/addon item from modal
  async function handleModalAdd() {
    if (!isLoggedIn) {
      closeModal();
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    let custom = "";
    let price  = basePrice;
    let id     = name;

    if (variantType === "addon") {
      const selected = variants.filter((_, i) => checkedAddons[i]);
      custom = selected.length > 0 ? selected.map(v => v.label).join(", ") : "";
      price  = modalTotal;
      id     = `${menuItemId}-addon-${selected.map(v => v.label).join("-")}`;
    } else {
      const v = variants[selectedVariant];
      custom  = v?.label ?? "";
      price   = v?.price ?? basePrice;
      id      = `${menuItemId}-${custom}`;
    }

    if (isOrderNowFlow) {
      if (orderPending) return;
      setOrderPending(true);
      try {
        await replaceCart([{ id, menuItemId, name, custom, price, image, variantType }]);
        closeModal();
        router.push("/checkout");
      } catch {
        setOrderPending(false);
        toast.error("Order not prepared", "Please try again.", { id: `order-now-${menuItemId}` });
      }
    } else {
      try { await addItem({ id, menuItemId, name, custom, price, image, variantType }); closeModal(); toast.success("Added to cart", name, { id: `cart-add-${menuItemId}` }); }
      catch { toast.error("Item not added", "Please try again.", { id: `cart-add-${menuItemId}` }); }
    }
  }

  function toggleAddon(i: number) {
    setCheckedAddons(prev => prev.map((v, idx) => idx === i ? !v : v));
  }

  const categoryLabel: Record<string, string> = {
    portion: "Sabji / All curry",
    weight:  "Sweets",
    pound:   "Cake / Bakers Item",
    addon:   name,
    custom:  name,
  };

  return (
    <>
      {/* ── Card — your original classes, no changes ── */}
      <div className={`menu-card-m${reverse ? " reverse" : ""}`}>
        <div className="menu-info">

          <div className="menu-price-row">
            <div className="menu-line" />
            <span className="menu-price">₹{displayPrice}</span>
          </div>

          <h2 className="menu-title-m">{name}</h2>
          <p className="menu-desc">{description}</p>

          <div className="menu-actions">
            <button className="btn-order" onClick={handleOrderNow} disabled={orderPending}>
              {orderPending ? "Opening…" : "Order Now"}
            </button>

            {/* qty selector — only meaningful for fixed-price items */}
            {variantType === "none" && (
              <div className="quantity-selector">
                <button className="qty-btn minus" onClick={handleDec}>−</button>
                <span className="qty-count">{qty}</span>
                <button className="qty-btn plus" onClick={handleInc}>+</button>
              </div>
            )}

            <button className="ms-icon-btn" title="Add to cart" aria-label="Add to cart" onClick={handleAddToCart}>
              <i className="fa-solid fa-cart-shopping" />
            </button>
          </div>
        </div>

        <div className="menu-img-box">
          {image ? (
            <Image
              src={`/uploads/menu-items/${image}`}
              alt={name}
              width={360}
              height={270}
              sizes="(max-width: 640px) 45vw, 220px"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div className="menu-img-placeholder">🍽️</div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {modalOpen && variantType !== "none" && (
        <div
          style={{ position:"fixed", inset:0, zIndex:99999, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* MODAL A: portion / custom */}
          {(variantType === "portion" || variantType === "custom") && (
            <div className="custom-card">
              <div className="card-header">
                <span className="category-text">{categoryLabel[variantType]}</span>
                <div className="title-row">
                  <h2 className="main-title">Customise as per your taste</h2>
                  <div className="close-btn" onClick={closeModal}>&times;</div>
                </div>
                <div className="divider"></div>
              </div>
              <div className="quantity-section">
                <span className="section-label">Quantity</span>
                <div className="options-container">
                  {variants.map((v, i) => (
                    <label key={i} className="radio-option">
                      <div className="radio-left">
                        <input type="radio" name={`modal-${name}`} className="radio-input" checked={selectedVariant === i} onChange={() => setSelectedVariant(i)} />
                        <span className="custom-radio"></span>
                        <span className="option-name">{v.label}</span>
                      </div>
                      <span className="option-price">₹{v.price}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="card-footer">
                <div className="price-display">
                  <span className="total-price">₹{modalTotal}</span>
                  <span className="view-custom-link">{name}</span>
                </div>
                <button className="add-cart-btn" onClick={handleModalAdd} disabled={orderPending}>{orderPending ? "Opening…" : "Add Item to Cart"}</button>
              </div>
            </div>
          )}

          {/* MODAL B: weight */}
          {variantType === "weight" && (
            <div className="sweets-customizer" style={{ padding:0, minHeight:"unset", background:"transparent" }}>
              <div className="modal-card">
                <div className="modal-header">
                  <span className="category-label">{categoryLabel.weight}</span>
                  <div className="title-row">
                    <h2 className="main-title">Customise as per your taste</h2>
                    <div className="close-btn" onClick={closeModal}>&times;</div>
                  </div>
                  <div className="divider"></div>
                </div>
                <div className="modal-body">
                  <span className="section-subtitle">Quantity</span>
                  <div className="options-bg">
                    {variants.map((v, i) => (
                      <label key={i} className="option-row">
                        <div className="radio-container">
                          <input type="radio" name={`modal-${name}`} className="hidden-radio" checked={selectedVariant === i} onChange={() => setSelectedVariant(i)} />
                          <span className="custom-radio"></span>
                          <span className="option-text">{v.label}</span>
                        </div>
                        <span className="option-price">₹{v.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <div className="price-info">
                    <span className="total-amount">₹{modalTotal}</span>
                    <span className="view-link">{name}</span>
                  </div>
                  <button className="add-to-cart-btn" onClick={handleModalAdd} disabled={orderPending}>{orderPending ? "Opening…" : "Add Item to Cart"}</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL C: pound */}
          {variantType === "pound" && (
            <div className="cake-customizer-container" style={{ padding:0, minHeight:"unset", background:"transparent" }}>
              <div className="modal-card">
                <div className="header">
                  <span className="category-label">{categoryLabel.pound}</span>
                  <div className="title-row">
                    <h2 className="main-title">Customise as per your taste</h2>
                    <div className="close-icon" onClick={closeModal}>&times;</div>
                  </div>
                  <div className="divider"></div>
                </div>
                <div className="body-content">
                  <span className="section-title">Quantity</span>
                  <div className="options-wrapper">
                    {variants.map((v, i) => (
                      <label key={i} className="option-item">
                        <div className="radio-group">
                          <input type="radio" name={`modal-${name}`} checked={selectedVariant === i} onChange={() => setSelectedVariant(i)} />
                          <span className="custom-radio"></span>
                          <span className="option-label">{v.label}</span>
                        </div>
                        <span className="option-price">₹{v.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="footer-section">
                  <div className="price-area">
                    <span className="total-price">₹{modalTotal}</span>
                    <span className="custom-link">{name}</span>
                  </div>
                  <button className="add-cart-btn" onClick={handleModalAdd} disabled={orderPending}>{orderPending ? "Opening…" : "Add Item to Cart"}</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL D: addon */}
          {variantType === "addon" && (
            <div className="addon-customizer-wrapper" style={{ padding:0, minHeight:"unset", background:"transparent" }}>
              <div className="modal-card">
                <div className="header">
                  <div className="close-icon" onClick={closeModal}>&times;</div>
                  <div className="item-title">{categoryLabel.addon} <strong>₹{basePrice}</strong></div>
                  <h2 className="main-heading">Customise as per your taste</h2>
                  <div className="divider"></div>
                </div>
                <div className="body-content">
                  <span className="section-label">Addon <span style={{ fontWeight:"normal", color:"#666" }}>(Optional)</span></span>
                  <div className="options-container">
                    {variants.map((v, i) => (
                      <label key={i} className="option-row">
                        <div className="left-side">
                          <input type="checkbox" checked={checkedAddons[i]} onChange={() => toggleAddon(i)} />
                          <span className="custom-circle"></span>
                          <span className="option-name">{v.label}</span>
                        </div>
                        <span className="option-price">₹{v.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="footer-section">
                  <div className="price-block">
                    <span className="total-amount">₹{modalTotal}</span>
                    <span className="view-custom-link">{name}</span>
                  </div>
                  <button className="add-btn" onClick={handleModalAdd} disabled={orderPending}>{orderPending ? "Opening…" : "Add Item to Cart"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
