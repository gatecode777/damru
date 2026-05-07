"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import { getAdminPerms } from "@/lib/adminPermissions";

export async function updateOrderStatus(id: string, status: string) {
  // Check if user has edit permission for orders
  const perms = await getAdminPerms();
  if (!perms.can("orders", "edit")) throw new Error("Forbidden - You don't have permission to update order status.");
  
  await connectDB();
  await Order.findByIdAndUpdate(id, { status });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}

export async function updatePaymentStatus(id: string, paymentStatus: string) {
  // Check if user has edit permission for orders
  const perms = await getAdminPerms();
  if (!perms.can("orders", "edit")) throw new Error("Forbidden - You don't have permission to update payment status.");
  
  await connectDB();
  await Order.findByIdAndUpdate(id, { paymentStatus });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}

export async function cancelOrder(id: string) {
  // Check if user has delete permission for orders (cancelling is a destructive action)
  const perms = await getAdminPerms();
  if (!perms.can("orders", "delete")) throw new Error("Forbidden - You don't have permission to cancel orders.");
  
  await connectDB();
  await Order.findByIdAndUpdate(id, { status: "cancelled" });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}