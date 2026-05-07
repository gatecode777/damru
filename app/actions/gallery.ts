"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";
import { getAdminPerms } from "@/lib/adminPermissions";

// ── Upsert a tab (create or update basic info + banner) ──────
export async function upsertGalleryTab(formData: FormData) {
  // Check if user has create or edit permission for gallery
  const perms = await getAdminPerms();
  const isCreating = !(await isTabExists(formData.get("tabKey") as string));
  
  if (isCreating) {
    if (!perms.can("gallery", "create")) throw new Error("Forbidden - You don't have permission to create gallery tabs.");
  } else {
    if (!perms.can("gallery", "edit")) throw new Error("Forbidden - You don't have permission to edit gallery tabs.");
  }
  
  await connectDB();

  const tabKey      = (formData.get("tabKey")      as string)?.trim().toLowerCase();
  const label       = (formData.get("label")       as string)?.trim();
  const bannerImage = (formData.get("bannerImage") as string)?.trim() || "";
  const bannerAlt   = (formData.get("bannerAlt")   as string)?.trim() || "";
  const sortOrder   = Number(formData.get("sortOrder")) || 0;
  const isActive    = formData.get("isActive") === "true";

  if (!tabKey || !label) return { error: "Tab key and label are required." };

  try {
    await GalleryTab.findOneAndUpdate(
      { tabKey },
      { tabKey, label, bannerImage, bannerAlt, sortOrder, isActive },
      { upsert: true, new: true }
    );
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to save tab." };
  }

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// Helper function to check if a tab exists
async function isTabExists(tabKey: string): Promise<boolean> {
  if (!tabKey) return false;
  await connectDB();
  const tab = await GalleryTab.findOne({ tabKey }).lean();
  return !!tab;
}

// ── Delete a tab ─────────────────────────────────────────────
export async function deleteGalleryTab(id: string) {
  // Check if user has delete permission for gallery
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "delete")) throw new Error("Forbidden - You don't have permission to delete gallery tabs.");
  
  await connectDB();
  try {
    await GalleryTab.findByIdAndDelete(id);
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete." };
  }
  return { success: true };
}

// ── Toggle tab active status ─────────────────────────────────
export async function toggleGalleryTabActive(id: string, current: boolean) {
  // Check if user has edit permission for gallery
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "edit")) throw new Error("Forbidden - You don't have permission to change gallery tab status.");
  
  await connectDB();
  await GalleryTab.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// ── Add item to a tab ────────────────────────────────────────
export async function addGalleryItem(tabId: string, formData: FormData) {
  // Check if user has create permission for gallery
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "create")) throw new Error("Forbidden - You don't have permission to add gallery items.");
  
  await connectDB();

  const image        = (formData.get("image")       as string)?.trim();
  const alt          = (formData.get("alt")          as string)?.trim() || "";
  const title        = (formData.get("title")        as string)?.trim();
  const description  = (formData.get("description")  as string)?.trim() || "";
  const type         = (formData.get("type")         as string) === "narrow" ? "narrow" : "wide";
  const overlayClass = (formData.get("overlayClass") as string) === "top-aligned" ? "top-aligned" : "";
  const sortOrder    = Number(formData.get("sortOrder")) || 0;

  if (!image || !title) return { error: "Image and title are required." };

  try {
    await GalleryTab.findByIdAndUpdate(tabId, {
      $push: { items: { image, alt, title, description, type, overlayClass, sortOrder } },
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add item." };
  }

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// ── Update a single item inside a tab ───────────────────────
export async function updateGalleryItem(
  tabId: string,
  itemId: string,
  formData: FormData
) {
  // Check if user has edit permission for gallery
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "edit")) throw new Error("Forbidden - You don't have permission to update gallery items.");
  
  await connectDB();

  const image        = (formData.get("image")       as string)?.trim() || "";
  const alt          = (formData.get("alt")          as string)?.trim() || "";
  const title        = (formData.get("title")        as string)?.trim();
  const description  = (formData.get("description")  as string)?.trim() || "";
  const type         = (formData.get("type")         as string) === "narrow" ? "narrow" : "wide";
  const overlayClass = (formData.get("overlayClass") as string) === "top-aligned" ? "top-aligned" : "";
  const sortOrder    = Number(formData.get("sortOrder")) || 0;

  if (!title) return { error: "Title is required." };

  try {
    await GalleryTab.findOneAndUpdate(
      { _id: tabId, "items._id": itemId },
      {
        $set: {
          "items.$.image":        image,
          "items.$.alt":          alt,
          "items.$.title":        title,
          "items.$.description":  description,
          "items.$.type":         type,
          "items.$.overlayClass": overlayClass,
          "items.$.sortOrder":    sortOrder,
        },
      }
    );
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update item." };
  }

  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// ── Delete an item from a tab ────────────────────────────────
export async function deleteGalleryItem(tabId: string, itemId: string) {
  // Check if user has delete permission for gallery
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "delete")) throw new Error("Forbidden - You don't have permission to delete gallery items.");
  
  await connectDB();
  try {
    await GalleryTab.findByIdAndUpdate(tabId, {
      $pull: { items: { _id: itemId } },
    });
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete item." };
  }
  return { success: true };
}