import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import LoyaltyTier, { LoyaltyQualificationType } from "@/models/LoyaltyTier";
import { validateLoyaltyLadder } from "@/lib/loyaltyEngine";

const TYPES: LoyaltyQualificationType[] = ["LIFETIME_SPEND", "COMPLETED_ORDERS", "DAMRU_EARNED"];
function clean(body: any) {
  return { name: body.name?.trim(), code: body.code?.trim().toUpperCase(), rank: Number(body.rank), qualificationType: body.qualificationType, minimumValue: Number(body.minimumValue), maximumValue: body.maximumValue === null || body.maximumValue === "" ? null : Number(body.maximumValue), damruMultiplier: Number(body.damruMultiplier ?? 1), benefits: Array.isArray(body.benefits) ? body.benefits.map((v: unknown) => String(v).trim()).filter(Boolean) : [], badgeName: body.badgeName?.trim() || undefined, badgeIcon: body.badgeIcon?.trim() || undefined, tierBonusDamru: Number(body.tierBonusDamru || 0), isActive: body.isActive !== false };
}
export async function GET() {
  const deny = await checkApiPerm("rewards", "view"); if (deny) return deny;
  await connectDB(); return NextResponse.json({ tiers: await LoyaltyTier.find().sort({ rank: 1 }).lean() });
}
export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit"); if (deny) return deny;
  try {
    const data = clean(await req.json());
    if (!data.name || !data.code || !TYPES.includes(data.qualificationType)) return NextResponse.json({ error: "Name, code, and a valid qualification type are required." }, { status: 400 });
    if (data.rank < 0 || data.minimumValue < 0 || data.damruMultiplier < 1 || data.tierBonusDamru < 0 || !Number.isInteger(data.tierBonusDamru)) return NextResponse.json({ error: "Tier values are invalid." }, { status: 400 });
    await connectDB();
    const active = await LoyaltyTier.find({ isActive: true }).lean();
    const ladderError = data.isActive ? validateLoyaltyLadder([...active, data] as any) : null;
    if (ladderError) return NextResponse.json({ error: ladderError }, { status: 400 });
    const tier = await LoyaltyTier.create(data);
    await logAdminAction("loyalty_tier_create", { targetType: "LoyaltyTier", targetId: String(tier._id) });
    return NextResponse.json({ success: true, tier });
  } catch (err: any) { if (err?.code === 11000) return NextResponse.json({ error: "Tier code and rank must be unique." }, { status: 400 }); console.error(err); return NextResponse.json({ error: "Server error." }, { status: 500 }); }
}
