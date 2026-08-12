import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { isRazorpayConfigured, isRazorpayWebhookConfigured, verifyPaymentSignature, verifyWebhookSignature } from "../lib/payments/razorpay";

// These functions read process.env lazily, at call time — setting these here,
// before any test() body runs, is sufficient without needing a fresh module
// instance per case.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake_key_id";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret_for_regression_only";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_for_regression_only";

test("checkout works with the key pair while webhook delivery is disabled", () => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  assert.equal(isRazorpayConfigured(), true);
  assert.equal(isRazorpayWebhookConfigured(), false);
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
});

/**
 * Regression coverage for the CRITICAL signature rule (integration doc
 * section on Razorpay verification): a payment/webhook signature is only
 * ever trusted after passing HMAC-SHA256 verification against our own
 * secret — never accepted at face value. No live Razorpay API calls.
 */
test("verifyPaymentSignature accepts a correctly-signed order_id|payment_id pair", () => {
  const orderId = "order_test123";
  const paymentId = "pay_test456";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(verifyPaymentSignature(orderId, paymentId, signature), true);
});

test("verifyPaymentSignature rejects a tampered signature", () => {
  const orderId = "order_test123";
  const paymentId = "pay_test456";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Attacker swaps in a different (also validly-formed) payment id after signing.
  assert.equal(verifyPaymentSignature(orderId, "pay_different", signature), false);
});

test("verifyPaymentSignature rejects a signature produced with the wrong secret", () => {
  const orderId = "order_test123";
  const paymentId = "pay_test456";
  const wrongSecretSignature = crypto
    .createHmac("sha256", "not-the-real-secret")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(verifyPaymentSignature(orderId, paymentId, wrongSecretSignature), false);
});

test("verifyWebhookSignature accepts a correctly-signed raw body", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");

  assert.equal(verifyWebhookSignature(body, signature), true);
});

test("verifyWebhookSignature rejects a body that doesn't match the signature", () => {
  const body = JSON.stringify({ event: "payment.captured" });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");

  const tamperedBody = JSON.stringify({ event: "payment.failed" });
  assert.equal(verifyWebhookSignature(tamperedBody, signature), false);
});
