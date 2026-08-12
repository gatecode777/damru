import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import User from "@/models/User";
import DamruTransaction from "@/models/DamruTransaction";
import RewardReversal from "@/models/RewardReversal";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const user = await User.findById(id)
      .select("name email phone damruBalance damruTotalEarned damruTotalRedeemed rewardDebt loyaltyLevel dateOfBirth dobLocked marriageAnniversary anniversaryLocked")
      .lean();
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const [transactions, total] = await Promise.all([
      DamruTransaction.find({ userId: id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DamruTransaction.countDocuments({ userId: id }),
    ]);
    const reversedIds = new Set((await RewardReversal.find({ originalTransactionId: { $in: transactions.map(tx => tx._id) } }).distinct("originalTransactionId")).map(String));
    const transactionRows = transactions.map(tx => ({ ...tx, reversed: reversedIds.has(String(tx._id)) }));

    return NextResponse.json({
      user: JSON.parse(JSON.stringify(user)),
      transactions: JSON.parse(JSON.stringify(transactionRows)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET admin/rewards/users/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
