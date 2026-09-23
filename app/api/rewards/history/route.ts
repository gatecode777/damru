import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import mongoose from "mongoose";
import DamruTransaction from "@/models/DamruTransaction";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
    // Optional ?orderId= — always combined with the session user, so it can
    // only ever narrow the caller's own history (no IDOR).
    const orderId = searchParams.get("orderId");
    if (orderId && !mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const filter: Record<string, unknown> = { userId: sessionUser.id, ...(orderId ? { orderId } : {}) };

    const [transactions, total] = await Promise.all([
      DamruTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("type category amount balanceAfter description createdAt expiresAt orderId valuePaise")
        .lean(),
      DamruTransaction.countDocuments(filter),
    ]);

    return NextResponse.json({
      transactions: JSON.parse(JSON.stringify(transactions)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET rewards/history error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
