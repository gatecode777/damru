"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unlink } from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/mongodb";
import MenuItem from "@/models/MenuItem";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "menu-items");

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function deleteImageFile(filename?: string) {
  if (!filename) return;
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // File may not exist — ignore silently
  }
}

// ── Create ────────────────────────────────────────────────────────
export async function createMenuItem(formData: FormData) {
  await connectDB();

  const name        = (formData.get("name")        as string)?.trim();
  const category    = (formData.get("category")    as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const variantType = (formData.get("variantType") as string) || "none";
  const basePrice   = Number(formData.get("basePrice")) || 0;
  const isVeg       = formData.get("isVeg")      === "true";
  const isActive    = formData.get("isActive")   === "true";
  const isFeatured  = formData.get("isFeatured") === "true";
  const sortOrder   = Number(formData.get("sortOrder")) || 0;
  const image       = (formData.get("image") as string)?.trim() || "";

  if (!name)     return { error: "Item name is required." };
  if (!category) return { error: "Category is required." };

  let variants: { label: string; price: number }[] = [];
  const variantsRaw = formData.get("variants") as string;
  if (variantsRaw) {
    try { variants = JSON.parse(variantsRaw); }
    catch { return { error: "Invalid variants data." }; }
  }

  let slug = toSlug(name);
  const exists = await MenuItem.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now()}`;

  try {
    await MenuItem.create({
      name, slug, category, description, variantType,
      basePrice: variantType === "none" ? basePrice : 0,
      variants:  variantType !== "none" ? variants  : [],
      isVeg, isActive, isFeatured, sortOrder,
      image, // filename only
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create item." };
  }

  revalidatePath("/admin/menu");
  redirect("/admin/menu");
}

// ── Update ────────────────────────────────────────────────────────
export async function updateMenuItem(id: string, formData: FormData) {
  await connectDB();

  const name        = (formData.get("name")        as string)?.trim();
  const category    = (formData.get("category")    as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const variantType = (formData.get("variantType") as string) || "none";
  const basePrice   = Number(formData.get("basePrice")) || 0;
  const isVeg       = formData.get("isVeg")      === "true";
  const isActive    = formData.get("isActive")   === "true";
  const isFeatured  = formData.get("isFeatured") === "true";
  const sortOrder   = Number(formData.get("sortOrder")) || 0;
  const newImage    = (formData.get("image")      as string)?.trim() || "";
  const oldImage    = (formData.get("oldImage")   as string)?.trim() || "";

  if (!name)     return { error: "Item name is required." };
  if (!category) return { error: "Category is required." };

  let variants: { label: string; price: number }[] = [];
  const variantsRaw = formData.get("variants") as string;
  if (variantsRaw) {
    try { variants = JSON.parse(variantsRaw); }
    catch { return { error: "Invalid variants data." }; }
  }

  // If image changed, delete the old file
  if (newImage && oldImage && oldImage !== newImage) {
    await deleteImageFile(oldImage);
  }

  try {
    await MenuItem.findByIdAndUpdate(id, {
      name, category, description, variantType,
      basePrice: variantType === "none" ? basePrice : 0,
      variants:  variantType !== "none" ? variants  : [],
      isVeg, isActive, isFeatured, sortOrder,
      image: newImage,
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update item." };
  }

  revalidatePath("/admin/menu");
  redirect("/admin/menu");
}

// ── Delete ────────────────────────────────────────────────────────
export async function deleteMenuItem(id: string) {
  await connectDB();
  try {
    const item = await MenuItem.findByIdAndDelete(id);
    if (item?.image) await deleteImageFile(item.image);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete item." };
  }
  revalidatePath("/admin/menu");
  return { success: true };
}

// ── Toggle active ─────────────────────────────────────────────────
export async function toggleMenuItemActive(id: string, current: boolean) {
  await connectDB();
  await MenuItem.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/menu");
  return { success: true };
}