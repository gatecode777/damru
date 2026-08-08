import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { getOrCreateReferralConfig } from "@/lib/getReferralConfig";

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const config = await getOrCreateReferralConfig();
    return NextResponse.json({ config: JSON.parse(JSON.stringify(config)) });
  } catch (err) {
    console.error("GET admin/rewards/referrals/config error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const {
      isActive, referrerRewardDamru, referredUserRewardDamru, qualificationEvent,
      minimumOrderAmount, rewardDelayDays, maximumSuccessfulReferralsPerUser,
      codePrefix, codeLength, requireEmailVerified, requireMobileVerified,
      allowExistingUserReferralCodeEntry,
    } = body;

    if (referrerRewardDamru !== undefined && referrerRewardDamru < 0) return NextResponse.json({ error: "Referrer reward cannot be negative." }, { status: 400 });
    if (referredUserRewardDamru !== undefined && referredUserRewardDamru < 0) return NextResponse.json({ error: "Referred-user reward cannot be negative." }, { status: 400 });
    if (qualificationEvent !== undefined && !["FIRST_DELIVERED_ORDER", "FIRST_ELIGIBLE_ORDER"].includes(qualificationEvent)) {
      return NextResponse.json({ error: "Invalid qualification event." }, { status: 400 });
    }
    if (minimumOrderAmount !== undefined && minimumOrderAmount < 0) return NextResponse.json({ error: "Minimum order amount cannot be negative." }, { status: 400 });
    if (rewardDelayDays !== undefined && rewardDelayDays < 0) return NextResponse.json({ error: "Reward delay cannot be negative." }, { status: 400 });
    if (codeLength !== undefined && (codeLength < 4 || codeLength > 10)) return NextResponse.json({ error: "Code length must be between 4 and 10." }, { status: 400 });

    const config = await getOrCreateReferralConfig();
    if (isActive !== undefined) config.isActive = isActive;
    if (referrerRewardDamru !== undefined) config.referrerRewardDamru = referrerRewardDamru;
    if (referredUserRewardDamru !== undefined) config.referredUserRewardDamru = referredUserRewardDamru;
    if (qualificationEvent !== undefined) config.qualificationEvent = qualificationEvent;
    if (minimumOrderAmount !== undefined) config.minimumOrderAmount = minimumOrderAmount;
    if (rewardDelayDays !== undefined) config.rewardDelayDays = rewardDelayDays;
    if (maximumSuccessfulReferralsPerUser !== undefined) config.maximumSuccessfulReferralsPerUser = maximumSuccessfulReferralsPerUser;
    if (codePrefix !== undefined) config.codePrefix = codePrefix.trim().toUpperCase();
    if (codeLength !== undefined) config.codeLength = codeLength;
    if (requireEmailVerified !== undefined) config.requireEmailVerified = requireEmailVerified;
    if (requireMobileVerified !== undefined) config.requireMobileVerified = requireMobileVerified;
    if (allowExistingUserReferralCodeEntry !== undefined) config.allowExistingUserReferralCodeEntry = allowExistingUserReferralCodeEntry;
    await config.save();

    await logAdminAction("referral_config_update", { targetType: "ReferralConfig", targetId: String(config._id) });

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("PUT admin/rewards/referrals/config error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
