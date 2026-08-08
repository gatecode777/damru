import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import RewardRule, { RewardRuleCategory } from "@/models/RewardRule";

const DEFAULT_RULES: Record<RewardRuleCategory, { label: string; description: string; amount: number; validForDays: number | null; couponTemplate?: any }> = {
  welcome_registration: {
    label: "Welcome Reward",
    description: "Awarded once when a new user completes registration.",
    amount: 100,
    validForDays: null,
  },
  first_order: {
    label: "First Order Reward",
    description: "Awarded when a user's first order is delivered.",
    amount: 500,
    validForDays: null,
  },
  birthday: {
    label: "Birthday Reward",
    description: "Awarded every year on the user's date of birth.",
    amount: 500,
    validForDays: 15,
    couponTemplate: { type: "percentage", value: 15, maxDiscount: null, minOrderValue: 0 },
  },
  marriage_anniversary: {
    label: "Anniversary Reward",
    description: "Awarded every year on the user's marriage anniversary.",
    amount: 700,
    validForDays: 30,
    couponTemplate: { type: "percentage", value: 20, maxDiscount: null, minOrderValue: 0 },
  },
  account_anniversary: {
    label: "Account Anniversary Reward",
    description: "Awarded every year on the anniversary of account creation. Same flat amount each year (no per-year escalation yet).",
    amount: 200,
    validForDays: null,
  },
};

async function seedDefaults() {
  for (const [category, defaults] of Object.entries(DEFAULT_RULES)) {
    await RewardRule.updateOne(
      { category },
      { $setOnInsert: { category, ...defaults, isActive: true } },
      { upsert: true }
    );
  }
}

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    await seedDefaults();
    const rules = await RewardRule.find().sort({ category: 1 }).lean();
    return NextResponse.json({ rules: JSON.parse(JSON.stringify(rules)) });
  } catch (err) {
    console.error("GET admin/rewards/rules error:", err);
    return NextResponse.json({ rules: [] }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const { id, amount, isActive, validForDays, couponTemplate } = await req.json();
    if (!id) return NextResponse.json({ error: "Rule id is required." }, { status: 400 });
    if (amount !== undefined && (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0)) return NextResponse.json({ error: "Amount must be a non-negative whole number." }, { status: 400 });

    await connectDB();
    const updates: Record<string, unknown> = {};
    if (amount !== undefined) updates.amount = amount;
    if (isActive !== undefined) updates.isActive = isActive;
    if (validForDays !== undefined) updates.validForDays = validForDays;
    if (couponTemplate !== undefined) updates.couponTemplate = couponTemplate;

    const rule = await RewardRule.findByIdAndUpdate(id, updates, { new: true });
    if (!rule) return NextResponse.json({ error: "Rule not found." }, { status: 404 });

    await logAdminAction("reward_rule_update", { targetType: "RewardRule", targetId: id, details: updates });

    return NextResponse.json({ success: true, rule });
  } catch (err) {
    console.error("PUT admin/rewards/rules error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
