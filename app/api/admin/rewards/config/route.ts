import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { getOrCreateDamruConfig } from "@/lib/getDamruConfig";
import { validateExpiryConfig } from "@/lib/rewards/damruAllocation";

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const config = await getOrCreateDamruConfig();
    return NextResponse.json({ config: JSON.parse(JSON.stringify(config)) });
  } catch (err) {
    console.error("GET admin/rewards/config error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { redemptionRate, minRedemption, maxRedemptionPerOrder, dailyEarnLimit, expiryEnabled, expiryDays, expiryWarningDays, loyaltyThresholds } = body;

    if (redemptionRate !== undefined && redemptionRate <= 0) return NextResponse.json({ error: "Redemption rate must be positive." }, { status: 400 });
    if (minRedemption !== undefined && maxRedemptionPerOrder !== undefined && minRedemption > maxRedemptionPerOrder) {
      return NextResponse.json({ error: "Minimum redemption cannot exceed maximum redemption." }, { status: 400 });
    }

    const config = await getOrCreateDamruConfig();

    // Section 39 of PRD 4A: validated server-side regardless of what the
    // client sends, against the EFFECTIVE post-update values (not just the
    // fields present in this request) since expiryEnabled/expiryDays/
    // expiryWarningDays can be submitted independently of each other.
    const effectiveEnabled = expiryEnabled !== undefined ? Boolean(expiryEnabled) : config.expiryEnabled;
    const effectiveDays = expiryDays !== undefined ? expiryDays : config.expiryDays;
    const effectiveWarningDays = expiryWarningDays !== undefined ? expiryWarningDays : config.expiryWarningDays;

    const expiryError = validateExpiryConfig({ expiryEnabled: effectiveEnabled, expiryDays: effectiveDays, expiryWarningDays: effectiveWarningDays });
    if (expiryError) return NextResponse.json({ error: expiryError }, { status: 400 });

    if (redemptionRate !== undefined) config.redemptionRate = redemptionRate;
    if (minRedemption !== undefined) config.minRedemption = minRedemption;
    if (maxRedemptionPerOrder !== undefined) config.maxRedemptionPerOrder = maxRedemptionPerOrder;
    if (dailyEarnLimit !== undefined) config.dailyEarnLimit = dailyEarnLimit;
    // Changing these only affects future credits — existing lots keep the
    // expiresAt they were assigned at creation time (PRD 4A section 40/41).
    if (expiryEnabled !== undefined) config.expiryEnabled = expiryEnabled;
    if (expiryDays !== undefined) config.expiryDays = expiryDays;
    if (expiryWarningDays !== undefined) config.expiryWarningDays = expiryWarningDays;
    if (loyaltyThresholds !== undefined) config.loyaltyThresholds = { ...config.loyaltyThresholds, ...loyaltyThresholds };
    await config.save();

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("PUT admin/rewards/config error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
