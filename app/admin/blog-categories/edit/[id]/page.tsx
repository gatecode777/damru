import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import BlogCategory from "@/models/BlogCategory";
import BlogCategoryForm from "../../BlogCategoryForm";

export const metadata = { title: "Edit Blog Category" };

export default async function EditBlogCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  let category = null;

  try {
    await connectDB();
    const raw = await BlogCategory.findById(id).lean();
    if (!raw) notFound();
    category = JSON.parse(JSON.stringify(raw));
  } catch { notFound(); }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Edit Blog Category" />
        <BlogCategoryForm category={category} />
      </div>
    </>
  );
}