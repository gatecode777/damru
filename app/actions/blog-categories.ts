"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import BlogCategory from "@/models/BlogCategory";
import { getAdminPerms } from "@/lib/adminPermissions";

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Create ──────────────────────────────────────────────────
export async function createBlogCategory(formData: FormData) {
  // Check if user has create permission for blog categories
  const perms = await getAdminPerms();
  if (!perms.can("blog_categories", "create")) throw new Error("Forbidden - You don't have permission to create blog categories.");
  
  await connectDB();
  const name        = (formData.get("name")        as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const sortOrder   = Number(formData.get("sortOrder")) || 0;
  const isActive    = formData.get("isActive") === "true";

  if (!name) return { error: "Category name is required." };

  let slug = toSlug(name);
  const exists = await BlogCategory.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now()}`;

  try {
    await BlogCategory.create({ name, slug, description, sortOrder, isActive });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create category." };
  }

  revalidatePath("/admin/blog-categories");
  revalidatePath("/blogs");
  redirect("/admin/blog-categories");
}

// ── Update ──────────────────────────────────────────────────
export async function updateBlogCategory(id: string, formData: FormData) {
  // Check if user has edit permission for blog categories
  const perms = await getAdminPerms();
  if (!perms.can("blog_categories", "edit")) throw new Error("Forbidden - You don't have permission to update blog categories.");
  
  await connectDB();
  const name        = (formData.get("name")        as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const sortOrder   = Number(formData.get("sortOrder")) || 0;
  const isActive    = formData.get("isActive") === "true";

  if (!name) return { error: "Category name is required." };

  try {
    await BlogCategory.findByIdAndUpdate(id, { name, description, sortOrder, isActive });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update category." };
  }

  revalidatePath("/admin/blog-categories");
  revalidatePath("/blogs");
  redirect("/admin/blog-categories");
}

// ── Delete ──────────────────────────────────────────────────
export async function deleteBlogCategory(id: string) {
  // Check if user has delete permission for blog categories
  const perms = await getAdminPerms();
  if (!perms.can("blog_categories", "delete")) throw new Error("Forbidden - You don't have permission to delete blog categories.");
  
  await connectDB();
  try {
    await BlogCategory.findByIdAndDelete(id);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete." };
  }
  revalidatePath("/admin/blog-categories");
  revalidatePath("/blogs");
  return { success: true };
}

// ── Toggle active ────────────────────────────────────────────
export async function toggleBlogCategoryActive(id: string, current: boolean) {
  // Check if user has edit permission for blog categories
  const perms = await getAdminPerms();
  if (!perms.can("blog_categories", "edit")) throw new Error("Forbidden - You don't have permission to change blog category status.");
  
  await connectDB();
  await BlogCategory.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/blog-categories");
  return { success: true };
}