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
  const order = await Order.findByIdAndUpdate(id, { status }, { new: true });

  // If order is completed or cancelled, check if we should free the table
  if (order && order.tableId && (status === "delivered" || status === "cancelled")) {
    const activeOrder = await Order.findOne({
      tableId: order.tableId,
      status: { $in: ["pending", "confirmed", "preparing", "out_for_delivery"] },
      _id: { $ne: order._id }
    });
    if (!activeOrder) {
      const Table = (await import("@/models/Table")).default;
      await Table.findByIdAndUpdate(order.tableId, { status: "available" });
    }
  }

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
  const order = await Order.findByIdAndUpdate(id, { status: "cancelled" }, { new: true });

  // If order is cancelled, check if we should free the table
  if (order && order.tableId) {
    const activeOrder = await Order.findOne({
      tableId: order.tableId,
      status: { $in: ["pending", "confirmed", "preparing", "out_for_delivery"] },
      _id: { $ne: order._id }
    });
    if (!activeOrder) {
      const Table = (await import("@/models/Table")).default;
      await Table.findByIdAndUpdate(order.tableId, { status: "available" });
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { success: true };
}