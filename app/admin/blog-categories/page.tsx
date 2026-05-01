import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import BlogCategory from "@/models/BlogCategory";
import BlogCategoriesClient from "./BlogCategoriesClient";

export const metadata = { title: "Blog Categories" };

export default async function BlogCategoriesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let categories: {
    _id: string; name: string; slug: string; description: string;
    sortOrder: number; isActive: boolean; createdAt: string;
  }[] = [];

  try {
    await connectDB();
    const raw = await BlogCategory.find().sort({ sortOrder: 1, createdAt: -1 });
    categories = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  const activeCount   = categories.filter(c => c.isActive).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Blog Categories" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Blog Categories</h2>
              <p className="page-sub">{categories.length} categories · used to organise blog posts</p>
            </div>
          </div>

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

          <BlogCategoriesClient categories={categories} />

        </main>
      </div>
    </>
  );
}