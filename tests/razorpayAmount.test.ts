import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { toRazorpayAmount } from "../lib/payments/razorpay";

test("converts rupees to paise", () => {
  assert.equal(toRazorpayAmount(950), 95000);
  assert.equal(toRazorpayAmount(1), 100);
  assert.equal(toRazorpayAmount(0), 0);
});

test("rounds to the nearest paisa for fractional rupee input", () => {
  assert.equal(toRazorpayAmount(9.999), 1000);
  assert.equal(toRazorpayAmount(9.001), 900);
});

test("rejects negative amounts", () => {
  assert.throws(() => toRazorpayAmount(-1), /Invalid amount/);
});

test("rejects non-finite amounts", () => {
  assert.throws(() => toRazorpayAmount(NaN), /Invalid amount/);
  assert.throws(() => toRazorpayAmount(Infinity), /Invalid amount/);
});
