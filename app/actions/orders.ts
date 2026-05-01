"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";

export async function updateOrderStatus(id: string, status: string) {
  await connectDB();
  await Order.findByIdAndUpdate(id, { status });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}

export async function updatePaymentStatus(id: string, paymentStatus: string) {
  await connectDB();
  await Order.findByIdAndUpdate(id, { paymentStatus });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}

export async function cancelOrder(id: string) {
  await connectDB();
  await Order.findByIdAndUpdate(id, { status: "cancelled" });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}