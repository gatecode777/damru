/**
 * Server-only helpers shared by the /api/admin/rewards/earn-rules routes
 * (route files may only export HTTP handlers).
 */
import mongoose from "mongoose";
import { auth } from "@/auth";
import AdminUser from "@/models/Admin";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import Branch from "@/models/Branch";
import EarnRule from "@/models/EarnRule";
import { findEarnRuleConflict, toConflictShape, type EarnRuleValues } from "@/lib/rewards/earnRules";

export async function currentAdminId(): Promise<mongoose.Types.ObjectId | null> {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  if (!email) return null;
  const admin = await AdminUser.findOne({ email }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
  return admin?._id ?? null;
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
