import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import BlogCategoryForm from "../BlogCategoryForm";

export const metadata = { title: "New Blog Category" };

export default async function NewBlogCategoryPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="New Blog Category" />
        <BlogCategoryForm />
      </div>
    </>
  );
}