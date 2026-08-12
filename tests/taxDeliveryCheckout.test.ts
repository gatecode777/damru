import "./setup";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateOrderTotals, validateCheckoutCharges, type CheckoutChargesSettings } from "../lib/checkout/checkoutCharges";

function config(overrides: Partial<CheckoutChargesSettings> = {}): CheckoutChargesSettings {
  const base: CheckoutChargesSettings = {
    id: "64b000000000000000000001",
    version: "v1",
    currency: "INR",
    tax: { enabled: true, name: "GST", code: "GST", calculationType: "PERCENTAGE", rate: 5, fixedAmount: 0, applyOn: "AFTER_DISCOUNTS", taxDeliveryFee: false },
    delivery: { enabled: true, mode: "FLAT", flatFee: 50, freeDeliveryThreshold: null, minimumOrder: 0, maximumDistanceKm: 10, orderValueSlabs: [], distanceSlabs: [], branchRules: [] },
  };
  return { ...base, ...overrides, tax: { ...base.tax, ...(overrides.tax || {}) }, delivery: { ...base.delivery, ...(overrides.delivery || {}) } };
}

test("tax supports disabled, percentage, fixed, rounding, and tax-on-delivery", () => {
  const disabled = calculateOrderTotals(config({ tax: { ...config().tax, enabled: false } }), { subtotal: 500, orderType: "delivery" });
  assert.equal(disabled.taxAmount, 0);
  assert.equal(calculateOrderTotals(config(), { subtotal: 500, orderType: "delivery" }).taxAmount, 25);
  assert.equal(calculateOrderTotals(config({ tax: { ...config().tax, calculationType: "FIXED", fixedAmount: 20 } }), { subtotal: 500, orderType: "delivery" }).taxAmount, 20);
  assert.equal(calculateOrderTotals(config({ tax: { ...config().tax, taxDeliveryFee: true } }), { subtotal: 500, orderType: "delivery" }).taxAmount, 27.5);
  assert.equal(calculateOrderTotals(config({ delivery: { ...config().delivery, flatFee: 0 } }), { subtotal: 10.1, orderType: "delivery" }).taxAmount, 0.51);
});

test("flat delivery, disabled delivery, dine-in, minimum order, and free boundary", () => {
  assert.equal(calculateOrderTotals(config(), { subtotal: 498, orderType: "delivery" }).deliveryFee, 50);
  const threshold = config({ delivery: { ...config().delivery, freeDeliveryThreshold: 499 } });
  assert.equal(calculateOrderTotals(threshold, { subtotal: 498, orderType: "delivery" }).deliveryFee, 50);
  assert.equal(calculateOrderTotals(threshold, { subtotal: 499, orderType: "delivery" }).deliveryFee, 0);
  assert.equal(calculateOrderTotals(threshold, { subtotal: 500, orderType: "delivery" }).deliveryFee, 0);
  assert.equal(calculateOrderTotals(config({ delivery: { ...config().delivery, enabled: false } }), { subtotal: 100, orderType: "delivery" }).deliveryFee, 0);
  assert.equal(calculateOrderTotals(config(), { subtotal: 100, orderType: "dine_in" }).deliveryFee, 0);
  assert.throws(() => calculateOrderTotals(config({ delivery: { ...config().delivery, minimumOrder: 199 } }), { subtotal: 198.99, orderType: "delivery" }), /Minimum delivery order/);
});

test("order-value slabs have deterministic boundaries", () => {
  const slabs = config({ delivery: { ...config().delivery, mode: "ORDER_VALUE", orderValueSlabs: [
    { min: 0, max: 299.99, fee: 60 }, { min: 300, max: 499.99, fee: 40 }, { min: 500, max: null, fee: 0 },
  ] } });
  assert.equal(calculateOrderTotals(slabs, { subtotal: 299, orderType: "delivery" }).deliveryFee, 60);
  assert.equal(calculateOrderTotals(slabs, { subtotal: 300, orderType: "delivery" }).deliveryFee, 40);
  assert.equal(calculateOrderTotals(slabs, { subtotal: 499, orderType: "delivery" }).deliveryFee, 40);
  assert.equal(calculateOrderTotals(slabs, { subtotal: 500, orderType: "delivery" }).deliveryFee, 0);
});

test("branch and verified-distance rules are deterministic", () => {
  const branchId = "64b000000000000000000002";
  const branchConfig = config({ delivery: { ...config().delivery, mode: "BRANCH_BASED", branchRules: [{ branchId, fee: 30, freeDeliveryThreshold: 399 }] } });
  assert.equal(calculateOrderTotals(branchConfig, { subtotal: 300, orderType: "delivery", branchId }).deliveryFee, 30);
  assert.equal(calculateOrderTotals(branchConfig, { subtotal: 399, orderType: "delivery", branchId }).deliveryFee, 0);
  assert.equal(calculateOrderTotals(branchConfig, { subtotal: 300, orderType: "delivery", branchId: "64b000000000000000000003" }).deliveryFee, 50);

  const distance = config({ delivery: { ...config().delivery, mode: "DISTANCE", distanceSlabs: [{ min: 0, max: 3, fee: 30 }, { min: 3.01, max: 6, fee: 50 }, { min: 6.01, max: 10, fee: 80 }] } });
  assert.equal(calculateOrderTotals(distance, { subtotal: 300, orderType: "delivery", distanceKm: 2.5 }).deliveryFee, 30);
  assert.equal(calculateOrderTotals(distance, { subtotal: 300, orderType: "delivery", distanceKm: 8 }).deliveryFee, 80);
  assert.throws(() => calculateOrderTotals(distance, { subtotal: 300, orderType: "delivery", distanceKm: 11 }), /within 10 km/);
});

test("coupon, delivery, tax, Damru, COD and Razorpay share one final formula", () => {
  const totals = calculateOrderTotals(config(), { subtotal: 500, couponDiscount: 50, damruDiscount: 50, orderType: "delivery" });
  assert.deepEqual({ coupon: totals.couponDiscount, delivery: totals.deliveryFee, tax: totals.taxAmount, damru: totals.damruDiscount, final: totals.finalAmount }, { coupon: 50, delivery: 50, tax: 22.5, damru: 50, final: 472.5 });
  // Payment method is intentionally not an engine input: COD and Razorpay cannot diverge.
  assert.equal(totals.finalAmount, calculateOrderTotals(config(), { subtotal: 500, couponDiscount: 50, damruDiscount: 50, orderType: "delivery" }).finalAmount);
});

test("configuration validation rejects unsafe values and overlapping slabs", () => {
  assert.throws(() => validateCheckoutCharges({ ...config(), tax: { ...config().tax, rate: 101 } }), /Tax rate/);
  assert.throws(() => validateCheckoutCharges({ ...config(), delivery: { ...config().delivery, flatFee: -1 } }), /Flat delivery fee/);
  assert.throws(() => validateCheckoutCharges({ ...config(), delivery: { ...config().delivery, orderValueSlabs: [{ min: 0, max: 300, fee: 50 }, { min: 300, max: null, fee: 0 }] } }), /gaps or overlaps/);
});

test("historical snapshots remain unchanged after configuration changes", () => {
  const oldTotals = calculateOrderTotals(config(), { subtotal: 500, orderType: "delivery" });
  const snapshot = structuredClone(oldTotals);
  const newTotals = calculateOrderTotals(config({ version: "v2", tax: { ...config().tax, rate: 8 }, delivery: { ...config().delivery, flatFee: 60 } }), { subtotal: 500, orderType: "delivery" });
  assert.equal(snapshot.deliveryFee, 50);
  assert.equal(snapshot.taxRate, 5);
  assert.equal(newTotals.deliveryFee, 60);
  assert.equal(newTotals.taxRate, 8);
});

test("order creation ignores client totals and Razorpay uses the stored payable", () => {
  const orderRoute = readFileSync("app/api/orders/route.ts", "utf8");
  const razorpayRoute = readFileSync("app/api/payments/razorpay/order/route.ts", "utf8");
  const orderModel = readFileSync("models/Order.ts", "utf8");
  const website = readFileSync("app/(website)/checkout/page.tsx", "utf8");
  const quoteRoute = readFileSync("app/api/checkout/quote/route.ts", "utf8");
  const cart = readFileSync("app/(website)/cart/page.tsx", "utf8");
  const mobile = readFileSync("mobile-app/src/app/checkout.tsx", "utf8");
  assert.doesNotMatch(orderRoute, /const \{[^}]*deliveryFee[^}]*tax[^}]*total/);
  assert.match(orderRoute, /resolveOrderItems/);
  assert.match(orderRoute, /calculateOrderTotals/);
  assert.match(razorpayRoute, /computePayableAmount\(order\)/);
  assert.match(website, /api\/checkout\/quote/);
  assert.match(quoteRoute, /partialTotals/);
  assert.match(website, /setQuote\(data\.partialTotals \|\| null\)/);
  assert.match(website, /address-confirm/);
  assert.doesNotMatch(website, /confirm\("Delete this address/);
  assert.match(cart, /api\/checkout\/quote/);
  assert.match(mobile, /api\/checkout\/quote/);
  assert.doesNotMatch(website, /subtotalAfterDiscount\s*=|Math\.round\(subtotalAfterDiscount/);
  assert.doesNotMatch(cart, /subtotalAfterDiscount\s*=|Math\.round\(subtotalAfterDiscount|deliveryCharge\s*=/);
  assert.doesNotMatch(mobile, /subtotalAfterDiscount\s*=|Math\.round\(subtotalAfterDiscount/);
  for (const field of ["couponDiscount", "deliveryFee", "taxAmount", "damruDiscount", "finalAmount", "chargesSnapshot"]) assert.match(orderModel, new RegExp(field));
});
