import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { distanceKm } from "../lib/delivery/serviceability";

const orderRoute = readFileSync("app/api/orders/route.ts", "utf8");
const finalizer = readFileSync("lib/payments/finalizePayment.ts", "utf8");
const cancellation = readFileSync("app/api/orders/[id]/cancel/route.ts", "utf8");

test("missing payment method is rejected and Razorpay orders start pending", () => {
  assert.doesNotMatch(orderRoute, /paymentMethod\s*=\s*["']cod["']/);
  assert.match(orderRoute, /if \(!paymentMethod\)/);
  assert.match(orderRoute, /status:\s*paymentMethod === "cod" \? "confirmed" : "pending"/);
});

test("delivery serviceability is authoritative before order creation", () => {
  assert.match(orderRoute, /checkDeliveryServiceability/);
  assert.match(orderRoute, /ADDRESS_NOT_SERVICEABLE/);
  assert.match(orderRoute, /deliveryDistanceKm/);
  assert.equal(distanceKm({ latitude: 26.9124, longitude: 75.7873 }, { latitude: 26.9124, longitude: 75.7873 }), 0);
  const jaipurDistance = distanceKm({ latitude: 26.9124, longitude: 75.7873 }, { latitude: 26.9855, longitude: 75.8513 });
  assert.ok(jaipurDistance > 9 && jaipurDistance < 12);
});

test("server confirms an online order only after payment finalizes", () => {
  assert.match(finalizer, /paymentStatus: "paid",[\s\S]*?status: "confirmed"/);
  assert.match(finalizer, /notifyOrderEvent/);
});

test("customer cancellation stores a required message and audit fields", () => {
  assert.match(cancellation, /reason\.length < 5/);
  assert.match(cancellation, /cancelledBy: "customer"/);
  assert.match(cancellation, /cancellationReason: reason/);
  assert.match(cancellation, /cancelledAt: new Date\(\)/);
});
