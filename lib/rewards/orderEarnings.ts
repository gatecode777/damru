/**
 * lib/rewards/orderEarnings.ts — connects the pure evaluator
 * (lib/rewards/orderEarn.ts) to the ledger.
 *
 * - estimateOrderDamru(): checkout/cart/order-placement estimate. Read-only.
 * - awardOrderEarnings(): the delivered-order credit. The evaluation is frozen
 *   on the order the first time it runs; every retry reuses it and every
 *   credit has a deterministic idempotency key, so "delivered ×5", admin
 *   toggles or concurrent calls produce exactly one credit per rule.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import DamruTransaction, { type DamruTransactionCategory } from "@/models/DamruTransaction";
import User from "@/models/User";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { getActiveEarnRules } from "@/lib/rewards/earnRules";
import { evaluateOrderDamru, type AppliedEarnRule, type EarnOrderInput, type OrderDamruEvaluation } from "@/lib/rewards/orderEarn";
import { awardDamru, istDateKey } from "@/lib/rewardEngine";
import { estimateCampaignBonuses } from "@/lib/rewards/campaignEngine";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";
import { paymentEligibleOrderFilter } from "@/lib/orders/orderPaymentPolicy";
import { damruToPaise } from "@/lib/rewards/damruValue";
import { fromPaise } from "@/lib/checkout/money";

type ObjectIdLike = string | mongoose.Types.ObjectId;

export interface DamruEstimate {
  isEstimate: true;
  /** Whether this customer can earn at all (guests cannot). */
  eligible: boolean;
  estimatedDamru: number;
  orderDamru: number;
  campaignDamru: number;
  baseDamru: number;
  itemDamru: number;
  categoryDamru: number;
  tierDamru: number;
  appliedRules: { kind: string; ruleId: string | null; code: string; name: string; amount: number }[];
  dailyLimitApplied: boolean;
  paisePerDamru: number;
  estimatedValuePaise: number;
  estimatedValue: number;
  note: string;
}

const sum = (rules: AppliedEarnRule[]) => rules.reduce((s, r) => s + r.amount, 0);

/**
 * Server-side estimate of the Damru an order would earn if delivered now:
 * evaluator + campaign preview + the customer's remaining daily allowance.
 */
export async function estimateOrderDamru(
  input: EarnOrderInput & { userId?: ObjectIdLike | null },
  now: Date = new Date()
): Promise<DamruEstimate> {
  const [config, rules] = await Promise.all([getDamruConfig(), getActiveEarnRules()]);
  const evaluation = evaluateOrderDamru(input, rules, config.orderEarn, now);

  const base: DamruEstimate = {
    isEstimate: true,
    eligible: Boolean(input.userId),
    estimatedDamru: 0,
    orderDamru: evaluation.totalDamru,
    campaignDamru: 0,
    baseDamru: evaluation.baseReward.amount,
    itemDamru: sum(evaluation.itemRewards),
    categoryDamru: sum(evaluation.categoryRewards),
    tierDamru: sum(evaluation.orderValueRewards),
    appliedRules: evaluation.appliedRules,
    dailyLimitApplied: false,
    paisePerDamru: config.paisePerDamru,
    estimatedValuePaise: 0,
    estimatedValue: 0,
    note: "Credited after your order is delivered.",
  };
  if (!input.userId) return { ...base, note: "Log in to earn Damru on this order." };

  let campaignRows: Awaited<ReturnType<typeof estimateCampaignBonuses>> = [];
  if (evaluation.campaignBase > 0 || evaluation.totalDamru > 0) {
    campaignRows = await estimateCampaignBonuses({
      trigger: "ORDER_DELIVERED",
      userId: input.userId,
      sourceId: "estimate",
      baseReward: evaluation.campaignBase,
      eligibleAmount: input.eligibleAmount,
      branchId: input.branchId ?? null,
      categoryIds: input.items.map(i => i.categoryId).filter(Boolean) as string[],
      menuItemIds: input.items.map(i => i.menuItemId).filter(Boolean) as string[],
      now,
    }).catch(() => []);
  }
  const campaignDamru = campaignRows.reduce((s, r) => s + r.amount, 0);
  let estimatedDamru = evaluation.totalDamru + campaignDamru;

  let dailyLimitApplied = false;
  if (config.dailyEarnLimit !== null) {
    const user = await User.findById(input.userId).select("dailyEarnDate dailyEarnAmount").lean<{ dailyEarnDate?: string | null; dailyEarnAmount?: number }>();
    const used = user?.dailyEarnDate === istDateKey(now) ? user?.dailyEarnAmount || 0 : 0;
    const remaining = Math.max(0, config.dailyEarnLimit - used);
    if (estimatedDamru > remaining) { estimatedDamru = remaining; dailyLimitApplied = true; }
  }

  const estimatedValuePaise = damruToPaise(estimatedDamru, config.paisePerDamru);
  return {
    ...base,
    estimatedDamru,
    campaignDamru,
    appliedRules: [
      ...evaluation.appliedRules,
      ...campaignRows.map(r => ({ kind: "CAMPAIGN", ruleId: r.campaignId, code: r.code, name: r.name, amount: r.amount })),
    ],
    dailyLimitApplied,
    estimatedValuePaise,
    estimatedValue: fromPaise(estimatedValuePaise),
  };
}

interface CreditPlan {
  category: DamruTransactionCategory;
  idempotencyKey: string;
  amount: number;
  description: string;
  earnRuleId?: string;
  ruleSnapshot: Record<string, unknown>;
}

function planCredits(orderObjectId: string, orderNumber: string, evaluation: OrderDamruEvaluation): CreditPlan[] {
  const common = { eligiblePaise: evaluation.eligiblePaise, evaluatedAt: evaluation.evaluatedAt };
  const plans: CreditPlan[] = [];
  if (evaluation.baseReward.amount > 0) {
    plans.push({
      category: "order_reward",
      idempotencyKey: `order_reward:${orderObjectId}`,
      amount: evaluation.baseReward.amount,
      description: `Order reward for ${orderNumber}`,
      ruleSnapshot: { kind: "BASE", rupeesPerDamru: evaluation.baseReward.rupeesPerDamru, rounding: evaluation.baseReward.rounding, ...common },
    });
  }
  const ruleCredits: [AppliedEarnRule[], DamruTransactionCategory, string][] = [
    [evaluation.itemRewards, "item_reward", "item_reward"],
    [evaluation.categoryRewards, "category_reward", "category_reward"],
    [evaluation.orderValueRewards, "tier_reward", "tier_reward"],
  ];
  for (const [rules, category, prefix] of ruleCredits) {
    for (const rule of rules) {
      if (rule.amount <= 0) continue;
      plans.push({
        category,
        idempotencyKey: `${prefix}:${orderObjectId}:${rule.ruleId}`,
        amount: rule.amount,
        description: `${rule.name} — order ${orderNumber}`,
        earnRuleId: rule.ruleId,
        ruleSnapshot: { ...rule, ...common },
      });
    }
  }
  return plans;
}

export interface OrderEarningsResult {
  skipped?: "NOT_ELIGIBLE" | "LEGACY";
  evaluation?: OrderDamruEvaluation;
  /** Damru newly credited by THIS call (0 on a replay). */
  credited: number;
  /** Damru that campaign multipliers/percent bonuses apply to. */
  campaignBase: number;
}

/** Credits every order-derived Damru for a delivered, payment-eligible order. Safe to call any number of times. */
export async function awardOrderEarnings(orderId: ObjectIdLike): Promise<OrderEarningsResult> {
  await connectDB();
  const order = await Order.findOne({ _id: orderId, status: "delivered", ...paymentEligibleOrderFilter() })
    .select("_id orderId userId items eligibleRewardAmount subtotal discount branchId rewardEvaluation")
    .lean();
  if (!order || !order.userId) return { skipped: "NOT_ELIGIBLE", credited: 0, campaignBase: 0 };
  const orderObjectId = String(order._id);

  let evaluation = order.rewardEvaluation as unknown as OrderDamruEvaluation | undefined;
  if (!evaluation) {
    // Delivered before earn rules existed: the base reward was already
    // credited under the old rule. Never re-evaluate such an order — that
    // would retroactively apply today's rules to a past order.
    const legacy = await DamruTransaction.findOne({ idempotencyKey: `order_reward:${orderObjectId}` }).select("amount").lean<{ amount: number }>();
    if (legacy) {
      // A concurrent call may have frozen an evaluation (and credited) since we read the order.
      const stored = await Order.findById(order._id).select("rewardEvaluation").lean();
      if (!stored?.rewardEvaluation) return { skipped: "LEGACY", credited: 0, campaignBase: legacy.amount };
      evaluation = stored.rewardEvaluation as unknown as OrderDamruEvaluation;
    }
  }
  if (!evaluation) {
    const [config, rules] = await Promise.all([getDamruConfig(), getActiveEarnRules()]);
    const fresh = evaluateOrderDamru({
      items: order.items.map(i => ({ menuItemId: i.menuItemId ? String(i.menuItemId) : null, categoryId: i.categoryId ? String(i.categoryId) : null, qty: i.qty })),
      eligibleAmount: order.eligibleRewardAmount ?? Math.max(0, order.subtotal - order.discount),
      branchId: order.branchId ? String(order.branchId) : null,
    }, rules, config.orderEarn, new Date());
    const claimed = await Order.updateOne(
      { _id: order._id, rewardEvaluation: { $exists: false } },
      { $set: { rewardEvaluation: fresh, rewardEvaluatedAt: new Date() } }
    );
    if (claimed.modifiedCount === 1) {
      evaluation = fresh;
    } else {
      const stored = await Order.findById(order._id).select("rewardEvaluation").lean();
      evaluation = stored?.rewardEvaluation as unknown as OrderDamruEvaluation;
    }
  }

  let credited = 0;
  const failures: unknown[] = [];
  for (const plan of planCredits(orderObjectId, order.orderId, evaluation)) {
    try {
      const result = await awardDamru({
        userId: order.userId,
        category: plan.category,
        amount: plan.amount,
        description: plan.description,
        idempotencyKey: plan.idempotencyKey,
        orderId: order._id,
        earnRuleId: plan.earnRuleId,
        ruleSnapshot: plan.ruleSnapshot,
        suppressNotification: true,
      });
      if (!result.duplicate && "transaction" in result && result.transaction) credited += result.transaction.amount;
    } catch (err) {
      failures.push(err);
    }
  }

  if (credited > 0) {
    // One notification per order instead of one per rule.
    await notifyRewardEvent({
      userId: order.userId,
      type: "DAMRU_CREDITED",
      sourceId: order._id,
      sourceType: "Order",
      amount: credited,
      orderNumber: order.orderId,
      description: `Damru earned on order ${order.orderId}`,
      route: "/my-profile?tab=rewards",
    });
  }

  if (failures.length > 0) {
    // Every other credit above was still attempted; re-running is safe.
    throw new AggregateError(failures, `Some Damru credits for order ${order.orderId} failed; re-run is safe.`);
  }
  return { evaluation, credited, campaignBase: evaluation.campaignBase };
}
