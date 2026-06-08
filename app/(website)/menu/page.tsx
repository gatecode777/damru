import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";
import ReservationForm from "../ReservationForm";
import MenuClient from "./MenuClient";

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
  category: string;
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

  try {
    await connectDB();

    // All active categories for the filter bar
    const rawCats = await CategoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    categories = JSON.parse(JSON.stringify(rawCats));

    // Fetch all active menu items
    const rawItems = await MenuItemModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    items = JSON.parse(JSON.stringify(rawItems));
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

      {/* ── Interactive Client Menu Filter ── */}
      <MenuClient
        categories={categories}
        items={items}
        initialActiveCategorySlug={catSlug}
      />

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