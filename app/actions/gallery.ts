"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";

// ── Upsert a tab (create or update basic info + banner) ──────
export async function upsertGalleryTab(formData: FormData) {
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

// ── Delete a tab ─────────────────────────────────────────────
export async function deleteGalleryTab(id: string) {
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
  await connectDB();
  await GalleryTab.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { success: true };
}

// ── Add item to a tab ────────────────────────────────────────
export async function addGalleryItem(tabId: string, formData: FormData) {
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