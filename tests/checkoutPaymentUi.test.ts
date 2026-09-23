import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const website = readFileSync("app/(website)/checkout/page.tsx", "utf8");
const mobile = readFileSync("mobile-app/src/app/checkout.tsx", "utf8");

test("website checkout exposes only COD and Razorpay payment choices", () => {
  assert.match(website, /useState<"cod" \| "razorpay" \| null>\(null\)/);
  assert.match(website, /Pay Online/);
  assert.doesNotMatch(website, /placeholder="(?:Cardholder Name|Card Number|Exp Date|CVV)"/);
  assert.doesNotMatch(website, /Pay via UPI/);
});

test("mobile checkout delegates all online sub-methods to Razorpay", () => {
  assert.match(mobile, /useState<"razorpay" \| "cod" \| null>\(null\)/);
  assert.match(mobile, /Pay Online with Razorpay/);
  assert.doesNotMatch(mobile, /placeholder="(?:Cardholder Name|Card Number|MM\/YY|CVV|example@upi)"/);
  assert.doesNotMatch(mobile, /StaticAssets\.upiQr/);
});

test("unpaid online checkout reports failed Razorpay attempts for retry", () => {
  assert.match(website, /payments\/razorpay\/fail/);
  assert.match(mobile, /reportRazorpayPaymentFailed/);
});

test("both checkouts send their canonical payment method to the existing order API", () => {
  assert.match(website, /paymentMethod: payMethod/);
  assert.match(mobile, /paymentMethod: payMethod/);
});
