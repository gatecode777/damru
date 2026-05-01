import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import MenuItemForm from "../../MenuItemForm";
import { connectDB } from "@/lib/mongodb";
import MenuItemModel from "@/models/MenuItem";
import Category from "@/models/Category";

export const metadata = { title: "Edit Menu Item" };

export default async function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;

  let item = null;
  let categories: { _id: string; name: string }[] = [];

  try {
    await connectDB();
    const [rawItem, rawCats] = await Promise.all([
      MenuItemModel.findById(id).populate("category", "name").lean(),
      Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    ]);
    if (!rawItem) notFound();
    item = JSON.parse(JSON.stringify(rawItem));
    categories = JSON.parse(JSON.stringify(rawCats));
  } catch {
    notFound();
  }

  return (
    <>
      <AdminSidebar />
      <MenuItemForm categories={categories} item={item} />
    </>
  );
}