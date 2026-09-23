import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import EarnRule, { EARN_RULE_STATUSES, EARN_RULE_TYPES } from "@/models/EarnRule";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import Branch from "@/models/Branch";
import { invalidateEarnRuleCache, validateEarnRule } from "@/lib/rewards/earnRules";
import { auditView, currentAdminId, findActiveConflict, findMissingReferences } from "@/lib/rewards/earnRuleAdmin";

// GET /api/admin/rewards/earn-rules?type=&status=&withOptions=1
export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const filter: Record<string, unknown> = {};
    if (type && (EARN_RULE_TYPES as readonly string[]).includes(type)) filter.ruleType = type;
    if (status && (EARN_RULE_STATUSES as readonly string[]).includes(status)) filter.status = status;

    const [rules, options] = await Promise.all([
      EarnRule.find(filter).sort({ updatedAt: -1 }).limit(500).lean(),
      searchParams.get("withOptions") === "1"
        ? Promise.all([
          MenuItem.find({}).select("name category isActive").sort({ name: 1 }).lean(),
          Category.find({}).select("name").sort({ name: 1 }).lean(),
          Branch.find({}).select("name").sort({ name: 1 }).lean(),
        ]).then(([menuItems, categories, branches]) => ({
          menuItems: menuItems.map(m => ({ _id: String(m._id), name: m.name, category: String(m.category), isActive: m.isActive })),
          categories: categories.map(c => ({ _id: String(c._id), name: (c as { name: string }).name })),
          branches: branches.map(b => ({ _id: String(b._id), name: (b as { name: string }).name })),
        }))
        : Promise.resolve(null),
    ]);
    return NextResponse.json({ rules: JSON.parse(JSON.stringify(rules)), ...(options ? { options } : {}) });
  } catch (err) {
    console.error("GET admin/rewards/earn-rules error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// POST /api/admin/rewards/earn-rules — create (DRAFT by default)
export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "create");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { values, error } = validateEarnRule(body);
    if (error || !values) return NextResponse.json({ error }, { status: 400 });
    if (values.status === "ARCHIVED") return NextResponse.json({ error: "A new rule can't start archived." }, { status: 400 });

    await connectDB();
    const missing = await findMissingReferences(values);
    if (missing) return NextResponse.json({ error: missing }, { status: 400 });
    const conflict = await findActiveConflict(values);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const adminId = (await currentAdminId()) ?? undefined;
    let rule: InstanceType<typeof EarnRule>;
    try {
      rule = await EarnRule.create({ ...values, version: 1, createdBy: adminId, updatedBy: adminId });
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
        return NextResponse.json({ error: `A rule with code ${values.code} already exists.` }, { status: 409 });
      }
      throw err;
    }
    invalidateEarnRuleCache();
    await logAdminAction("earn_rule_created", { targetType: "EarnRule", targetId: String(rule._id), details: { after: auditView({ ...values, version: 1 }) } });
    return NextResponse.json({ rule: JSON.parse(JSON.stringify(rule)) }, { status: 201 });
  } catch (err) {
    console.error("POST admin/rewards/earn-rules error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
