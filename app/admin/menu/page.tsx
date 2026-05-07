import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import MenuClient from "./MenuClient";
import { Plus, UtensilsCrossed } from "lucide-react";

export const metadata = { title: "Menu Items" };

export default async function MenuPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("menu", "view")) redirect("/admin/dashboard");

  let items: {
    _id: string; name: string; slug: string; description: string;
    basePrice: number; variantType: string;
    variants: { label: string; price: number }[];
    isVeg: boolean; isActive: boolean; isFeatured: boolean;
    sortOrder: number; image?: string;
    category: { _id: string; name: string } | null;
    createdAt: string;
  }[] = [];

  let categories: { _id: string; name: string }[] = [];

  try {
    await connectDB();
    const [rawItems, rawCats] = await Promise.all([
      MenuItem.find().populate("category", "name").sort({ sortOrder: 1, createdAt: -1 }),
      Category.find({ isActive: true }).sort({ sortOrder: 1 }),
    ]);
    items      = JSON.parse(JSON.stringify(rawItems));
    categories = JSON.parse(JSON.stringify(rawCats));
  } catch { /* show empty */ }

  const serializedPerms = serializePerms(perms);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Menu Items" />
        <main className="page-main">

          {/* Page header — server rendered */}
          <div className="page-header">
            <div>
              <h2 className="page-title">Menu Items</h2>
              <p className="page-sub">{items.length} items across {categories.length} categories</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {categories.length === 0 && perms.can("categories", "create") && (
                <Link href="/admin/categories/new" className="btn-outline">
                  Add a category first
                </Link>
              )}
              {perms.can("menu", "create") && (
                <Link href="/admin/menu/new" className="btn-primary">
                  <Plus size={15} /> Add Menu Item
                </Link>
              )}
            </div>
          </div>

          {/* Stats bar — server rendered for accurate totals */}
          <div className="menu-stats">
            {[
              { label: "Total",    value: items.length,                           color: "#f97316" },
              { label: "Active",   value: items.filter(i => i.isActive).length,  color: "#16a34a" },
              { label: "Veg",      value: items.filter(i => i.isVeg).length,     color: "#059669" },
              { label: "Featured", value: items.filter(i => i.isFeatured).length, color: "#7c3aed" },
            ].map(s => (
              <div key={s.label} className="menu-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Empty state if no items */}
          {items.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <UtensilsCrossed size={40} />
                <p>No menu items yet.{" "}
                  {perms.can("menu", "create") ? (
                    <Link href="/admin/menu/new" style={{ color: "#f97316" }}>
                      Add the first item →
                    </Link>
                  ) : (
                    <span style={{ color: "#9ca3af" }}>Contact admin to add items</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            /* All interactive: search, filters, table, pagination — client */
            <MenuClient items={items} categories={categories} perms={serializedPerms} />
          )}

        </main>
      </div>
    </>
  );
}