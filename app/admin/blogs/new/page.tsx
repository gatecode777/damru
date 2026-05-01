import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import BlogCategory from "@/models/BlogCategory";
import BlogForm from "../BlogForm";

export const metadata = { title: "New Blog Post" };

export default async function NewBlogPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let categories: { _id: string; name: string }[] = [];
  try {
    await connectDB();
    const raw = await BlogCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    categories = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="New Blog Post" />
        <BlogForm categories={categories} />
      </div>
    </>
  );
}