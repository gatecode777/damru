import type { PaymentMethod, PaymentStatus } from "@/models/Order";

const FULFILMENT_STATUSES = new Set([
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
]);

/**
 * COD is settled operationally at fulfilment, so it is eligible unless its
 * payment has been recorded as failed. Every online/legacy gateway method
 * must have a server-confirmed paid state before fulfilment or rewards.
 */
export function isOrderPaymentEligible(order: {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}): boolean {
  if (order.paymentMethod === "cod") return order.paymentStatus !== "failed";
  return order.paymentStatus === "paid";
}

export function getOrderStatusPaymentError(
  order: { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus },
  nextStatus: string,
): string | null {
  if (!FULFILMENT_STATUSES.has(nextStatus) || isOrderPaymentEligible(order)) return null;
  if (order.paymentMethod === "cod") {
    return "This Cash on Delivery order's payment is marked failed. Update the payment status before moving it into fulfilment.";
  }
  return "Online payment must be confirmed by Razorpay before this order can move into fulfilment.";
}

/** Reusable Mongo filter for reward/statistics queries over fulfilled orders. */
export function paymentEligibleOrderFilter() {
  return {
    $or: [
      { paymentMethod: "cod", paymentStatus: { $ne: "failed" } },
      { paymentStatus: "paid" },
    ],
  };
}
