"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import { getAdminPerms } from "@/lib/adminPermissions";

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Create ──────────────────────────────────────────────────────────
export async function createCategory(formData: FormData) {
  // Check if user has create permission for categories
  const perms = await getAdminPerms();
  if (!perms.can("categories", "create")) throw new Error("Forbidden - You don't have permission to create categories.");
  
  await connectDB();
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const sortOrder = Number(formData.get("sortOrder")) || 0;
  const isActive = formData.get("isActive") === "true";

  if (!name) return { error: "Category name is required." };

  let slug = toSlug(name);
  // Ensure unique slug
  const exists = await Category.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now()}`;

  try {
    await Category.create({ name, slug, description, sortOrder, isActive });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create category." };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

// ── Update ──────────────────────────────────────────────────────────
export async function updateCategory(id: string, formData: FormData) {
  // Check if user has edit permission for categories
  const perms = await getAdminPerms();
  if (!perms.can("categories", "edit")) throw new Error("Forbidden - You don't have permission to update categories.");
  
  await connectDB();
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const sortOrder = Number(formData.get("sortOrder")) || 0;
  const isActive = formData.get("isActive") === "true";

  if (!name) return { error: "Category name is required." };

  try {
    await Category.findByIdAndUpdate(id, { name, description, sortOrder, isActive });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update category." };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

// ── Delete ──────────────────────────────────────────────────────────
export async function deleteCategory(id: string) {
  // Check if user has delete permission for categories
  const perms = await getAdminPerms();
  if (!perms.can("categories", "delete")) throw new Error("Forbidden - You don't have permission to delete categories.");
  
  await connectDB();
  try {
    // Handle menu items that belong to this category
    // Delete all menu items in this category
    await MenuItem.deleteMany({ category: id });
    
    // Option 2: Or unassign them (comment the above and uncomment below)
    // await MenuItem.updateMany({ category: id }, { $unset: { category: "" } });
    
    await Category.findByIdAndDelete(id);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete." };
  }
  revalidatePath("/admin/categories");
  return { success: true };
}

// ── Toggle active ────────────────────────────────────────────────────
export async function toggleCategoryActive(id: string, current: boolean) {
  // Check if user has edit permission for categories
  const perms = await getAdminPerms();
  if (!perms.can("categories", "edit")) throw new Error("Forbidden - You don't have permission to change category status.");
  
  await connectDB();
  await Category.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/categories");
  return { success: true };
}