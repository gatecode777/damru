import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import MenuItem from "@/models/MenuItem";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { getActiveEarnRules, validateEarnRule } from "@/lib/rewards/earnRules";
import { evaluateOrderDamru, type EarnRuleInput } from "@/lib/rewards/orderEarn";
import { damruToPaise } from "@/lib/rewards/damruValue";
import { fromPaise } from "@/lib/checkout/money";

/**
 * POST /api/admin/rewards/earn-rules/preview
 * Body: { rule?: <draft rule>, ruleId?: string, orderValue: number (₹), items?: [{ menuItemId, qty }], branchId? }
 *
 * Runs the SAME evaluator used at checkout and delivery against the active
 * rules plus the draft (treated as active now), so an admin sees exactly what
 * an order would earn before activating. Nothing is written. Campaign bonuses
 * and daily limits are customer-specific and are not included.
 */
export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const body = await req.json();
    const orderValue = Number(body.orderValue);
    if (!Number.isFinite(orderValue) || orderValue < 0 || orderValue > 10_000_000) {
      return NextResponse.json({ error: "Enter a sample order value in rupees." }, { status: 400 });
    }

    let draft: EarnRuleInput | null = null;
    if (body.rule) {
      const { values, error } = validateEarnRule({ ...body.rule, status: "ACTIVE" });
      if (error || !values) return NextResponse.json({ error }, { status: 400 });
      draft = {
        ...values,
        id: typeof body.ruleId === "string" && body.ruleId ? body.ruleId : "draft",
        version: 0,
        status: "ACTIVE",
        // Preview the rule as if live right now, regardless of its schedule.
        startsAt: null,
        endsAt: null,
      };
    }

    await connectDB();
    const rawItems: { menuItemId?: unknown; qty?: unknown }[] = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    const ids = rawItems.map(i => String(i.menuItemId || "")).filter(id => mongoose.isValidObjectId(id));
    const menuItems = ids.length ? await MenuItem.find({ _id: { $in: ids } }).select("category").lean() : [];
    const categoryOf = new Map(menuItems.map(m => [String(m._id), String(m.category)]));
    const items = rawItems
      .map(i => ({ menuItemId: String(i.menuItemId || ""), categoryId: categoryOf.get(String(i.menuItemId || "")) ?? null, qty: Number(i.qty) }))
      .filter(i => categoryOf.has(i.menuItemId) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99);

    const [config, active] = await Promise.all([getDamruConfig(), getActiveEarnRules()]);
    const rules = draft ? [...active.filter(r => r.id !== draft!.id), draft] : active;
    const evaluation = evaluateOrderDamru(
      { items, eligibleAmount: orderValue, branchId: typeof body.branchId === "string" && body.branchId ? body.branchId : null },
      rules,
      config.orderEarn
    );
    const valuePaise = damruToPaise(evaluation.totalDamru, config.paisePerDamru);
    return NextResponse.json({ evaluation, totalValue: fromPaise(valuePaise), paisePerDamru: config.paisePerDamru });
  } catch (err) {
    console.error("POST admin/rewards/earn-rules/preview error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
