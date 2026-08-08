import { NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";

export async function GET() {
  const deny = await checkApiPerm("tables", "view");
  if (deny) return deny;

  try {
    await connectDB();
    // Fetch all active orders associated with tables
    const activeOrders = await Order.find({
      tableNumber: { $exists: true, $ne: null },
      status: { $in: ["pending", "confirmed", "preparing", "out_for_delivery"] },
    }).select("tableNumber").lean();

    // Map counts
    const counts: Record<string, number> = {};
    for (const order of activeOrders) {
      if (order.tableNumber) {
        counts[order.tableNumber] = (counts[order.tableNumber] || 0) + 1;
      }
    }

    return NextResponse.json({ counts });
  } catch (e) {
    console.error("GET admin/tables/orders error:", e);
    return NextResponse.json({ error: "Failed to fetch active orders count." }, { status: 500 });
  }
}
