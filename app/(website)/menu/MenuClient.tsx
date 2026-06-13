"use client";

import { useState, useEffect } from "react";
import MenuItemCard from "./MenuItemCard";
import { useCart } from "@/lib/CartContext";
import Link from "next/link";

interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

interface IMenuItem {
  _id: string;
  name: string;
  description: string;
  image?: string;
  basePrice: number;
  variantType: string;
  variants: { label: string; price: number }[];
  isVeg: boolean;
  category: string;
  sortOrder: number;
}

interface MenuClientProps {
  categories: ICategory[];
  items: IMenuItem[];
  initialActiveCategorySlug?: string;
}

export default function MenuClient({
  categories,
  items,
  initialActiveCategorySlug,
}: MenuClientProps) {
  const { totalItems, isLoggedIn } = useCart();

  // Find active category based on initial slug, fallback to first category
  const getInitialActive = () => {
    if (initialActiveCategorySlug) {
      const found = categories.find(c => c.slug === initialActiveCategorySlug);
      if (found) return found;
    }
    return categories[0] || null;
  };

  const [activeCategory, setActiveCategory] = useState<ICategory | null>(getInitialActive);

  // Sync state if URL query param changes (e.g. from browser back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("category");
      if (slug) {
        const found = categories.find(c => c.slug === slug);
        if (found) setActiveCategory(found);
      } else if (categories.length > 0) {
        setActiveCategory(categories[0]);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [categories]);

  const handleCategoryClick = (cat: ICategory) => {
    setActiveCategory(cat);
    // Update the URL without reloading the page or fetching from the server
    window.history.pushState(null, "", `/menu?category=${cat.slug}`);
  };

  // Filter items for the active category
  const filteredItems = activeCategory
    ? items.filter(item => item.category === activeCategory._id)
    : [];

  return (
    <>
      {/* ── Category filter bar ── */}
      <section className="filter-section">
        <div className="filter-container">
          {categories.length === 0 ? (
            <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "0.85rem", color: "#aaa" }}>
              No categories available yet.
            </span>
          ) : (
            categories.map(cat => (
              <button
                key={cat._id}
                onClick={() => handleCategoryClick(cat)}
                className={`filter-btn${activeCategory?._id === cat._id ? " active" : ""}`}
                style={{ fontFamily: "inherit" }}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </section>

      {/* ── Category title & description ── */}
      {activeCategory && (
        <div className="page-title-section">
          <h2 className="category-heading">{activeCategory.name}</h2>
          {activeCategory.description && (
            <p>{activeCategory.description}</p>
          )}
        </div>
      )}

      {/* ── Menu items ── */}
      {filteredItems.length === 0 ? (
        <div className="menu-empty" style={{
          textAlign: "center",
          padding: "60px 20px",
          background: "#fff9f4",
          borderRadius: "16px",
          border: "1px dashed #e67e22",
          maxWidth: "600px",
          margin: "40px auto",
          boxShadow: "0 4px 20px rgba(230, 126, 34, 0.05)"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px", color: "#e67e22" }}>🍽️</div>
          <h3 style={{
            fontFamily: "Playfair Display, Georgia, serif",
            fontSize: "1.5rem",
            color: "#333",
            marginBottom: "8px"
          }}>
            {activeCategory ? activeCategory.name : "Menu Items"} Coming Soon
          </h3>
          <p style={{
            fontFamily: "Inter, sans-serif",
            color: "#666",
            fontSize: "0.95rem",
            margin: 0
          }}>
            {activeCategory
              ? `We are currently crafting delicious items for ${activeCategory.name}. Check back soon!`
              : "No menu items available."}
          </p>
        </div>
      ) : (
        <section className="menu-parent">
          <div className="menu-container">
            {filteredItems.map((item, i) => (
              <MenuItemCard
                key={item._id}
                menuItemId={item._id}
                name={item.name}
                description={item.description}
                image={item.image}
                basePrice={item.basePrice}
                variantType={item.variantType}
                variants={item.variants}
                isVeg={item.isVeg}
                reverse={i % 2 !== 0}
              />
            ))}
          </div>
        </section>
      )}

      {totalItems > 0 && (
        <Link href="/cart" className="floating-cart-btn" aria-label="Go to cart">
          <i className="ri-shopping-cart-2-line" />
          <span className="floating-cart-badge">{totalItems}</span>
          <span className="floating-cart-tooltip">View Cart</span>
        </Link>
      )}
    </>
  );
}
