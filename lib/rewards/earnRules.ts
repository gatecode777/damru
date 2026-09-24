/**
 * lib/rewards/earnRules.ts — EarnRule loading, validation and menu badges.
 * Validation/conflict helpers are pure (unit-tested); loaders are cached.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import EarnRule, {
  BASE_REWARD_BEHAVIORS, DEFAULT_ITEM_REWARD_BASIS, EARN_RULE_BASES, EARN_RULE_STATUSES, EARN_RULE_TYPES, EARN_TIER_MODES,
  type BaseRewardBehavior, type EarnRuleBasis, type EarnRuleStatus, type EarnRuleType, type EarnTierMode, type IEarnRule,
} from "@/models/EarnRule";
import { isEarnRuleLive, type EarnRuleInput } from "@/lib/rewards/orderEarn";

// ── Serialisation ────────────────────────────────────────────

type EarnRuleLike = Pick<IEarnRule, "code" | "name" | "version" | "ruleType" | "status" | "menuItemIds" | "categoryIds" | "branchIds" | "basis" | "damruPerUnit" | "tiers" | "tierMode" | "baseRewardBehavior" | "maxDamruPerOrder" | "includeInCampaignBase" | "startsAt" | "endsAt"> & { _id: unknown };

export function toEarnRuleInput(doc: EarnRuleLike): EarnRuleInput {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    version: doc.version ?? 1,
    ruleType: doc.ruleType,
    status: doc.status,
    menuItemIds: (doc.menuItemIds || []).map(String),
    categoryIds: (doc.categoryIds || []).map(String),
    branchIds: (doc.branchIds || []).map(String),
    basis: doc.basis ?? null,
    damruPerUnit: doc.damruPerUnit ?? 0,
    tiers: (doc.tiers || []).map(t => ({ minAmount: t.minAmount, damru: t.damru })),
    tierMode: doc.tierMode ?? null,
    baseRewardBehavior: doc.baseRewardBehavior ?? null,
    maxDamruPerOrder: doc.maxDamruPerOrder ?? null,
    includeInCampaignBase: Boolean(doc.includeInCampaignBase),
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
  };
}

// ── Cached loader (ACTIVE rules only) ────────────────────────

const CACHE_TTL_MS = 30_000;
let cachedRules: EarnRuleInput[] | null = null;
let cacheExpiry = 0;

export function invalidateEarnRuleCache() {
  cachedRules = null;
  cacheExpiry = 0;
}

/** ACTIVE rules (window filtering happens per evaluation, against its own `now`). */
export async function getActiveEarnRules(): Promise<EarnRuleInput[]> {
  const now = Date.now();
  if (cachedRules && now < cacheExpiry) return cachedRules;
  await connectDB();
  const docs = await EarnRule.find({ status: "ACTIVE" }).lean<EarnRuleLike[]>();
  cachedRules = docs.map(toEarnRuleInput);
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedRules;
}

// ── Menu badges ──────────────────────────────────────────────

export interface RewardBadge {
  damru: number;
  basis: EarnRuleBasis;
  /** Server-authored display text so website and APK always show the same words. */
  label: string;
  /** Compact form for small cards (APK): "+50 Damru". */
  shortLabel: string;
  /** Dish-detail / options view wording. */
  detailLabel: string;
}

/** Card wording: per-unit rewards say "per item" so quantity is never ambiguous. */
export function badgeLabel(damru: number, basis: EarnRuleBasis): string {
  return basis === "PER_UNIT" ? `Earn ${damru} Damru per item` : `Earn ${damru} Damru`;
}

export function badgeDetailLabel(damru: number, basis: EarnRuleBasis): string {
  return basis === "PER_UNIT" ? `Earn ${damru} Damru per item` : `Earn ${damru} Damru on this dish`;
}

export function toRewardBadge(damru: number, basis: EarnRuleBasis): RewardBadge {
  return { damru, basis, label: badgeLabel(damru, basis), shortLabel: `+${damru} Damru`, detailLabel: badgeDetailLabel(damru, basis) };
}

/**
 * Badge per menu item from live ITEM/CATEGORY rules. Branch-restricted rules
 * are excluded — the menu doesn't know the customer's branch, and a badge
 * must never promise a reward that might not apply. Checkout shows the exact,
 * branch-aware estimate.
 */
export function buildRewardBadges(
  rules: EarnRuleInput[],
  items: { _id: string; category: string }[],
  now: Date = new Date()
): Map<string, RewardBadge> {
  // 0-Damru dish rules stay in the lookup: they are an explicit "no dish reward"
  // and must hide a category badge for that dish, exactly like the evaluator.
  const live = rules.filter(r => isEarnRuleLive(r, now) && r.branchIds.length === 0 && (r.ruleType === "ITEM" || r.damruPerUnit > 0));
  const strength = (a: EarnRuleInput, b: EarnRuleInput) => b.damruPerUnit - a.damruPerUnit || a.code.localeCompare(b.code);
  const itemRules = live.filter(r => r.ruleType === "ITEM").sort(strength);
  const categoryRules = live.filter(r => r.ruleType === "CATEGORY").sort(strength);
  const badges = new Map<string, RewardBadge>();
  for (const item of items) {
    const rule = itemRules.find(r => r.menuItemIds.includes(item._id)) || categoryRules.find(r => r.categoryIds.includes(item.category));
    if (!rule || rule.damruPerUnit <= 0) continue;
    badges.set(item._id, toRewardBadge(rule.damruPerUnit, rule.basis ?? DEFAULT_ITEM_REWARD_BASIS));
  }
  return badges;
}

export async function getRewardBadges(items: { _id: string; category: string }[]): Promise<Map<string, RewardBadge>> {
  try {
    return buildRewardBadges(await getActiveEarnRules(), items);
  } catch (err) {
    // A badge is decoration — never fail the menu because rules couldn't load.
    console.error("[earnRules] reward badges unavailable:", err);
    return new Map();
  }
}

// ── Validation (pure) ────────────────────────────────────────

export interface EarnRuleValues {
  name: string;
  code: string;
  description: string;
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
  startsAt: Date | null;
  endsAt: Date | null;
}

const MAX_DAMRU = 1_000_000;
const MAX_RUPEES = 10_000_000;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => typeof v === "string" && (options as readonly string[]).includes(v);

function idList(v: unknown, label: string): { ids: string[]; error?: string } {
  if (v === undefined || v === null) return { ids: [] };
  if (!Array.isArray(v)) return { ids: [], error: `${label} must be a list.` };
  const ids = [...new Set(v.map(String))];
  if (ids.some(id => !mongoose.isValidObjectId(id))) return { ids: [], error: `${label} contains an invalid id.` };
  return { ids };
}

function dateOrNull(v: unknown, label: string): { date: Date | null; error?: string } {
  if (v === undefined || v === null || v === "") return { date: null };
  const date = new Date(v as string);
  return Number.isNaN(date.getTime()) ? { date: null, error: `${label} is not a valid date.` } : { date };
}

/**
 * Validates a full rule (create) or a merged rule (existing values + patch).
 * Returns normalised values or the first error. Never trusts client types.
 */
export function validateEarnRule(input: Record<string, unknown>): { values?: EarnRuleValues; error?: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return { error: "Rule name is required (max 120 characters)." };
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return { error: "Rule code must be 2–40 letters, numbers, dashes or underscores." };
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 500) : "";
  if (!oneOf(input.ruleType, EARN_RULE_TYPES)) return { error: "Choose a valid rule type." };
  const ruleType = input.ruleType;
  const status = input.status === undefined ? "DRAFT" : input.status;
  if (!oneOf(status, EARN_RULE_STATUSES)) return { error: "Choose a valid status." };

  const menu = idList(input.menuItemIds, "Dishes"); if (menu.error) return { error: menu.error };
  const cats = idList(input.categoryIds, "Categories"); if (cats.error) return { error: cats.error };
  const branches = idList(input.branchIds, "Branches"); if (branches.error) return { error: branches.error };

  const maxDamruPerOrder = input.maxDamruPerOrder === undefined || input.maxDamruPerOrder === null || input.maxDamruPerOrder === "" ? null : input.maxDamruPerOrder;
  if (maxDamruPerOrder !== null && !isInt(maxDamruPerOrder, 1, MAX_DAMRU)) return { error: "Maximum Damru per order must be a whole number of at least 1 (or empty for no cap)." };

  const starts = dateOrNull(input.startsAt, "Start date"); if (starts.error) return { error: starts.error };
  const ends = dateOrNull(input.endsAt, "End date"); if (ends.error) return { error: ends.error };
  if (starts.date && ends.date && starts.date >= ends.date) return { error: "End date must be after the start date." };

  const values: EarnRuleValues = {
    name, code, description, ruleType, status,
    menuItemIds: [], categoryIds: [], branchIds: branches.ids,
    basis: null, damruPerUnit: 0, tiers: [], tierMode: null, baseRewardBehavior: null,
    maxDamruPerOrder: maxDamruPerOrder as number | null,
    includeInCampaignBase: input.includeInCampaignBase === true,
    startsAt: starts.date, endsAt: ends.date,
  };

  if (ruleType === "ITEM" || ruleType === "CATEGORY") {
    const ids = ruleType === "ITEM" ? menu.ids : cats.ids;
    if (ids.length === 0) return { error: ruleType === "ITEM" ? "Select at least one dish." : "Select at least one category." };
    // Dish rewards default to per unit when the admin doesn't pick a basis.
    const basis = input.basis === undefined || input.basis === null || input.basis === "" ? (ruleType === "ITEM" ? DEFAULT_ITEM_REWARD_BASIS : undefined) : input.basis;
    if (!oneOf(basis, EARN_RULE_BASES)) return { error: "Choose how the reward counts: per unit, per line, or per order." };
    // A dish may be set to 0 Damru (explicitly no dish reward, also overriding its
    // category's reward); a category rule of 0 would do nothing, so it needs ≥ 1.
    const minDamru = ruleType === "ITEM" ? 0 : 1;
    if (!isInt(input.damruPerUnit, minDamru, MAX_DAMRU)) return { error: `Damru reward must be a whole number of at least ${minDamru}.` };
    if (ruleType === "ITEM") values.menuItemIds = ids; else values.categoryIds = ids;
    values.basis = basis;
    values.damruPerUnit = input.damruPerUnit;
    return { values };
  }

  // ORDER_VALUE_TIER
  if (!oneOf(input.tierMode, EARN_TIER_MODES)) return { error: "Choose a tier mode: highest match, cumulative, or slab." };
  if (!oneOf(input.baseRewardBehavior, BASE_REWARD_BEHAVIORS)) return { error: "Choose whether tiers add to or replace the base order reward." };
  if (!Array.isArray(input.tiers) || input.tiers.length === 0) return { error: "Add at least one tier." };
  if (input.tiers.length > 20) return { error: "A rule can have at most 20 tiers." };
  const tiers: { minAmount: number; damru: number }[] = [];
  for (const [i, raw] of (input.tiers as unknown[]).entries()) {
    const t = (raw ?? {}) as Record<string, unknown>;
    if (!isInt(t.minAmount, 1, MAX_RUPEES)) return { error: `Tier ${i + 1}: minimum bill must be a whole rupee amount of at least ₹1.` };
    if (!isInt(t.damru, 0, MAX_DAMRU)) return { error: `Tier ${i + 1}: Damru must be a whole number, 0 or more.` };
    tiers.push({ minAmount: t.minAmount, damru: t.damru });
  }
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].minAmount === tiers[i - 1].minAmount) return { error: `Two tiers use the same minimum bill (₹${tiers[i].minAmount}).` };
    if (tiers[i].minAmount < tiers[i - 1].minAmount) return { error: "Tiers must be sorted by minimum bill, lowest first." };
  }
  if (!tiers.some(t => t.damru > 0)) return { error: "At least one tier must award Damru." };
  values.tiers = tiers;
  values.tierMode = input.tierMode;
  values.baseRewardBehavior = input.baseRewardBehavior;
  return { values };
}

// ── Conflicts (pure) ─────────────────────────────────────────

type ConflictShape = Pick<EarnRuleValues, "ruleType" | "menuItemIds" | "categoryIds" | "branchIds" | "startsAt" | "endsAt"> & { code: string };

function windowsOverlap(a: ConflictShape, b: ConflictShape) {
  const aStart = a.startsAt ? a.startsAt.getTime() : -Infinity;
  const aEnd = a.endsAt ? a.endsAt.getTime() : Infinity;
  const bStart = b.startsAt ? b.startsAt.getTime() : -Infinity;
  const bEnd = b.endsAt ? b.endsAt.getTime() : Infinity;
  return aStart < bEnd && bStart < aEnd;
}

function branchesOverlap(a: ConflictShape, b: ConflictShape) {
  if (a.branchIds.length === 0 || b.branchIds.length === 0) return true;
  return a.branchIds.some(id => b.branchIds.includes(id));
}

/**
 * Returns a human-readable conflict when `candidate` would be ACTIVE at the
 * same time, branch and target as another ACTIVE rule — so the evaluator
 * never has to pick between two admin intents silently.
 */
export function findEarnRuleConflict(candidate: ConflictShape, activeOthers: ConflictShape[]): string | null {
  for (const other of activeOthers) {
    if (other.ruleType !== candidate.ruleType) continue;
    if (!windowsOverlap(candidate, other) || !branchesOverlap(candidate, other)) continue;
    if (candidate.ruleType === "ORDER_VALUE_TIER") {
      return `Order-value rule ${other.code} is already active for an overlapping branch and period. Pause it first.`;
    }
    const field = candidate.ruleType === "ITEM" ? "menuItemIds" : "categoryIds";
    const shared = candidate[field].filter(id => other[field].includes(id));
    if (shared.length > 0) {
      return `Rule ${other.code} already rewards ${shared.length === 1 ? "one of these" : `${shared.length} of these`} ${candidate.ruleType === "ITEM" ? "dishes" : "categories"} for an overlapping branch and period.`;
    }
  }
  return null;
}

export function toConflictShape(doc: EarnRuleLike | EarnRuleValues): ConflictShape {
  return {
    code: doc.code,
    ruleType: doc.ruleType,
    menuItemIds: (doc.menuItemIds || []).map(String),
    categoryIds: (doc.categoryIds || []).map(String),
    branchIds: (doc.branchIds || []).map(String),
    startsAt: doc.startsAt ? new Date(doc.startsAt) : null,
    endsAt: doc.endsAt ? new Date(doc.endsAt) : null,
  };
}

