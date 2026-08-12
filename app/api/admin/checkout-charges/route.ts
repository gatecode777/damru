import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import { getCheckoutChargesConfig, validateCheckoutCharges } from "@/lib/checkout/checkoutCharges";
import CheckoutChargesConfig from "@/models/CheckoutChargesConfig";
import CheckoutChargesAudit from "@/models/CheckoutChargesAudit";
import Branch from "@/models/Branch";

export async function GET() {
  const deny = await checkApiPerm("settings", "view");
  if (deny) return deny;
  await connectDB();
  const [config, history, branches] = await Promise.all([
    getCheckoutChargesConfig(),
    CheckoutChargesAudit.find().sort({ createdAt: -1 }).limit(50).lean(),
    Branch.find({ isActive: true }).select("name latitude longitude").sort({ sortOrder: 1 }).lean(),
  ]);
  return NextResponse.json({
    config,
    history: JSON.parse(JSON.stringify(history)),
    branches: JSON.parse(JSON.stringify(branches)),
  });
}

export async function PATCH(req: NextRequest) {
  const deny = await checkApiPerm("settings", "edit");
  if (deny) return deny;
  try {
    const session = await auth();
    const validated = validateCheckoutCharges(await req.json());
    await connectDB();
    const before = await getCheckoutChargesConfig();
    const actorId = (session?.user as { id?: string } | undefined)?.id;
    const updated = await CheckoutChargesConfig.findOneAndUpdate({}, {
      $set: {
        tax: validated.tax,
        delivery: {
          ...validated.delivery,
          branchRules: validated.delivery.branchRules.map(rule => ({ ...rule, branchId: rule.branchId })),
        },
        currency: "INR",
        updatedBy: actorId,
      },
      $setOnInsert: { createdBy: actorId },
    }, { new: true, upsert: true, runValidators: true });

    await CheckoutChargesAudit.create({
      action: "CHECKOUT_CHARGES_UPDATED",
      actorId,
      actorEmail: session?.user?.email || "unknown-admin",
      summary: `Tax ${validated.tax.enabled ? "enabled" : "disabled"}; delivery ${validated.delivery.enabled ? validated.delivery.mode : "disabled"}.`,
      changes: { before: { tax: before.tax, delivery: before.delivery }, after: { tax: validated.tax, delivery: validated.delivery } },
    });

    return NextResponse.json({ success: true, config: { ...validated, id: String(updated._id), version: updated.updatedAt.toISOString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update checkout charges.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
