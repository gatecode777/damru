"use server";

import { getAdminPerms } from "@/lib/adminPermissions";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unlink } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

// ── Helpers ──────────────────────────────────────────────────────────
async function deleteAvatarFile(filename?: string) {
  if (!filename) return;
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // File may not exist — ignore
  }
}

// ── Create User ──────────────────────────────────────────────────────
export async function createUser(formData: FormData) {
  await connectDB();

  const name       = (formData.get("name")     as string)?.trim();
  const email      = (formData.get("email")    as string)?.trim().toLowerCase();
  const phone      = (formData.get("phone")    as string)?.trim();
  const city       = (formData.get("city")     as string)?.trim();
  const password   = (formData.get("password") as string)?.trim();
  const status     = (formData.get("status")   as string) || "active";
  const totalSpend = Number(formData.get("totalSpend")) || 0;
  const avatar     = (formData.get("avatar")   as string)?.trim() || undefined;

  if (!name)     return { error: "Name is required." };
  if (!email)    return { error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return { error: "Please enter a valid 10-digit phone number." };
  if (!password) return { error: "Password is required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  // Check duplicate email
  const exists = await User.findOne({ email });
  if (exists) return { error: "A user with this email already exists." };

  const hashed = await bcrypt.hash(password, 10);

  try {
    await User.create({ name, email, phone, password: hashed, status, totalSpend, avatar });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create user." };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// ── Update User ──────────────────────────────────────────────────────
export async function updateUser(id: string, formData: FormData) {
  await connectDB();

  const name       = (formData.get("name")     as string)?.trim();
  const email      = (formData.get("email")    as string)?.trim().toLowerCase();
  const phone      = (formData.get("phone")    as string)?.trim();
  const city       = (formData.get("city")     as string)?.trim();
  const status     = (formData.get("status")   as string) || "active";
  const totalSpend = Number(formData.get("totalSpend")) || 0;
  const newAvatar  = (formData.get("avatar")   as string)?.trim() || undefined;
  const oldAvatar  = (formData.get("oldAvatar")as string)?.trim() || undefined;
  const newPassword= (formData.get("password") as string)?.trim();

  if (!name)  return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return { error: "Please enter a valid 10-digit phone number." };

  // Check duplicate email for OTHER users
  const dup = await User.findOne({ email, _id: { $ne: id } });
  if (dup) return { error: "Another user with this email already exists." };

  // Build update object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { name, email, phone, city, status, totalSpend };

  // Only change avatar if a new one was uploaded
  if (newAvatar) {
    update.avatar = newAvatar;
    // Remove old file if it changed
    if (oldAvatar && oldAvatar !== newAvatar) {
      await deleteAvatarFile(oldAvatar);
    }
  }

  // Only change password if a new one was provided
  if (newPassword) {
    if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };
    update.password = await bcrypt.hash(newPassword, 10);
  }

  try {
    await User.findByIdAndUpdate(id, update);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update user." };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// ── Delete User ──────────────────────────────────────────────────────
export async function deleteUser(id: string) {
  const perms = await getAdminPerms();
  if (!perms.can("users", "delete")) throw new Error("Forbidden");
  await connectDB();
  try {
    const user = await User.findByIdAndDelete(id);
    if (user?.avatar) await deleteAvatarFile(user.avatar);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete user." };
  }
  revalidatePath("/admin/users");
  return { success: true };
}

// ── Toggle status ─────────────────────────────────────────────────────
export async function toggleUserStatus(id: string, currentStatus: string) {
  const perms = await getAdminPerms();
  if (!perms.can("users", "edit")) throw new Error("Forbidden");
  await connectDB();
  const next = currentStatus === "active" ? "inactive" : "active";
  try {
    await User.findByIdAndUpdate(id, { status: next });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update status." };
  }
  revalidatePath("/admin/users");
  return { success: true, status: next };
}