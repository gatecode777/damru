import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";
import ReservationForm from "../ReservationForm";
import MenuClient from "./MenuClient";
import { verifyTableToken } from "@/lib/tableAuth";

// ── SEO metadata ────────────────────────────────────────────────
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; t?: string }>;
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
  searchParams: Promise<{ category?: string; t?: string }>;
}) {
  const { category: catSlug, t: tableToken } = await searchParams;

  // Verify table token if present
  let tableDetails = null;
  let isTableTokenInvalid = false;

  if (tableToken) {
    const verified = await verifyTableToken(tableToken);
    if (verified) {
      tableDetails = { ...verified, token: tableToken };
    } else {
      isTableTokenInvalid = true;
    }
  }

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
  }

  if (isTableTokenInvalid) {
    return (
      <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6", padding: "40px 20px" }}>
        <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: "1.5px solid #fed7aa", padding: 40, borderRadius: 24, textAlign: "center", boxShadow: "0 10px 30px rgba(234, 88, 12, 0.05)" }}>
          <div style={{ fontSize: 64, marginBottom: 15 }}>⚠️</div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.6rem", fontWeight: 800, color: "#111827", marginBottom: 10 }}>Invalid QR Code</h2>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.95rem", color: "#4b5563", lineHeight: 1.6, marginBottom: 25 }}>
            This table QR code link is expired, regenerated, or invalid. Please ask our restaurant staff/waiter for assistance.
          </p>
          <a href="/menu" style={{ display: "inline-block", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", textDecoration: "none", padding: "12px 28px", borderRadius: 30, fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 4px 15px rgba(249, 115, 22, 0.25)" }}>
            Browse Menu Anyway
          </a>
        </div>
      </main>
    );
  }

  return (
    <main>

      {/* ── Hero ── */}
      <section className="menusoup-hero">
        <div className="souphero-overlay" />
        <div className="herosoup-content">
          {tableDetails ? (
            <>
              <h1 className="reveal-text">Welcome to Table {tableDetails.tableNumber}</h1>
              <p className="fade-in-text">Scan successful. Select your dishes and complete checkout to place orders directly to your table.</p>
            </>
          ) : (
            <>
              <h1 className="reveal-text">Our Delicious Menu</h1>
              <p className="fade-in-text">Explore a variety of flavors crafted with passion, freshness, and perfection.</p>
            </>
          )}
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

      {/* Embedded Table Session Hydrator in Client */}
      {tableDetails && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var tbl = ${JSON.stringify(tableDetails)};
                  sessionStorage.setItem('dinein_table', JSON.stringify(tbl));
                  window.dispatchEvent(new Event('dinein-session-updated'));
                } catch(e) { console.error(e); }
              })();
            `
          }}
        />
      )}
    </main>
  );
}