/**
 * lib/rewards/dishRewards.ts — the admin "Dish Rewards" view: every dish with
 * the custom reward (EarnRule, ruleType ITEM) that currently governs it.
 *
 * There is no separate dish-reward store: a dish's custom reward IS its ITEM
 * EarnRule, so the delivery pipeline, checkout estimate, menu badges and
 * reversals all keep using the single evaluator. `buildDishRewardRows` is pure
 * (unit-tested); `loadDishRewardRows` just feeds it from MongoDB.
 */
import { connectDB } from "@/lib/mongodb";
import EarnRule from "@/models/EarnRule";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import { isEarnRuleLive, type EarnRuleInput } from "@/lib/rewards/orderEarn";
import { toEarnRuleInput } from "@/lib/rewards/earnRules";

export interface DishRewardRule {
  ruleId: string;
  code: string;
  name: string;
  status: EarnRuleInput["status"];
  /** ACTIVE and inside its start/end window right now. */
  live: boolean;
  damruPerUnit: number;
  basis: NonNullable<EarnRuleInput["basis"]>;
  branchIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxDamruPerOrder: number | null;
  version: number;
  /** Other dishes covered by the same rule (0 for a dedicated dish reward). */
  sharedWith: number;
}

export interface DishRewardRow {
  _id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  price: number;
  dishActive: boolean;
  /** The rule that governs this dish's custom reward, or null when none is configured. */
  reward: DishRewardRule | null;
  /** Further non-archived dish rules that also list this dish (normally 0). */
  otherRules: number;
  /** A live category reward the dish falls back to when it has no dish rule of its own. */
  categoryReward: { code: string; damruPerUnit: number; basis: string } | null;
}

export interface DishRewardFilters {
  q?: string;
  categoryId?: string;
  branchId?: string;
  /** active = reward ACTIVE; inactive = a reward exists but isn't ACTIVE. */
  status?: "active" | "inactive";
  configured?: "yes" | "no";
  sort?: "name" | "reward_desc" | "reward_asc";
  page?: number;
  limit?: number;
}

type DishInput = { _id: string; name: string; slug: string; category: string; basePrice: number; isActive: boolean; variantPrices?: number[] };

const statusRank = (r: EarnRuleInput, now: Date) => (isEarnRuleLive(r, now) ? 0 : r.status === "ACTIVE" ? 1 : r.status === "PAUSED" ? 2 : 3);

/** Pure: one row per dish, then filter, sort and paginate. */
export function buildDishRewardRows(
  dishes: DishInput[],
  rules: (EarnRuleInput & { updatedAt?: Date | string })[],
  categoryNames: Map<string, string>,
  filters: DishRewardFilters = {},
  now: Date = new Date()
): { rows: DishRewardRow[]; total: number; page: number; limit: number } {
  const itemRules = rules.filter(r => r.ruleType === "ITEM" && r.status !== "ARCHIVED");
  const liveCategoryRules = rules.filter(r => r.ruleType === "CATEGORY" && isEarnRuleLive(r, now) && r.branchIds.length === 0);

  let rows: DishRewardRow[] = dishes.map(dish => {
    const covering = itemRules
      .filter(r => r.menuItemIds.includes(dish._id))
      .sort((a, b) => statusRank(a, now) - statusRank(b, now) || new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    const governing = covering[0];
    const category = liveCategoryRules.find(r => r.categoryIds.includes(dish.category));
    const variantMin = dish.variantPrices?.filter(p => p > 0) ?? [];
    return {
      _id: dish._id,
      name: dish.name,
      slug: dish.slug,
      categoryId: dish.category,
      categoryName: categoryNames.get(dish.category) ?? "",
      price: dish.basePrice || (variantMin.length ? Math.min(...variantMin) : 0),
      dishActive: dish.isActive,
      reward: governing ? {
        ruleId: governing.id,
        code: governing.code,
        name: governing.name,
        status: governing.status,
        live: isEarnRuleLive(governing, now),
        damruPerUnit: governing.damruPerUnit,
        basis: governing.basis ?? "PER_UNIT",
        branchIds: governing.branchIds,
        startsAt: governing.startsAt ? new Date(governing.startsAt).toISOString() : null,
        endsAt: governing.endsAt ? new Date(governing.endsAt).toISOString() : null,
        maxDamruPerOrder: governing.maxDamruPerOrder,
        version: governing.version,
        sharedWith: governing.menuItemIds.length - 1,
      } : null,
      otherRules: Math.max(0, covering.length - 1),
      categoryReward: category ? { code: category.code, damruPerUnit: category.damruPerUnit, basis: category.basis ?? "PER_UNIT" } : null,
    };
  });

  const q = filters.q?.trim().toLowerCase();
  if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.reward?.code.toLowerCase().includes(q) ?? false));
  if (filters.categoryId) rows = rows.filter(r => r.categoryId === filters.categoryId);
  if (filters.branchId) rows = rows.filter(r => r.reward && (r.reward.branchIds.length === 0 || r.reward.branchIds.includes(filters.branchId!)));
  if (filters.status === "active") rows = rows.filter(r => r.reward?.status === "ACTIVE");
  if (filters.status === "inactive") rows = rows.filter(r => r.reward && r.reward.status !== "ACTIVE");
  if (filters.configured === "yes") rows = rows.filter(r => r.reward !== null);
  if (filters.configured === "no") rows = rows.filter(r => r.reward === null);

  const byName = (a: DishRewardRow, b: DishRewardRow) => a.name.localeCompare(b.name);
  const reward = (r: DishRewardRow) => r.reward?.damruPerUnit ?? -1;
  if (filters.sort === "reward_desc") rows.sort((a, b) => reward(b) - reward(a) || byName(a, b));
  else if (filters.sort === "reward_asc") rows.sort((a, b) => (reward(a) < 0 ? 1 : 0) - (reward(b) < 0 ? 1 : 0) || reward(a) - reward(b) || byName(a, b));
  else rows.sort(byName);

  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 25)));
  const total = rows.length;
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), Math.max(1, Math.ceil(total / limit)));
  return { rows: rows.slice((page - 1) * limit, page * limit), total, page, limit };
}

/** Loads dishes, rules and category names and builds the paginated dish view. */
export async function loadDishRewardRows(filters: DishRewardFilters) {
  await connectDB();
  const [dishes, rules, categories] = await Promise.all([
    MenuItem.find({}).select("name slug category basePrice variants isActive").lean(),
    EarnRule.find({ ruleType: { $in: ["ITEM", "CATEGORY"] }, status: { $ne: "ARCHIVED" } }).lean(),
    Category.find({}).select("name").lean(),
  ]);
  return buildDishRewardRows(
    dishes.map(d => ({
      _id: String(d._id), name: d.name, slug: d.slug || "", category: String(d.category), basePrice: d.basePrice || 0,
      isActive: d.isActive !== false, variantPrices: (d.variants || []).map(v => Number(v.price) || 0),
    })),
    rules.map(r => ({ ...toEarnRuleInput(r as never), updatedAt: (r as { updatedAt?: Date }).updatedAt })),
    new Map(categories.map(c => [String(c._id), (c as { name: string }).name])),
    filters
  );
}
