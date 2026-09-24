/**
 * Server-only helpers shared by the /api/admin/rewards/earn-rules routes
 * (route files may only export HTTP handlers).
 */
import mongoose from "mongoose";
import { resolveSessionAdmin } from "@/lib/auditLog";
import AdminUser from "@/models/Admin";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import Branch from "@/models/Branch";
import EarnRule from "@/models/EarnRule";
import { findEarnRuleConflict, toConflictShape, type EarnRuleValues } from "@/lib/rewards/earnRules";

export async function currentAdminId(): Promise<mongoose.Types.ObjectId | null> {
  return (await resolveSessionAdmin())?._id ?? null;
}

/** Every referenced dish / category / branch must exist. */
export async function findMissingReferences(values: EarnRuleValues): Promise<string | null> {
  const checks: [string[], (ids: string[]) => Promise<number>, string][] = [
    [values.menuItemIds, ids => MenuItem.countDocuments({ _id: { $in: ids } }), "dishes"],
    [values.categoryIds, ids => Category.countDocuments({ _id: { $in: ids } }), "categories"],
    [values.branchIds, ids => Branch.countDocuments({ _id: { $in: ids } }), "branches"],
  ];
  for (const [ids, count, label] of checks) {
    if (ids.length === 0) continue;
    if ((await count(ids)) !== ids.length) return `Some selected ${label} no longer exist. Refresh and try again.`;
  }
  return null;
}

/** Conflict against every OTHER active rule — only relevant when the result will be ACTIVE. */
export async function findActiveConflict(values: EarnRuleValues, excludeId?: string): Promise<string | null> {
  if (values.status !== "ACTIVE") return null;
  const others = await EarnRule.find({ status: "ACTIVE", ruleType: values.ruleType, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .select("code ruleType menuItemIds categoryIds branchIds startsAt endsAt")
    .lean();
  return findEarnRuleConflict(toConflictShape(values), others.map(o => toConflictShape(o as never)));
}

/** Plain, auditable view of a rule (used for before/after audit details). */
export function auditView(rule: Partial<EarnRuleValues> & { version?: number }) {
  return {
    name: rule.name, code: rule.code, ruleType: rule.ruleType, status: rule.status,
    menuItemIds: rule.menuItemIds?.map(String), categoryIds: rule.categoryIds?.map(String), branchIds: rule.branchIds?.map(String),
    basis: rule.basis, damruPerUnit: rule.damruPerUnit, tiers: rule.tiers, tierMode: rule.tierMode,
    baseRewardBehavior: rule.baseRewardBehavior, maxDamruPerOrder: rule.maxDamruPerOrder,
    includeInCampaignBase: rule.includeInCampaignBase, startsAt: rule.startsAt, endsAt: rule.endsAt, version: rule.version,
  };
}

/**
 * A dedicated dish reward only needs dish + Damru + status: when the admin
 * leaves name/code blank for a single-dish rule, derive them from the dish
 * (name = dish name, code = DISH-<SLUG>, made unique).
 */
export async function fillDishRuleIdentity(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ids = Array.isArray(body.menuItemIds) ? body.menuItemIds.map(String) : [];
  const needsName = typeof body.name !== "string" || !body.name.trim();
  const needsCode = typeof body.code !== "string" || !body.code.trim();
  if (body.ruleType !== "ITEM" || ids.length !== 1 || (!needsName && !needsCode) || !mongoose.isValidObjectId(ids[0])) return body;
  const dish = await MenuItem.findById(ids[0]).select("name slug").lean<{ name: string; slug?: string }>();
  if (!dish) return body;
  const filled: Record<string, unknown> = { ...body };
  if (needsName) filled.name = dish.name.slice(0, 120);
  if (needsCode) {
    const stem = `DISH-${(dish.slug || dish.name).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 34);
    let code = stem;
    for (let n = 2; await EarnRule.exists({ code }); n++) code = `${stem}-${n}`;
    filled.code = code;
  }
  return filled;
}

/**
 * Post-write guard against two admins activating overlapping rules at the same
 * moment (each passed the pre-check before the other saved). Returns the
 * conflict message when this rule must NOT stay active; the caller reverts it.
 * If both racers lose, neither stays active — never two competing rewards.
 */
export async function conflictAfterWrite(values: EarnRuleValues, ruleId: string): Promise<string | null> {
  return findActiveConflict(values, ruleId);
}

export interface RuleVersionEntry {
  action: string;
  at: Date;
  admin: string | null;
  version: number | null;
  status: string | null;
  damruPerUnit: number | null;
  basis: string | null;
  menuItemIds: string[];
  tiers: { minAmount: number; damru: number }[] | null;
}

/** Version history of a rule, read from the admin audit log written on every change. */
export async function getRuleVersionHistory(ruleId: string): Promise<RuleVersionEntry[]> {
  const { default: AdminAuditLog } = await import("@/models/AdminAuditLog");
  const logs = await AdminAuditLog.find({ targetType: "EarnRule", targetId: ruleId }).sort({ createdAt: 1, _id: 1 }).limit(200).lean();
  const adminIds = [...new Set(logs.map(l => String(l.adminId)))];
  const admins = await AdminUser.find({ _id: { $in: adminIds } }).select("name email").lean<{ _id: mongoose.Types.ObjectId; name?: string; email?: string }[]>();
  const adminName = new Map(admins.map(a => [String(a._id), a.name || a.email || null]));
  return logs.map(log => {
    const after = ((log.details as { after?: Record<string, unknown> } | undefined)?.after ?? {}) as Record<string, unknown>;
    return {
      action: log.action,
      at: log.createdAt,
      admin: adminName.get(String(log.adminId)) ?? null,
      version: typeof after.version === "number" ? after.version : null,
      status: typeof after.status === "string" ? after.status : null,
      damruPerUnit: typeof after.damruPerUnit === "number" ? after.damruPerUnit : null,
      basis: typeof after.basis === "string" ? after.basis : null,
      menuItemIds: Array.isArray(after.menuItemIds) ? after.menuItemIds.map(String) : [],
      tiers: Array.isArray(after.tiers) ? after.tiers as { minAmount: number; damru: number }[] : null,
    };
  });
}
