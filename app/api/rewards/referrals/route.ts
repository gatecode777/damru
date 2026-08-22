import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import { getSettings } from "@/lib/getSettings";
import Referral from "@/models/Referral";
import { getOrCreateReferralCode } from "@/lib/referralEngine";
import { maskName } from "@/lib/mask";

const ACTIVE_STATUSES = ["REGISTERED", "PENDING_QUALIFICATION", "QUALIFIED"];

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const [referralCode, settings] = await Promise.all([
      getOrCreateReferralCode(sessionUser.id),
      getSettings(),
    ]);
    const requestOrigin = req.nextUrl.origin;
    const requestHost = req.nextUrl.hostname;
    const publicOrigin = (requestHost === "localhost" || requestHost === "127.0.0.1"
      ? process.env.NEXT_PUBLIC_SITE_URL || settings.siteUrl
      : requestOrigin
    ).replace(/\/$/, "");
    const referralLink = `${publicOrigin}/?ref=${encodeURIComponent(referralCode)}`;

    const [total, pending, successful, earnedAgg, referrals] = await Promise.all([
      Referral.countDocuments({ referrerUserId: sessionUser.id }),
      Referral.countDocuments({ referrerUserId: sessionUser.id, status: { $in: ACTIVE_STATUSES } }),
      Referral.countDocuments({ referrerUserId: sessionUser.id, status: "REWARDED" }),
      Referral.aggregate([
        { $match: { referrerUserId: new mongoose.Types.ObjectId(sessionUser.id), status: "REWARDED" } },
        { $group: { _id: null, total: { $sum: "$referrerRewardAmount" } } },
      ]),
      Referral.find({ referrerUserId: sessionUser.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("referredUserId", "name")
        .lean(),
    ]);

    type PopulatedReferral = {
      _id: unknown;
      status: string;
      registeredAt: Date;
      qualifiedAt?: Date | null;
      rewardedAt?: Date | null;
      referrerRewardAmount: number;
      referredUserId: { name: string } | null;
    };

    const list = (referrals as unknown as PopulatedReferral[]).map(r => ({
      id: String(r._id),
      status: r.status,
      registeredAt: r.registeredAt,
      qualifiedAt: r.qualifiedAt || null,
      rewardedAt: r.rewardedAt || null,
      rewardAmount: r.referrerRewardAmount,
      referredName: r.referredUserId ? maskName(r.referredUserId.name) : null,
    }));

    return NextResponse.json({
      referralCode,
      share: {
        message: `Join Damru By Namo and get Damru rewards! Use my code ${referralCode} when you sign up: ${referralLink}`,
        link: referralLink,
      },
      summary: {
        total,
        pending,
        successful,
        totalDamruEarned: earnedAgg[0]?.total || 0,
      },
      referrals: list,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET rewards/referrals error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
