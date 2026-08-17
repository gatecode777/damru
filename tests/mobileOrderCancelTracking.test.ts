import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const orderModel = readFileSync(join(projectRoot, "models/Order.ts"), "utf8");
const cancelRoute = readFileSync(join(projectRoot, "app/api/orders/[id]/cancel/route.ts"), "utf8");
const orderStatus = readFileSync(join(projectRoot, "mobile-app/src/constants/orderStatus.ts"), "utf8");
const stepper = readFileSync(join(projectRoot, "mobile-app/src/components/orders/OrderStepper.tsx"), "utf8");
const sheet = readFileSync(join(projectRoot, "mobile-app/src/components/orders/CancelOrderSheet.tsx"), "utf8");
const cancelHook = readFileSync(join(projectRoot, "mobile-app/src/hooks/useCancelOrder.ts"), "utf8");
const ordersScreen = readFileSync(join(projectRoot, "mobile-app/src/app/orders.tsx"), "utf8");
const detailScreen = readFileSync(join(projectRoot, "mobile-app/src/app/order/[id].tsx"), "utf8");

test("Order model has no per-stage timestamps — the stepper must not fabricate ETAs", () => {
  // Documents a deliberate design decision: the backend only stores createdAt/
  // updatedAt/cancelledAt, not confirmedAt/preparingAt/outForDeliveryAt/
  // deliveredAt. The mobile stepper shows step position only, never a time or ETA.
  assert.doesNotMatch(orderModel, /confirmedAt|preparingAt|outForDeliveryAt|deliveredAt|statusHistory/);
  assert.doesNotMatch(stepper, /ETA|estimatedDelivery|Date\.now\(\)|new Date\(/);
});

test("cancellable statuses match the backend's cancel-eligibility rule", () => {
  assert.match(cancelRoute, /\["pending", "confirmed"\]\.includes\(current\.status\)/);
  assert.match(orderStatus, /CANCELLABLE_STATUSES = \["pending", "confirmed"\]/);
});

test("cancel reason sheet requires a non-trivial reason and supports free text", () => {
  assert.match(sheet, /CANCEL_REASONS/);
  assert.match(sheet, /reason\.length >= 5/);
  assert.match(cancelRoute, /reason\.length < 5 \|\| reason\.length > 500/);
});

test("cancel mutation is optimistic with rollback on failure", () => {
  assert.match(cancelHook, /onMutate:/);
  assert.match(cancelHook, /status: "cancelled"/);
  assert.match(cancelHook, /onError:.*\n.*setQueryData\(queryKeys\.profile\.orders\(\), context\.previous\)/s);
});

test("order cancellation uses a native destructive Alert, not a custom modal", () => {
  for (const source of [ordersScreen, detailScreen]) {
    assert.match(source, /Alert\.alert\(\s*\n?\s*"Cancel this order\?"/);
    assert.match(source, /style: "destructive"/);
  }
});

test("orders list and detail screen both navigate via /order/[id]", () => {
  assert.match(ordersScreen, /pathname: "\/order\/\[id\]", params: \{ id: item\._id \}/);
  assert.match(detailScreen, /useLocalSearchParams<\{ id: string \}>\(\)/);
});

test("stepper renders a horizontal stepper and a distinct cancelled state", () => {
  assert.match(stepper, /flexDirection: "row"/);
  assert.match(stepper, /status === "cancelled"/);
});
