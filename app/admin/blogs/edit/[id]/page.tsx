import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";
import BlogCategory from "@/models/BlogCategory";
import BlogForm from "../../BlogForm";

export const metadata = { title: "Edit Blog Post" };

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  let blog = null;
  let categories: { _id: string; name: string }[] = [];

  try {
    await connectDB();
    const [rawBlog, rawCats] = await Promise.all([
      Blog.findById(id).populate("category", "name").lean(),
      BlogCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    ]);
    if (!rawBlog) notFound();
    blog       = JSON.parse(JSON.stringify(rawBlog));
    categories = JSON.parse(JSON.stringify(rawCats));
  } catch { notFound(); }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Edit Blog Post" />
        <BlogForm blog={blog} categories={categories} />
      </div>
    </>
  );
}