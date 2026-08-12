"use server";
import mongoose from "mongoose";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import { getAdminPerms } from "@/lib/adminPermissions";
import { checkAndAwardFirstOrderReward, checkAndAwardOrderReward } from "@/lib/rewardEngine";
import { awardCampaignBonuses } from "@/lib/rewards/campaignEngine";
import { evaluateOrderAchievements } from "@/lib/achievementEngine";
import { evaluateOrderMissions } from "@/lib/missionEngine";
import { evaluateReferralQualification } from "@/lib/referralEngine";
import { evaluateLoyaltyTier } from "@/lib/loyaltyEngine";
import { notifyOrderEvent } from "@/lib/notifications/orderNotificationService";
import type { NotificationType } from "@/models/Notification";
import { reverseOrderRewards } from "@/lib/rewards/reversalEngine";
import { evaluateOrderRisk, evaluateRiskSafely } from "@/lib/rewards/riskEngine";
import { getOrderStatusPaymentError } from "@/lib/orders/orderPaymentPolicy";

const ORDER_STATUSES = new Set(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]);
const COD_PAYMENT_STATUSES = new Set(["pending", "paid", "failed"]);

const ORDER_STATUS_TO_NOTIFICATION_TYPE: Record<string, NotificationType | undefined> = {
  confirmed: "ORDER_CONFIRMED",
  preparing: "ORDER_PREPARING",
  out_for_delivery: "ORDER_OUT_FOR_DELIVERY",
  delivered: "ORDER_DELIVERED",
  cancelled: "ORDER_CANCELLED",
};

export async function updateOrderStatus(id: string, status: string) {
  // Check if user has edit permission for orders
  const perms = await getAdminPerms();
  if (!perms.can("orders", "edit")) throw new Error("Forbidden - You don't have permission to update order status.");
  if (!mongoose.isValidObjectId(id) || !ORDER_STATUSES.has(status)) throw new Error("Invalid order status request.");
  
  await connectDB();
  const currentOrder = await Order.findById(id).select("paymentMethod paymentStatus").lean();
  if (!currentOrder) throw new Error("Order not found.");
  const paymentError = getOrderStatusPaymentError(currentOrder, status);
  if (paymentError) throw new Error(paymentError);
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

  if (order && order.userId && status === "delivered") {
    let baseOrderReward = 0;
    try {
      const base = await checkAndAwardOrderReward(order.userId, order._id);
      if ("transaction" in base && base.transaction) baseOrderReward = base.transaction.amount;
      else baseOrderReward = Math.floor(Math.max(0, order.eligibleRewardAmount ?? order.subtotal - order.discount) / 10);
    } catch (err) { console.error("Order reward failed:", err); }
    try {
      await awardCampaignBonuses({ trigger:"ORDER_DELIVERED", userId:order.userId, sourceId:String(order._id), baseReward:baseOrderReward, orderId:order._id, eligibleAmount:order.eligibleRewardAmount ?? Math.max(0,order.subtotal-order.discount), branchId:order.branchId, categoryIds:order.items.map(i=>i.categoryId).filter(Boolean) as mongoose.Types.ObjectId[], menuItemIds:order.items.map(i=>i.menuItemId).filter(Boolean) as mongoose.Types.ObjectId[] });
    } catch (err) { console.error("Order campaign reward failed:", err); }
    try {
      await checkAndAwardFirstOrderReward(order.userId, order._id);
    } catch (err) {
      console.error("First order reward failed:", err);
    }
    try {
      await evaluateOrderAchievements(order.userId);
    } catch (err) {
      console.error("Order achievement evaluation failed:", err);
    }
    try {
      await evaluateOrderMissions(order.userId, order._id, order.total);
    } catch (err) {
      console.error("Order mission evaluation failed:", err);
    }
    try {
      await evaluateReferralQualification(order.userId, order._id, order.total);
    } catch (err) {
      console.error("Referral qualification evaluation failed:", err);
    }
    try {
      await evaluateLoyaltyTier(order.userId, { issueBonus: true });
    } catch (err) {
      console.error("Loyalty tier evaluation failed:", err);
    }
  }

  if (order?.userId && status === "cancelled") {
    try {
      await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
      await evaluateRiskSafely("order-cancelled", () => evaluateOrderRisk({ userId: order.userId!, orderId: order._id }));
    } catch (err) {
      console.error("Order reward reversal failed:", err);
      throw new Error("Order was cancelled, but its reward adjustment could not be completed. Retry the action or escalate for review.");
    }
  }

  if (order && order.userId) {
    const notifType = ORDER_STATUS_TO_NOTIFICATION_TYPE[status];
    if (notifType) {
      await notifyOrderEvent({
        userId: order.userId,
        type: notifType,
        sourceId: order._id,
        orderNumber: order.orderId,
        route: "/my-profile?tab=orders",
      });
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
  if (!mongoose.isValidObjectId(id) || !COD_PAYMENT_STATUSES.has(paymentStatus)) throw new Error("Invalid payment status request.");
  
  await connectDB();
  const order = await Order.findById(id).select("paymentMethod").lean();
  if (!order) throw new Error("Order not found.");
  if (order.paymentMethod !== "cod") {
    throw new Error("Online payment status is controlled by Razorpay verification and reconciliation.");
  }
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
  // Atomic conditional transition — a second cancel click (or two admin tabs)
  // on an already-cancelled order is a safe no-op, so the coupon-release and
  // Damru-restoration effects below can never double-apply for one order.
  const transitionedOrder = await Order.findOneAndUpdate(
    { _id: id, status: { $ne: "cancelled" } },
    { $set: { status: "cancelled", cancelledBy: "admin", cancellationReason: "Cancelled by restaurant administration", cancelledAt: new Date() } },
    { new: true }
  );

  if (transitionedOrder) {
    // Release a reserved coupon usage — a cancelled order should not
    // permanently consume a coupon slot, regardless of payment method. See
    // docs/PAYMENT_RELIABILITY_REFUNDS.md's Coupon Restoration Policy.
    if (transitionedOrder.couponCode) {
      const { releaseCouponUsage } = await import("@/lib/payments/refunds");
      await releaseCouponUsage(transitionedOrder.couponCode);
    }

    // Damru restoration for orders that never actually collected payment: COD
    // (nothing was ever charged) or a Razorpay order that never reached
    // "paid" (pending/failed). A PAID Razorpay order's Damru is restored only
    // via an actual refund reaching "processed" — never here; see
    // lib/payments/refunds.ts and docs/PAYMENT_RELIABILITY_REFUNDS.md.
    if (transitionedOrder.paymentMethod === "cod" || transitionedOrder.paymentStatus === "pending" || transitionedOrder.paymentStatus === "failed") {
      const { restoreDamruForOrder } = await import("@/lib/payments/refunds");
      await restoreDamruForOrder(transitionedOrder._id, transitionedOrder.userId, `cancel_${transitionedOrder._id}`);
    }

    if (transitionedOrder.userId) {
      await notifyOrderEvent({
        userId: transitionedOrder.userId,
        type: "ORDER_CANCELLED",
        sourceId: transitionedOrder._id,
        orderNumber: transitionedOrder.orderId,
        route: "/my-profile?tab=orders",
      });
    }
  }

  const order = transitionedOrder || await Order.findOne({ _id: id, status: "cancelled" });
  if (order) {
    await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
    if (order.userId) await evaluateRiskSafely("order-cancelled", () => evaluateOrderRisk({ userId: order.userId!, orderId: order._id }));
  }

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
