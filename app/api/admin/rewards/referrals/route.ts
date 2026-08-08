import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import Referral, { ReferralStatus } from "@/models/Referral";

const STATUSES: ReferralStatus[] = ["REGISTERED", "PENDING_QUALIFICATION", "QUALIFIED", "REWARDED", "REJECTED", "CANCELLED"];

export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Number(searchParams.get("limit")) || 30);

    const filter: Record<string, unknown> = {};
    if (status && STATUSES.includes(status as ReferralStatus)) filter.status = status;

    const [referrals, total] = await Promise.all([
      Referral.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("referrerUserId", "name email")
        .populate("referredUserId", "name email")
        .lean(),
      Referral.countDocuments(filter),
    ]);

    return NextResponse.json({
      referrals: JSON.parse(JSON.stringify(referrals)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET admin/rewards/referrals error:", err);
    return NextResponse.json({ referrals: [] }, { status: 500 });
  }
}
