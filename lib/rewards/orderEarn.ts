/**
 * lib/rewards/orderEarn.ts — the single, pure order-Damru evaluator.
 *
 * Used unchanged by: checkout quote / cart estimate, order placement estimate,
 * the delivered-order award pipeline (lib/rewards/orderEarnings.ts) and the
 * admin rule preview. No client (website or APK) computes Damru itself.
 *
 * Deterministic rules (documented in docs/DAMRU_REWARDS_IMPLEMENTATION_REPORT.md):
 * 1. Base reward: floor(eligible ₹ / orderEarn.rupeesPerDamru), eligible =
 *    merchandise subtotal − coupon (tax, delivery and Damru redemption excluded).
 * 2. Each order line matches at most ONE item-level rule: an ITEM rule for its
 *    dish wins over a CATEGORY rule for its category. Ties → higher
 *    damruPerUnit, then code. Variants/add-ons never change a dish reward.
 * 3. At most ONE order-value tier rule applies (highest resulting Damru, then
 *    code). If it matched a tier and is REPLACE, the base reward is 0.
 * 4. Item, category and tier rewards add to each other; every amount is a
 *    whole number (floored) and each rule's maxDamruPerOrder caps it.
 *    A dish rule of 0 Damru is an explicit "no dish reward" for that dish
 *    (it also blocks a category rule); a dish with no rule earns no dish reward.
 * 4b. orderEarn.dishRewardBaseBehavior decides whether dish/category rewards
 *    ADD to the base order reward or REPLACE it for that order.
 * 5. Campaign bonuses (evaluated separately by campaignEngine) use
 *    `campaignBase` = base + rules flagged includeInCampaignBase.
 */
import type {
  BaseRewardBehavior, EarnRuleBasis, EarnRuleStatus, EarnRuleType, EarnTierMode,
} from "@/models/EarnRule";
import { baseEarnDamru } from "@/lib/rewards/damruValue";
import { toPaise } from "@/lib/checkout/money";

export interface EarnRuleInput {
  id: string;
  code: string;
  name: string;
  version: number;
  ruleType: EarnRuleType;
  status: EarnRuleStatus;
  menuItemIds: string[];
  categoryIds: string[];
  branchIds: string[];
  basis: EarnRuleBasis | null;
  damruPerUnit: number;
  tiers: { minAmount: number; damru: number }[];
  tierMode: EarnTierMode | null;
  baseRewardBehavior: BaseRewardBehavior | null;
  maxDamruPerOrder: number | null;
  includeInCampaignBase: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

export interface EarnOrderLine {
  menuItemId?: string | null;
  categoryId?: string | null;
  /** Display only — copied into the snapshot/breakdown so ledger rows are self-explaining. */
  name?: string | null;
  qty: number;
}

export interface EarnOrderInput {
  items: EarnOrderLine[];
  /** Rupees: merchandise subtotal − coupon discount (Order.eligibleRewardAmount). */
  eligibleAmount: number;
  branchId?: string | null;
}

export interface OrderEarnConfig {
  rupeesPerDamru: number;
  rounding: "FLOOR";
  enabled: boolean;
  /** Absent on evaluations frozen before this setting existed — those always added. */
  dishRewardBaseBehavior?: "ADD" | "REPLACE";
}

export interface EarnRuleLine {
  menuItemId: string | null;
  name: string | null;
  qty: number;
  basis: EarnRuleBasis;
  damruPerUnit: number;
  ruleVersion: number;
  amount: number;
  /** Human-readable, e.g. "50 × 2". */
  calculation: string;
}

export interface AppliedEarnRule {
  kind: EarnRuleType;
  ruleId: string;
  code: string;
  name: string;
  version: number;
  amount: number;
  uncappedAmount: number;
  maxDamruPerOrder: number | null;
  includeInCampaignBase: boolean;
  basis?: EarnRuleBasis;
  damruPerUnit?: number;
  lines?: EarnRuleLine[];
  tierMode?: EarnTierMode;
  baseRewardBehavior?: BaseRewardBehavior;
  tiers?: { minAmount: number; damru: number }[];
  matchedTiers?: { minAmount: number; damru: number; amount: number }[];
}

export interface OrderDamruEvaluation {
  schemaVersion: 1;
  evaluatedAt: string;
  eligiblePaise: number;
  baseReward: {
    amount: number;
    enabled: boolean;
    rupeesPerDamru: number;
    rounding: "FLOOR";
    /** What the base would have been before a REPLACE rule removed it. */
    computedAmount: number;
    replacedByRuleId: string | null;
    replacedBy: "ORDER_VALUE_TIER" | "DISH_REWARDS" | null;
    dishRewardBaseBehavior: "ADD" | "REPLACE";
  };
  itemRewards: AppliedEarnRule[];
  categoryRewards: AppliedEarnRule[];
  orderValueRewards: AppliedEarnRule[];
  /** Damru that campaign multipliers / percent bonuses are applied to. */
  campaignBase: number;
  /** Order-derived Damru before campaigns and daily limits. */
  totalDamru: number;
  appliedRules: { kind: EarnRuleType | "BASE"; ruleId: string | null; code: string; name: string; amount: number }[];
}

const toTime = (value: Date | string | null) => (value === null ? null : new Date(value).getTime());

/** ACTIVE and inside its optional start/end window at `now`. */
export function isEarnRuleLive(rule: Pick<EarnRuleInput, "status" | "startsAt" | "endsAt">, now: Date): boolean {
  if (rule.status !== "ACTIVE") return false;
  const start = toTime(rule.startsAt);
  const end = toTime(rule.endsAt);
  const t = now.getTime();
  return (start === null || start <= t) && (end === null || end > t);
}

export function earnRuleCoversBranch(rule: Pick<EarnRuleInput, "branchIds">, branchId: string | null | undefined): boolean {
  if (rule.branchIds.length === 0) return true;
  return Boolean(branchId) && rule.branchIds.includes(String(branchId));
}

const cap = (amount: number, max: number | null) => (max === null ? amount : Math.min(amount, max));
const sum = (rules: AppliedEarnRule[]) => rules.reduce((s, r) => s + r.amount, 0);

const byStrength = (a: EarnRuleInput, b: EarnRuleInput) => b.damruPerUnit - a.damruPerUnit || a.code.localeCompare(b.code);

function applyLineRule(rule: EarnRuleInput, lines: EarnOrderLine[]): AppliedEarnRule {
  const basis = rule.basis ?? "PER_UNIT";
  const perLine = lines.map((line, index) => {
    let amount = 0;
    let calculation = "";
    if (basis === "PER_UNIT") { amount = rule.damruPerUnit * line.qty; calculation = `${rule.damruPerUnit} × ${line.qty}`; }
    else if (basis === "PER_LINE") { amount = rule.damruPerUnit; calculation = `${rule.damruPerUnit} per line`; }
    else { amount = index === 0 ? rule.damruPerUnit : 0; calculation = index === 0 ? `${rule.damruPerUnit} once per order` : "already counted"; } // PER_ORDER
    return {
      menuItemId: line.menuItemId ? String(line.menuItemId) : null,
      name: line.name ?? null,
      qty: line.qty,
      basis,
      damruPerUnit: rule.damruPerUnit,
      ruleVersion: rule.version,
      amount,
      calculation,
    };
  });
  const uncapped = perLine.reduce((sum, l) => sum + l.amount, 0);
  return {
    kind: rule.ruleType, ruleId: rule.id, code: rule.code, name: rule.name, version: rule.version,
    amount: cap(uncapped, rule.maxDamruPerOrder), uncappedAmount: uncapped,
    maxDamruPerOrder: rule.maxDamruPerOrder, includeInCampaignBase: rule.includeInCampaignBase,
    basis, damruPerUnit: rule.damruPerUnit, lines: perLine,
  };
}

/** Pure tier calculation over whole-rupee thresholds and integer paise. */
export function calculateTierDamru(
  tiersIn: { minAmount: number; damru: number }[],
  mode: EarnTierMode,
  eligiblePaise: number
): { amount: number; matchedTiers: { minAmount: number; damru: number; amount: number }[] } {
  const tiers = [...tiersIn].sort((a, b) => a.minAmount - b.minAmount);
  const reached = tiers.filter(t => t.minAmount * 100 <= eligiblePaise);
  if (reached.length === 0) return { amount: 0, matchedTiers: [] };

  if (mode === "HIGHEST_MATCH") {
    const top = reached[reached.length - 1];
    return { amount: top.damru, matchedTiers: [{ ...top, amount: top.damru }] };
  }
  if (mode === "CUMULATIVE") {
    const matched = reached.map(t => ({ ...t, amount: t.damru }));
    return { amount: matched.reduce((s, t) => s + t.amount, 0), matchedTiers: matched };
  }
  // SLAB: `damru` per ₹100 (10,000 paise) of spend inside each band.
  const matched = reached.map((tier, i) => {
    const lower = tier.minAmount * 100;
    const next = tiers[i + 1];
    const upper = next ? next.minAmount * 100 : Number.POSITIVE_INFINITY;
    const band = Math.max(0, Math.min(eligiblePaise, upper) - lower);
    return { ...tier, amount: Math.floor((band * tier.damru) / 10_000) };
  });
  return { amount: matched.reduce((s, t) => s + t.amount, 0), matchedTiers: matched };
}

function applyTierRule(rule: EarnRuleInput, eligiblePaise: number): AppliedEarnRule {
  const mode = rule.tierMode ?? "HIGHEST_MATCH";
  const { amount: uncapped, matchedTiers } = calculateTierDamru(rule.tiers, mode, eligiblePaise);
  return {
    kind: "ORDER_VALUE_TIER", ruleId: rule.id, code: rule.code, name: rule.name, version: rule.version,
    amount: cap(uncapped, rule.maxDamruPerOrder), uncappedAmount: uncapped,
    maxDamruPerOrder: rule.maxDamruPerOrder, includeInCampaignBase: rule.includeInCampaignBase,
    tierMode: mode, baseRewardBehavior: rule.baseRewardBehavior ?? "ADD",
    tiers: [...rule.tiers].sort((a, b) => a.minAmount - b.minAmount), matchedTiers,
  };
}

export function evaluateOrderDamru(
  order: EarnOrderInput,
  rules: EarnRuleInput[],
  config: OrderEarnConfig,
  now: Date = new Date()
): OrderDamruEvaluation {
  const eligiblePaise = toPaise(Math.max(0, Number(order.eligibleAmount) || 0));
  const live = rules.filter(rule => isEarnRuleLive(rule, now) && earnRuleCoversBranch(rule, order.branchId));

  // ── Item-level rules: one rule per line, ITEM beats CATEGORY ──
  const itemRules = live.filter(r => r.ruleType === "ITEM").sort(byStrength);
  const categoryRules = live.filter(r => r.ruleType === "CATEGORY").sort(byStrength);
  const buckets = new Map<string, { rule: EarnRuleInput; lines: EarnOrderLine[] }>();
  for (const line of order.items) {
    if (!Number.isInteger(line.qty) || line.qty < 1) continue;
    const menuItemId = line.menuItemId ? String(line.menuItemId) : null;
    const categoryId = line.categoryId ? String(line.categoryId) : null;
    const rule = (menuItemId && itemRules.find(r => r.menuItemIds.includes(menuItemId)))
      || (categoryId && categoryRules.find(r => r.categoryIds.includes(categoryId)))
      || null;
    if (!rule) continue;
    const bucket = buckets.get(rule.id) ?? { rule, lines: [] };
    bucket.lines.push(line);
    buckets.set(rule.id, bucket);
  }
  const lineRewards = [...buckets.values()].map(({ rule, lines }) => applyLineRule(rule, lines)).filter(r => r.amount > 0);
  const itemRewards = lineRewards.filter(r => r.kind === "ITEM").sort((a, b) => a.code.localeCompare(b.code));
  const categoryRewards = lineRewards.filter(r => r.kind === "CATEGORY").sort((a, b) => a.code.localeCompare(b.code));

  // ── Order-value tier: at most one rule ──
  const tierCandidates = live
    .filter(r => r.ruleType === "ORDER_VALUE_TIER")
    .map(rule => applyTierRule(rule, eligiblePaise))
    .filter(r => (r.matchedTiers?.length ?? 0) > 0)
    .sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code));
  const tier = tierCandidates[0] ?? null;
  const orderValueRewards = tier ? [tier] : [];

  // ── Base reward ──
  const computedBase = config.enabled ? baseEarnDamru(eligiblePaise, config.rupeesPerDamru) : 0;
  const dishRewardBaseBehavior = config.dishRewardBaseBehavior ?? "ADD";
  const replacedByTier = tier !== null && tier.baseRewardBehavior === "REPLACE";
  const replacedByDish = dishRewardBaseBehavior === "REPLACE" && sum(itemRewards) + sum(categoryRewards) > 0;
  const baseAmount = replacedByTier || replacedByDish ? 0 : computedBase;

  const applied = [...itemRewards, ...categoryRewards, ...orderValueRewards];
  const campaignBase = baseAmount + applied.filter(r => r.includeInCampaignBase).reduce((s, r) => s + r.amount, 0);
  const totalDamru = baseAmount + applied.reduce((s, r) => s + r.amount, 0);

  return {
    schemaVersion: 1,
    evaluatedAt: now.toISOString(),
    eligiblePaise,
    baseReward: {
      amount: baseAmount,
      enabled: config.enabled,
      rupeesPerDamru: config.rupeesPerDamru,
      rounding: config.rounding,
      computedAmount: computedBase,
      replacedByRuleId: replacedByTier ? tier!.ruleId : null,
      replacedBy: replacedByTier ? "ORDER_VALUE_TIER" : replacedByDish ? "DISH_REWARDS" : null,
      dishRewardBaseBehavior,
    },
    itemRewards,
    categoryRewards,
    orderValueRewards,
    campaignBase,
    totalDamru,
    appliedRules: [
      ...(baseAmount > 0 ? [{ kind: "BASE" as const, ruleId: null, code: "BASE", name: "Order reward", amount: baseAmount }] : []),
      ...applied.map(r => ({ kind: r.kind, ruleId: r.ruleId, code: r.code, name: r.name, amount: r.amount })),
    ],
  };
}
