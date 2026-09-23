import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import EarnRule, { EARN_RULE_STATUSES, type EarnRuleStatus } from "@/models/EarnRule";
import { invalidateEarnRuleCache, toEarnRuleInput, validateEarnRule, type EarnRuleValues } from "@/lib/rewards/earnRules";
import { auditView, currentAdminId, findActiveConflict, findMissingReferences } from "@/lib/rewards/earnRuleAdmin";

type Params = { params: Promise<{ id: string }> };

async function loadRule(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return EarnRule.findById(id);
}

function currentValues(rule: InstanceType<typeof EarnRule>): EarnRuleValues {
  const plain = toEarnRuleInput(rule);
  return {
    name: rule.name, code: rule.code, description: rule.description || "", ruleType: plain.ruleType, status: plain.status,
    menuItemIds: plain.menuItemIds, categoryIds: plain.categoryIds, branchIds: plain.branchIds,
    basis: plain.basis, damruPerUnit: plain.damruPerUnit, tiers: plain.tiers, tierMode: plain.tierMode,
    baseRewardBehavior: plain.baseRewardBehavior, maxDamruPerOrder: plain.maxDamruPerOrder,
    includeInCampaignBase: plain.includeInCampaignBase,
    startsAt: rule.startsAt ?? null, endsAt: rule.endsAt ?? null,
  };
}

/**
 * Optimistic-lock save: only applies if nobody else changed the rule since
 * `expectedVersion`, and bumps the version (which every credit snapshots).
 */
async function saveVersioned(id: string, expectedVersion: number, values: EarnRuleValues, action: string, before: EarnRuleValues) {
  const adminId = await currentAdminId();
  const updated = await EarnRule.findOneAndUpdate(
    { _id: id, version: expectedVersion },
    { $set: { ...values, updatedBy: adminId }, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) return NextResponse.json({ error: "This rule was changed by someone else. Reload and try again." }, { status: 409 });
  invalidateEarnRuleCache();
  await logAdminAction(action, {
    targetType: "EarnRule",
    targetId: id,
    details: { before: auditView({ ...before, version: expectedVersion }), after: auditView({ ...values, version: updated.version }) },
  });
  return NextResponse.json({ rule: JSON.parse(JSON.stringify(updated)) });
}

// PUT — edit a rule's configuration (ruleType is fixed after creation).
export async function PUT(req: NextRequest, { params }: Params) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;
  try {
    const { id } = await params;
    const rule = await loadRule(id);
    if (!rule) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    if (rule.status === "ARCHIVED") return NextResponse.json({ error: "Archived rules can't be edited." }, { status: 409 });

    const body = await req.json();
    if (body.ruleType !== undefined && body.ruleType !== rule.ruleType) {
      return NextResponse.json({ error: "A rule's type can't be changed. Create a new rule instead." }, { status: 400 });
    }
    const expectedVersion = typeof body.version === "number" ? body.version : rule.version;
    const before = currentValues(rule);
    const { values, error } = validateEarnRule({ ...before, ...body, ruleType: rule.ruleType, status: body.status ?? rule.status });
    if (error || !values) return NextResponse.json({ error }, { status: 400 });
    if (values.status === "ARCHIVED") return NextResponse.json({ error: "Use Archive to archive a rule." }, { status: 400 });

    const missing = await findMissingReferences(values);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });
    const conflict = await findActiveConflict(values, id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    return saveVersioned(id, expectedVersion, values, "earn_rule_updated", before);
  } catch (err) {
    console.error("PUT admin/rewards/earn-rules/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

const STATUS_ACTIONS: Record<EarnRuleStatus, string> = {
  ACTIVE: "earn_rule_activated", PAUSED: "earn_rule_paused", DRAFT: "earn_rule_updated", ARCHIVED: "earn_rule_archived",
};

// PATCH { status } — activate / pause / archive.
export async function PATCH(req: NextRequest, { params }: Params) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;
  try {
    const { id } = await params;
    const rule = await loadRule(id);
    if (!rule) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    const body = await req.json();
    const status = body.status as EarnRuleStatus;
    if (!(EARN_RULE_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    if (rule.status === "ARCHIVED") return NextResponse.json({ error: "Archived rules can't be changed." }, { status: 409 });
    if (status === rule.status) return NextResponse.json({ rule: JSON.parse(JSON.stringify(rule)) });

    const before = currentValues(rule);
    const values: EarnRuleValues = { ...before, status };
    if (status === "ACTIVE") {
      // Re-validate the whole rule before it can start issuing Damru.
      const check = validateEarnRule({ ...values });
      if (check.error) return NextResponse.json({ error: check.error }, { status: 400 });
      const missing = await findMissingReferences(values);
      if (missing) return NextResponse.json({ error: missing }, { status: 400 });
      const conflict = await findActiveConflict(values, id);
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    }
    const expectedVersion = typeof body.version === "number" ? body.version : rule.version;
    return saveVersioned(id, expectedVersion, values, STATUS_ACTIONS[status], before);
  } catch (err) {
    console.error("PATCH admin/rewards/earn-rules/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// DELETE — soft delete (archive). Ledger rows keep referencing the rule.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const deny = await checkApiPerm("rewards", "delete");
  if (deny) return deny;
  try {
    const { id } = await params;
    const rule = await loadRule(id);
    if (!rule) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    if (rule.status === "ARCHIVED") return NextResponse.json({ success: true });
    const before = currentValues(rule);
    const response = await saveVersioned(id, rule.version, { ...before, status: "ARCHIVED" }, "earn_rule_archived", before);
    return response.status === 200 ? NextResponse.json({ success: true }) : response;
  } catch (err) {
    console.error("DELETE admin/rewards/earn-rules/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
