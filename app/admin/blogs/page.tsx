import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";
import BlogsClient from "./BlogsClient";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Blogs" };

export default async function BlogsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let blogs: {
    _id: string; title: string; slug: string; excerpt: string;
    category: { _id: string; name: string } | null; author: { name: string } | string; status: string; views: number;
    sortOrder: number; publishedAt?: string; createdAt: string; tags: string[];
  }[] = [];

  try {
    await connectDB();
    const raw = await Blog.find().populate("category", "name").sort({ sortOrder: 1, createdAt: -1 });
    blogs = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  const published = blogs.filter(b => b.status === "published").length;
  const drafts    = blogs.filter(b => b.status === "draft").length;
  const categories = [...new Set(blogs.map(b => b.category))].length;

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Blogs" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Blog Posts</h2>
              <p className="page-sub">{blogs.length} posts · {published} published · {drafts} drafts</p>
            </div>
            <Link href="/admin/blogs/new" className="btn-primary">
              <Plus size={15} /> New Post
            </Link>
          </div>

          {/* Stats */}
          <div className="cat-stats">
            {[
              { label: "Total",      value: blogs.length, color: "#f97316" },
              { label: "Published",  value: published,    color: "#16a34a" },
              { label: "Drafts",     value: drafts,       color: "#6b7280" },
              { label: "Categories", value: categories,   color: "#7c3aed" },
            ].map(s => (
              <div key={s.label} className="cat-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          {blogs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <FileText size={40} />
                <p>No blog posts yet.{" "}
                  <Link href="/admin/blogs/new" style={{ color: "#f97316" }}>Write the first one →</Link>
                </p>
              </div>
            </div>
          ) : (
            <BlogsClient blogs={blogs} />
          )}

        </main>
      </div>
    </>
  );
}