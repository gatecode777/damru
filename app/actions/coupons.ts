"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import { getAdminPerms } from "@/lib/adminPermissions";

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Create ───────────────────────────────────────────────────
export async function createCoupon(formData: FormData) {
  // Check if user has create permission for coupons
  const perms = await getAdminPerms();
  if (!perms.can("coupons", "create")) throw new Error("Forbidden - You don't have permission to create coupons.");
  
  await connectDB();

  const type          = formData.get("type") as string;
  const value         = Number(formData.get("value"));
  const codeRaw       = (formData.get("code") as string)?.trim().toUpperCase();
  const code          = codeRaw || randomCode();
  const description   = (formData.get("description") as string)?.trim() || "";
  const maxDiscount   = formData.get("maxDiscount")   ? Number(formData.get("maxDiscount"))   : null;
  const minOrderValue = formData.get("minOrderValue") ? Number(formData.get("minOrderValue")) : 0;
  const usageLimit    = formData.get("usageLimit")    ? Number(formData.get("usageLimit"))    : null;
  const perUserLimit  = formData.get("perUserLimit")  ? Number(formData.get("perUserLimit"))  : 1;
  const startDate     = formData.get("startDate")     ? new Date(formData.get("startDate") as string) : new Date();
  const expiryDate    = formData.get("expiryDate")    ? new Date(formData.get("expiryDate") as string) : null;
  const isActive      = formData.get("isActive") === "true";

  if (!type || !value)          return { error: "Type and value are required." };
  if (type === "percentage" && value > 100) return { error: "Percentage cannot exceed 100." };

  const exists = await Coupon.findOne({ code });
  if (exists) return { error: `Coupon code "${code}" already exists.` };

  try {
    const coupon = await Coupon.create({
      code, description, type, value, maxDiscount, minOrderValue,
      usageLimit, perUserLimit, startDate, expiryDate, isActive,
    });
    revalidatePath("/admin/coupons");
    return { success: true, coupon: JSON.parse(JSON.stringify(coupon)) };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create coupon." };
  }
}

// ── Update ───────────────────────────────────────────────────
export async function updateCoupon(id: string, formData: FormData) {
  // Check if user has edit permission for coupons
  const perms = await getAdminPerms();
  if (!perms.can("coupons", "edit")) throw new Error("Forbidden - You don't have permission to edit coupons.");
  
  await connectDB();

  const type          = formData.get("type") as string;
  const value         = Number(formData.get("value"));
  const description   = (formData.get("description") as string)?.trim() || "";
  const maxDiscount   = formData.get("maxDiscount")   ? Number(formData.get("maxDiscount"))   : null;
  const minOrderValue = formData.get("minOrderValue") ? Number(formData.get("minOrderValue")) : 0;
  const usageLimit    = formData.get("usageLimit")    ? Number(formData.get("usageLimit"))    : null;
  const perUserLimit  = formData.get("perUserLimit")  ? Number(formData.get("perUserLimit"))  : 1;
  const startDate     = formData.get("startDate")     ? new Date(formData.get("startDate") as string) : new Date();
  const expiryDate    = formData.get("expiryDate")    ? new Date(formData.get("expiryDate") as string) : null;
  const isActive      = formData.get("isActive") === "true";

  if (!type || !value)          return { error: "Type and value are required." };
  if (type === "percentage" && value > 100) return { error: "Percentage cannot exceed 100." };

  try {
    await Coupon.findByIdAndUpdate(id, {
      description, type, value, maxDiscount, minOrderValue,
      usageLimit, perUserLimit, startDate, expiryDate, isActive,
    });
    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update coupon." };
  }
}

// ── Delete ───────────────────────────────────────────────────
export async function deleteCoupon(id: string) {
  // Check if user has delete permission for coupons
  const perms = await getAdminPerms();
  if (!perms.can("coupons", "delete")) throw new Error("Forbidden - You don't have permission to delete coupons.");
  
  await connectDB();
  try {
    await Coupon.findByIdAndDelete(id);
    revalidatePath("/admin/coupons");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete." };
  }
}

// ── Toggle active ────────────────────────────────────────────
export async function toggleCouponActive(id: string, current: boolean) {
  // Check if user has edit permission for coupons
  const perms = await getAdminPerms();
  if (!perms.can("coupons", "edit")) throw new Error("Forbidden - You don't have permission to change coupon status.");
  
  await connectDB();
  await Coupon.findByIdAndUpdate(id, { isActive: !current });
  revalidatePath("/admin/coupons");
  return { success: true };
}

// ── Generate random code ─────────────────────────────────────
export async function generateCouponCode(): Promise<string> {
  // Check if user has create permission for coupons (since generating a code is part of creation)
  const perms = await getAdminPerms();
  if (!perms.can("coupons", "create")) throw new Error("Forbidden - You don't have permission to generate coupon codes.");
  
  await connectDB();
  let code = randomCode();
  // Ensure uniqueness
  while (await Coupon.findOne({ code })) {
    code = randomCode();
  }
  return code;
}