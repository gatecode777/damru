import { colors } from "@/config";

// Mirrors models/Order.ts OrderStatus — keep in sync with the backend enum.
export const ORDER_STEPS = [
  { key: "pending", label: "Placed", icon: "receipt-outline" as const },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-circle-outline" as const },
  { key: "preparing", label: "Preparing", icon: "restaurant-outline" as const },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "bicycle-outline" as const },
  { key: "delivered", label: "Delivered", icon: "home-outline" as const },
] as const;

// A dine-in order never leaves the table, so "Out for Delivery" doesn't apply —
// mirrors the website's my-profile order-detail step filtering.
export const DINE_IN_ORDER_STEPS = [
  ORDER_STEPS[0],
  ORDER_STEPS[1],
  ORDER_STEPS[2],
  { key: "delivered", label: "Served", icon: "checkmark-done-outline" as const },
] as const;

// Only these two statuses are cancellable — mirrors app/api/orders/[id]/cancel/route.ts,
// which rejects once preparation has started.
export const CANCELLABLE_STATUSES = ["pending", "confirmed"];

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Changed my mind",
  "Delivery is taking too long",
  "Found a better price elsewhere",
  "Other",
];

export const PAYMENT_STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Payment Pending", color: "#b45309", bg: "#fffbeb" },
  paid: { label: "Paid", color: "#15803d", bg: "#f0fdf4" },
  failed: { label: "Payment Failed", color: "#b91c1c", bg: "#fef2f2" },
  refund_pending: { label: "Refund Processing", color: "#b45309", bg: "#fffbeb" },
  partially_refunded: { label: "Partially Refunded", color: "#0e7490", bg: "#ecfeff" },
  refunded: { label: "Refunded", color: "#6d28d9", bg: "#f5f3ff" },
};

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "#15803d";
    case "cancelled":
      return colors.danger;
    case "pending":
      return "#b45309";
    default:
      return colors.orange;
  }
}

export function getStatusBg(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "#f0fdf4";
    case "cancelled":
      return "#fef2f2";
    case "pending":
      return "#fffbeb";
    default:
      return "rgba(229, 121, 34, 0.1)";
  }
}
