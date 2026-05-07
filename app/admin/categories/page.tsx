import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import CategoriesClient from "./CategoriesClient";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("categories", "view")) redirect("/admin/dashboard");

  let categories: {
    _id: string; name: string; slug: string; description: string;
    sortOrder: number; isActive: boolean; createdAt: string;
  }[] = [];

  try {
    await connectDB();
    const raw = await Category.find().sort({ sortOrder: 1, createdAt: -1 });
    categories = JSON.parse(JSON.stringify(raw));
  } catch { /* empty state handled in client */ }

  const activeCount   = categories.filter(c => c.isActive).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Categories" />
        <main className="page-main">

          {/* Page header — server rendered */}
          <div className="page-header">
            <div>
              <h2 className="page-title">Menu Categories</h2>
              <p className="page-sub">{categories.length} categories · controls the restaurant menu structure</p>
            </div>
          </div>

          {/* Stats bar — server rendered for accurate counts */}
          <div className="cat-stats">
            {[
              { label: "Total",    value: categories.length, color: "#f97316" },
              { label: "Active",   value: activeCount,        color: "#16a34a" },
              { label: "Inactive", value: inactiveCount,      color: "#6b7280" },
            ].map(s => (
              <div key={s.label} className="cat-stat">
                <span className="cs-value" style={{ color: s.color }}>{s.value}</span>
                <span className="cs-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* All interactive parts — search, filters, table, bulk, pagination */}
          <CategoriesClient categories={categories} perms={serializePerms(perms)} />

        </main>
      </div>
    </>
  );
}