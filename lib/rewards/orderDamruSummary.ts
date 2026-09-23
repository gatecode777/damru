import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import DamruTransaction from "@/models/DamruTransaction";

/** Ledger categories credited because of an order (all reversible by the order pipeline). */
const ORDER_EARN_CATEGORIES = ["order_reward", "item_reward", "category_reward", "tier_reward", "first_order", "campaign"];

export interface OrderDamruSummary {
  /**
   * estimated — not delivered yet; `estimated` is the placement-time estimate.
   * earned    — credited (net of any reversal).
   * reversed  — credited, then fully reversed (cancel / refund / failed payment).
   * none      — nothing to earn (cancelled before delivery, guest order, or nothing qualified).
   */
  status: "estimated" | "earned" | "reversed" | "none";
  estimated: number | null;
  earned: number;
  reversed: number;
  net: number;
}

type OrderLike = { _id: unknown; status: string; damruEstimate?: number | null };

/** Adds `damru` to each order from ONE bounded ledger aggregate (no per-order queries). */
export async function attachOrderDamruSummaries<T extends OrderLike>(
  orders: T[],
  userId: string | mongoose.Types.ObjectId
): Promise<(T & { damru: OrderDamruSummary })[]> {
  if (orders.length === 0) return [];
  await connectDB();
  const ids = orders.map(o => new mongoose.Types.ObjectId(String(o._id)));
  const rows = await DamruTransaction.aggregate<{ _id: { orderId: mongoose.Types.ObjectId; type: string }; amount: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        orderId: { $in: ids },
        $or: [
          { type: "credit", category: { $in: ORDER_EARN_CATEGORIES } },
          { type: "debit", category: "reward_reversal", originalCategory: { $in: ORDER_EARN_CATEGORIES } },
        ],
      },
    },
    { $group: { _id: { orderId: "$orderId", type: "$type" }, amount: { $sum: "$amount" } } },
  ]);

  const totals = new Map<string, { earned: number; reversed: number }>();
  for (const row of rows) {
    const key = String(row._id.orderId);
    const entry = totals.get(key) ?? { earned: 0, reversed: 0 };
    if (row._id.type === "credit") entry.earned += row.amount; else entry.reversed += row.amount;
    totals.set(key, entry);
  }

  return orders.map(order => {
    const { earned, reversed } = totals.get(String(order._id)) ?? { earned: 0, reversed: 0 };
    const net = Math.max(0, earned - reversed);
    const estimated = typeof order.damruEstimate === "number" ? order.damruEstimate : null;
    let status: OrderDamruSummary["status"];
    if (earned > 0) status = net > 0 ? "earned" : "reversed";
    else if (order.status === "cancelled" || order.status === "delivered") status = "none";
    else status = estimated && estimated > 0 ? "estimated" : "none";
    return { ...order, damru: { status, estimated, earned, reversed, net } };
  });
}
