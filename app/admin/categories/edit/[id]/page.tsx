import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import CategoryForm from "../../CategoryForm";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";

export const metadata = { title: "Edit Category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  await connectDB();
  const raw = await Category.findById(id).lean();
  if (!raw) notFound();

  const category = JSON.parse(JSON.stringify(raw));

  return (
    <>
      <AdminSidebar />
      <CategoryForm category={category} />
    </>
  );
}