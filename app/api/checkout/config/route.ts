import { NextResponse } from "next/server";
import { getCheckoutChargesConfig } from "@/lib/checkout/checkoutCharges";

/**
 * Read-only, customer-facing checkout preview config. `app/api/orders/route.ts`
 * remains the sole authoritative source for the actual charged total — this
 * only supplies the same tax/delivery inputs so the website and mobile
 * checkout previews stop guessing at hardcoded values that can drift from
 * what admin has configured. Never return SMTP/notification/other internal
 * fields getSettings() also carries.
 */
export async function GET() {
  const settings = await getCheckoutChargesConfig();
  return NextResponse.json({
    currency: settings.currency,
    tax: {
      enabled: settings.tax.enabled,
      label: settings.tax.name,
      calculationType: settings.tax.calculationType,
      rate: settings.tax.calculationType === "PERCENTAGE" ? settings.tax.rate : null,
    },
    delivery: {
      enabled: settings.delivery.enabled,
      mode: settings.delivery.mode,
      freeDeliveryThreshold: settings.delivery.freeDeliveryThreshold,
      minimumOrder: settings.delivery.minimumOrder,
    },
  });
}
