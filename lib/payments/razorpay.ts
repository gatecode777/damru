import Razorpay from "razorpay";
import { validatePaymentVerification, validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";

/**
 * Server-only Razorpay integration point — only ever imported from Route
 * Handlers (which the App Router already keeps out of client bundles).
 * Key Secret and Webhook Secret are read from process.env lazily, inside
 * function bodies, and never leave this module.
 */

let client: Razorpay | null = null;

function requireEnv(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET" | "RAZORPAY_WEBHOOK_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Razorpay is not configured: ${name} is not set.`);
  }
  return value;
}

/** Lazy singleton — constructed on first real use, never at module import time. */
export function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: requireEnv("RAZORPAY_KEY_ID"),
      key_secret: requireEnv("RAZORPAY_KEY_SECRET"),
    });
  }
  return client;
}

/** True only when all three Razorpay env vars are present — used to decide
 *  whether online payment is offered at all, without throwing. */
export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Webhook delivery is optional and independently enabled. */
export function isRazorpayWebhookConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

/** The only Key ID value ever allowed to reach the client — never the secret. */
export function getRazorpayPublicKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}

/**
 * Rupees → paise, the subunit Razorpay's API requires. Centralized so no
 * route/component scatters its own `amount * 100`.
 */
export function toRazorpayAmount(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error(`Invalid amount for Razorpay: ${rupees}`);
  }
  return Math.round(rupees * 100);
}

/**
 * Verifies a Checkout success callback's signature using the SERVER-STORED
 * Razorpay order id — never the one supplied by the client. Returns false
 * (never throws) on a bad signature so callers can respond 400 uniformly.
 */
export function verifyPaymentSignature(serverRazorpayOrderId: string, paymentId: string, signature: string): boolean {
  try {
    return validatePaymentVerification(
      { order_id: serverRazorpayOrderId, payment_id: paymentId },
      signature,
      requireEnv("RAZORPAY_KEY_SECRET")
    );
  } catch {
    return false;
  }
}

/** Verifies a webhook's signature against the RAW request body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  try {
    return validateWebhookSignature(rawBody, signature, requireEnv("RAZORPAY_WEBHOOK_SECRET"));
  } catch {
    return false;
  }
}
