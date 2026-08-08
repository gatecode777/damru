import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import LoyaltyTier from "@/models/LoyaltyTier";
import { validateLoyaltyLadder } from "@/lib/loyaltyEngine";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("rewards", "edit"); if (deny) return deny;
  try {
    const { id } = await params; const body = await req.json(); await connectDB();
    const existing = await LoyaltyTier.findById(id).lean(); if (!existing) return NextResponse.json({ error: "Tier not found." }, { status: 404 });
    const updates: any = { ...body };
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase();
    for (const key of ["rank", "minimumValue", "damruMultiplier", "tierBonusDamru"]) if (updates[key] !== undefined) updates[key] = Number(updates[key]);
    if (updates.maximumValue === "" || updates.maximumValue === null) updates.maximumValue = null; else if (updates.maximumValue !== undefined) updates.maximumValue = Number(updates.maximumValue);
    const candidate = { ...existing, ...updates };
    const others = await LoyaltyTier.find({ _id: { $ne: id }, isActive: true }).lean();
    const error = candidate.isActive ? validateLoyaltyLadder([...others, candidate] as any) : null;
    if (error) return NextResponse.json({ error }, { status: 400 });
    const tier = await LoyaltyTier.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    await logAdminAction("loyalty_tier_update", { targetType: "LoyaltyTier", targetId: id, details: updates });
    return NextResponse.json({ success: true, tier });
  } catch (err: any) { if (err?.code === 11000) return NextResponse.json({ error: "Tier code and rank must be unique." }, { status: 400 }); console.error(err); return NextResponse.json({ error: "Server error." }, { status: 500 }); }
}
