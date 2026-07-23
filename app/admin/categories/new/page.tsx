import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import CategoryForm from "../CategoryForm";

export const metadata = { title: "New Category" };

export default async function NewCategoryPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <>
      <AdminSidebar />
      <CategoryForm />
    </>
  );
}