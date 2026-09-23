import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { getClientIp } from "@/lib/rateLimit";
import { getOrCreateDamruConfig, invalidateDamruConfigCache, toDamruConfigValues, type DamruConfigValues } from "@/lib/getDamruConfig";
import { damruPerRupee } from "@/lib/rewards/damruValue";
import { validateDamruConfigUpdate } from "@/lib/rewards/damruConfigUpdate";

function withDisplay(config: DamruConfigValues) {
  return { ...config, damruPerRupee: damruPerRupee(config.paisePerDamru) };
}

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const config = toDamruConfigValues(await getOrCreateDamruConfig());
    return NextResponse.json({ config: withDisplay(config) });
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
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const doc = await getOrCreateDamruConfig();
    const before = toDamruConfigValues(doc);

    const { next, error } = validateDamruConfigUpdate(body, before);
    if (error || !next) return NextResponse.json({ error }, { status: 400 });

    // Changing expiry only affects future credits — existing lots keep the
    // expiresAt they were assigned at creation time. Changing the Damru value
    // never rewrites history: every ledger row carries its own value snapshot.
    doc.paisePerDamru = next.paisePerDamru;
    doc.orderEarn = { ...next.orderEarn };
    doc.minRedemption = next.minRedemption;
    doc.maxRedemptionPerOrder = next.maxRedemptionPerOrder;
    doc.dailyEarnLimit = next.dailyEarnLimit;
    doc.expiryEnabled = next.expiryEnabled;
    doc.expiryDays = next.expiryDays;
    doc.expiryWarningDays = next.expiryWarningDays;
    doc.loyaltyThresholds = { ...next.loyaltyThresholds };
    await doc.save();
    invalidateDamruConfigCache();

    const after = toDamruConfigValues(doc);
    const changed = (Object.keys(after) as (keyof DamruConfigValues)[]).filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    if (changed.length > 0) {
      await logAdminAction(
        changed.includes("paisePerDamru") ? "damru_value_changed" : "damru_config_updated",
        {
          targetType: "DamruConfig",
          targetId: String(doc._id),
          details: {
            changed,
            before: Object.fromEntries(changed.map(k => [k, before[k]])),
            after: Object.fromEntries(changed.map(k => [k, after[k]])),
            ...(reason ? { reason } : {}),
            request: { ip: getClientIp(req), userAgent: req.headers.get("user-agent") || undefined },
          },
        }
      );
    }

    return NextResponse.json({ success: true, config: withDisplay(after) });
  } catch (err) {
    console.error("PUT admin/rewards/config error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
