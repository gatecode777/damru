import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import DamruTransaction from "@/models/DamruTransaction";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const [transactions, total] = await Promise.all([
      DamruTransaction.find({ userId: sessionUser.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("type category amount balanceAfter description createdAt expiresAt")
        .lean(),
      DamruTransaction.countDocuments({ userId: sessionUser.id }),
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
