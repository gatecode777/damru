import { NextResponse } from "next/server";
import { getSettings } from "@/lib/getSettings";

/**
 * Read-only, customer-facing checkout preview config. `app/api/orders/route.ts`
 * remains the sole authoritative source for the actual charged total — this
 * only supplies the same tax/delivery inputs so the website and mobile
 * checkout previews stop guessing at hardcoded values that can drift from
 * what admin has configured. Never return SMTP/notification/other internal
 * fields getSettings() also carries.
 */
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    taxRate: settings.taxRate,
    freeDeliveryAbove: settings.freeDeliveryAbove,
    deliveryCharge: settings.deliveryCharge,
  });
}
