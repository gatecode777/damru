import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";
import MenuItemCard from "./MenuItemCard";
import ReservationForm from "../ReservationForm";

// ── SEO metadata ────────────────────────────────────────────────
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}): Promise<Metadata> {
  const { category } = await searchParams;
  const catName = category
    ? category.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Our Menu";

  return {
    title: `${catName} | Menu`,
    description: `Explore ${catName} at Damru By Namo — fresh, authentic flavors crafted with passion.`,
  };
}

// ── Types ────────────────────────────────────────────────────────
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
  sortOrder: number;
}

// ── Page ─────────────────────────────────────────────────────────
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: catSlug } = await searchParams;

  // ── Fetch from MongoDB ──────────────────────────────────────
  let categories: ICategory[] = [];
  let items: IMenuItem[] = [];
  let activeCategory: ICategory | null = null;

  try {
    await connectDB();

    // All active categories for the filter bar
    const rawCats = await CategoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    categories = JSON.parse(JSON.stringify(rawCats));

    // Determine which category is active
    if (catSlug) {
      activeCategory = categories.find(c => c.slug === catSlug) || null;
    }
    // Default to first category if none selected
    if (!activeCategory && categories.length > 0) {
      activeCategory = categories[0];
    }

    // Fetch items for the active category
    if (activeCategory) {
      const rawItems = await MenuItemModel
        .find({
          category: activeCategory._id,
          isActive: true,
        })
        .sort({ sortOrder: 1 })
        .lean();
      items = JSON.parse(JSON.stringify(rawItems));
    }
  } catch (err) {
    console.error("Menu page DB error:", err);
    // Graceful degradation — page renders with empty state
  }

  return (
    <main>

      {/* ── Hero ── */}
      <section className="menusoup-hero">
        <div className="souphero-overlay" />
        <div className="herosoup-content">
          <h1 className="reveal-text">Our Delicious Menu</h1>
          <p className="fade-in-text">Explore a variety of flavors crafted with passion, freshness, and perfection.</p>
          <a href="#reservation" className="btn-booksoup floating">Book Your Seat</a>
        </div>
      </section>

      {/* ── Category filter bar ── */}
      <section className="filter-section">
        <div className="filter-container">
          {categories.length === 0 ? (
            <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "0.85rem", color: "#aaa" }}>
              No categories available yet.
            </span>
          ) : (
            categories.map(cat => (
              <Link
                key={cat._id}
                href={`/menu?category=${cat.slug}`}
                className={`filter-btn${activeCategory?._id === cat._id ? " active" : ""
                  }`}
              >
                {cat.name}
              </Link>
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
      {items.length === 0 ? (
        <div className="menu-empty">
          <p>
            {activeCategory
              ? `No items in ${activeCategory.name} yet. Check back soon!`
              : "No menu items available."}
          </p>
        </div>
      ) : (
        <section className="menu-parent">
          <div className="menu-container">
            {items.map((item, i) => (
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

      {/* ── Reservation ── */}
      <section className="reservation-section" id="reservation">
        <div className="res-container">
          <div style={{ marginBottom: 28 }}>
            <h2 className="res-main-title">Make a Reservation</h2>
            <p className="res-sub-text">Get in touch with the restaurant</p>
          </div>
          <ReservationForm />
        </div>
      </section>

    </main>
  );
}