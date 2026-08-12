import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { calculateOrderTotals, getCheckoutChargesConfig } from "@/lib/checkout/checkoutCharges";

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("settings", "view");
  if (deny) return deny;
  try {
    const body = await req.json();
    const config = await getCheckoutChargesConfig();
    const totals = calculateOrderTotals(config, {
      subtotal: Number(body.subtotal),
      couponDiscount: Number(body.couponDiscount || 0),
      damruDiscount: Number(body.damruDiscount || 0),
      orderType: body.orderType === "dine_in" ? "dine_in" : "delivery",
      branchId: body.branchId || undefined,
      distanceKm: body.distanceKm === "" || body.distanceKm == null ? undefined : Number(body.distanceKm),
    });
    return NextResponse.json({ totals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate preview." }, { status: 400 });
  }
}
