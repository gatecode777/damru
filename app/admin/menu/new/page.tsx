import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import MenuItemForm from "../MenuItemForm";
import { getAdminPerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";

export const metadata = { title: "New Menu Item" };

export default async function NewMenuItemPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("menu", "create")) redirect("/admin/dashboard");

  let categories: { _id: string; name: string }[] = [];
  try {
    await connectDB();
    const raw = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
    categories = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  return (
    <>
      <AdminSidebar />
      <MenuItemForm categories={categories} />
    </>
  );
}