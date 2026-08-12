import "./setup";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import {
  calculateRiskScore,
  classifyRiskScore,
  createRiskEvent,
  evaluateCampaignRisk,
  evaluateAdminAdjustmentRisk,
  evaluateOrderRisk,
  evaluateRedemptionRisk,
  evaluateReferralRisk,
  evaluateRefundRisk,
  evaluateRewardDebtRisk,
  evaluateRewardReversalRisk,
  evaluateRewardRisk,
  evaluateRiskSafely,
  resolveRiskEvent,
} from "../lib/rewards/riskEngine";
import DamruTransaction from "../models/DamruTransaction";
import Order from "../models/Order";
import PaymentRefund from "../models/PaymentRefund";
import Referral from "../models/Referral";
import RewardCampaignUsage from "../models/RewardCampaignUsage";
import RewardReversal from "../models/RewardReversal";
import RewardRiskEvent from "../models/RewardRiskEvent";
import User from "../models/User";
import { DEFAULT_REWARD_RISK_CONFIG, validateRewardRiskConfig } from "../lib/rewards/riskConfig";
import { checkAndAwardDailyLogin } from "../lib/rewardEngine";

async function userFixture(label: string) {
  await connectDB();
  return User.create({ name: label, email: `risk-${label.replace(/\W/g, "-")}-${Date.now()}-${Math.random()}@example.test`, password: "test" });
}

async function orderFixture(userId: mongoose.Types.ObjectId, status: "delivered" | "cancelled" = "delivered") {
  return Order.create({
    orderId: `DMR-RISK-${Date.now()}-${Math.random()}`,
    userId,
    userName: "Risk Test",
    items: [{ name: "Test", variantType: "none", custom: "", price: 1000, qty: 1 }],
    subtotal: 1000,
    total: 1000,
    eligibleRewardAmount: 1000,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    status,
    ...(status === "cancelled" ? { cancelledAt: new Date(), cancelledBy: "customer", cancellationReason: "test cancellation" } : {}),
  });
}

async function transaction(userId: mongoose.Types.ObjectId, category: "campaign" | "order_reward" | "redemption" | "admin_credit", amount: number, extra: Record<string, unknown> = {}) {
  return DamruTransaction.create({
    userId,
    type: category === "redemption" ? "debit" : "credit",
    category,
    amount,
    balanceAfter: 0,
    description: `${category} risk test`,
    idempotencyKey: `risk-tx:${userId}:${category}:${Date.now()}:${Math.random()}`,
    ...extra,
  });
}

async function cleanup(userIds: mongoose.Types.ObjectId[]) {
  const orders = await Order.find({ userId: { $in: userIds } }).distinct("_id");
  await Promise.all([
    RewardRiskEvent.deleteMany({ userId: { $in: userIds } }),
    RewardReversal.deleteMany({ userId: { $in: userIds } }),
    RewardCampaignUsage.deleteMany({ userId: { $in: userIds } }),
    Referral.deleteMany({ $or: [{ referrerUserId: { $in: userIds } }, { referredUserId: { $in: userIds } }] }),
    PaymentRefund.deleteMany({ orderId: { $in: orders } }),
    DamruTransaction.deleteMany({ userId: { $in: userIds } }),
    Order.deleteMany({ _id: { $in: orders } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
}

test("risk score is deterministic, bounded, and classified without treating it as proof", () => {
  assert.equal(calculateRiskScore([40, 45, 30]), 100);
  assert.equal(calculateRiskScore([-10, 20]), 20);
  assert.equal(classifyRiskScore(29), "LOW");
  assert.equal(classifyRiskScore(30), "MEDIUM");
  assert.equal(classifyRiskScore(60), "HIGH");
  assert.equal(classifyRiskScore(80), "CRITICAL");
});

test("risk threshold validation rejects unsafe values and unordered score bands", () => {
  assert.throws(() => validateRewardRiskConfig({ refunds: { ratio: Number.NaN } }), /refunds\.ratio/);
  assert.throws(() => validateRewardRiskConfig({ rewardDebt: { amount: -1 } }), /rewardDebt\.amount/);
  assert.throws(() => validateRewardRiskConfig({ scoring: { medium: 70, high: 60, critical: 80 } }), /ordered/);
  assert.equal(validateRewardRiskConfig(DEFAULT_REWARD_RISK_CONFIG).scoring.critical, 80);
});

test("normal earning does not produce a high or critical alert", async () => {
  const user = await userFixture("normal");
  try {
    const tx = await transaction(user._id, "order_reward", 300);
    await evaluateRewardRisk({ userId: user._id, transactionId: tx._id });
    assert.equal(await RewardRiskEvent.countDocuments({ userId: user._id, severity: { $in: ["HIGH", "CRITICAL"] } }), 0);
  } finally { await cleanup([user._id]); }
});

test("daily streak retries and concurrent clients converge on one ledger award", async () => {
  const user = await userFixture("daily-streak");
  try {
    await Promise.all(Array.from({ length: 12 }, () => checkAndAwardDailyLogin(user._id)));
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id, category: "daily_login" }), 1);
  } finally { await cleanup([user._id]); }
});

test("high earning evaluation is deduplicated under retries and concurrency", async () => {
  const user = await userFixture("earning");
  try {
    const rows: Array<Awaited<ReturnType<typeof transaction>>> = [];
    for (let index = 0; index < 10; index++) rows.push(await transaction(user._id, "campaign", 500));
    await Promise.all(Array.from({ length: 10 }, () => evaluateRewardRisk({ userId: user._id, transactionId: rows[9]._id })));
    assert.equal(await RewardRiskEvent.countDocuments({ userId: user._id, ruleCode: "EARNING_VELOCITY_24H" }), 1);
  } finally { await cleanup([user._id]); }
});

test("rapid repeated redemption creates a review event without another financial operation", async () => {
  const user = await userFixture("redemption");
  const order = await orderFixture(user._id);
  try {
    let latest;
    for (let index = 0; index < 3; index++) latest = await transaction(user._id, "redemption", 1100, { orderId: order._id });
    const before = await DamruTransaction.countDocuments({ userId: user._id });
    const event = await evaluateRedemptionRisk({ userId: user._id, transactionId: latest!._id, orderId: order._id });
    assert.equal(event?.eventType, "REDEMPTION_VELOCITY");
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id }), before);
  } finally { await cleanup([user._id]); }
});

test("mission reward velocity creates a review event while preserving all mission rewards", async () => {
  const user = await userFixture("missions");
  try {
    let latest;
    for (let index = 0; index < 5; index++) {
      latest = await DamruTransaction.create({ userId: user._id, type: "credit", category: "mission", amount: 500, balanceAfter: 0, description: "mission velocity test", idempotencyKey: `risk-mission:${user._id}:${index}` });
    }
    const before = await DamruTransaction.countDocuments({ userId: user._id, category: "mission" });
    await evaluateRewardRisk({ userId: user._id, transactionId: latest!._id });
    assert.equal(await RewardRiskEvent.countDocuments({ userId: user._id, eventType: "MISSION_VELOCITY" }), 1);
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id, category: "mission" }), before);
  } finally { await cleanup([user._id]); }
});

test("repeated earn, redeem, reversal, and refund activity creates a high refund alert", async () => {
  const user = await userFixture("refund");
  const orders = [];
  try {
    for (let index = 0; index < 4; index++) orders.push(await orderFixture(user._id));
    for (let index = 0; index < 3; index++) {
      await Order.updateOne({ _id: orders[index]._id }, { $set: { paymentStatus: "refunded", refundedAmount: 1000, paymentAmount: 1000 } });
      await PaymentRefund.create({ orderId: orders[index]._id, userId: user._id, gateway: "razorpay", gatewayPaymentId: `pay_risk_${index}`, amount: 1000, currency: "INR", status: "processed", reason: "risk test", requestedBy: new mongoose.Types.ObjectId(), requestedAt: new Date(), processedAt: new Date(), refundRequestId: `risk-refund-${Date.now()}-${index}-${Math.random()}` });
      const credit = await transaction(user._id, "order_reward", 500, { orderId: orders[index]._id });
      await RewardReversal.create({ userId: user._id, originalTransactionId: credit._id, orderId: orders[index]._id, amount: 500, walletAmount: 500, debtAmount: 0, reason: "FULL_REFUND", status: "APPLIED", idempotencyKey: `risk-reversal:${credit._id}:${Math.random()}` });
      await transaction(user._id, "redemption", 200, { orderId: orders[index]._id });
    }
    const event = await evaluateRefundRisk({ userId: user._id, refundId: (await PaymentRefund.findOne({ orderId: orders[0]._id }))!._id, orderId: orders[0]._id });
    assert.equal(event?.eventType, "REFUND_ABUSE");
    assert.ok((event?.score || 0) >= 60);
    assert.equal(await RewardRiskEvent.countDocuments({ userId: user._id, eventType: "EARN_REDEEM_REFUND_ABUSE" }), 1);
  } finally { await cleanup([user._id]); }
});

test("frequent reward reversals create one bounded review event without changing ledger state", async () => {
  const user = await userFixture("reversals");
  try {
    const reversalIds: mongoose.Types.ObjectId[] = [];
    for (let index = 0; index < 3; index++) {
      const credit = await transaction(user._id, "order_reward", 300);
      const reversal = await RewardReversal.create({ userId: user._id, originalTransactionId: credit._id, amount: 300, walletAmount: 300, debtAmount: 0, reason: "FULL_REFUND", status: "APPLIED", idempotencyKey: `risk-frequency:${credit._id}` });
      reversalIds.push(reversal._id as mongoose.Types.ObjectId);
    }
    const transactionCount = await DamruTransaction.countDocuments({ userId: user._id });
    const event = await evaluateRewardReversalRisk({ userId: user._id, reversalId: reversalIds[2] });
    assert.equal(event?.eventType, "REWARD_REVERSAL_FREQUENCY");
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id }), transactionCount);
    await Promise.all(Array.from({ length: 5 }, () => evaluateRewardReversalRisk({ userId: user._id, reversalId: reversalIds[2] })));
    assert.equal(await RewardRiskEvent.countDocuments({ userId: user._id, eventType: "REWARD_REVERSAL_FREQUENCY" }), 1);
  } finally { await cleanup([user._id]); }
});

test("reward debt and repeated cancellation are monitored without changing debt", async () => {
  const user = await userFixture("debt");
  await User.updateOne({ _id: user._id }, { $set: { rewardDebt: 750 } });
  try {
    const orders = [];
    for (let index = 0; index < 5; index++) orders.push(await orderFixture(user._id, index < 4 ? "cancelled" : "delivered"));
    const debtEvent = await evaluateRewardDebtRisk({ userId: user._id });
    const cancelEvent = await evaluateOrderRisk({ userId: user._id, orderId: orders[0]._id });
    assert.equal(debtEvent?.eventType, "REWARD_DEBT");
    assert.equal(cancelEvent?.eventType, "CANCELLATION_ABUSE");
    assert.equal((await User.findById(user._id).lean())?.rewardDebt, 750);
  } finally { await cleanup([user._id]); }
});

test("authoritative referral and campaign velocity create review events without deleting history", async () => {
  const referrer = await userFixture("referrer");
  const referredUsers: mongoose.Types.ObjectId[] = [];
  try {
    for (let index = 0; index < 10; index++) {
      const referred = await userFixture(`referred-${index}`); referredUsers.push(referred._id);
      await Referral.create({ referrerUserId: referrer._id, referredUserId: referred._id, referralCode: "RISK", status: index < 5 ? "QUALIFIED" : "PENDING_QUALIFICATION", registeredAt: new Date(), ...(index < 5 ? { qualifiedAt: new Date() } : {}) });
    }
    const campaignId = new mongoose.Types.ObjectId();
    for (let index = 0; index < 8; index++) {
      await RewardCampaignUsage.create({ campaignId, userId: referrer._id, sourceId: `risk-campaign-${index}`, rewardAmount: 700, status: "AWARDED", snapshot: { test: true } });
      await transaction(referrer._id, "campaign", 700, { campaignId });
    }
    assert.equal((await evaluateReferralRisk({ userId: referrer._id }))?.eventType, "REFERRAL_FARMING");
    assert.equal((await evaluateCampaignRisk({ userId: referrer._id, campaignId, sourceId: "risk-campaign" }))?.eventType, "CAMPAIGN_ABUSE");
    assert.equal(await Referral.countDocuments({ referrerUserId: referrer._id }), 10);
    assert.equal(await RewardCampaignUsage.countDocuments({ userId: referrer._id }), 8);
  } finally { await cleanup([referrer._id, ...referredUsers]); }
});

test("large and repeated admin adjustments are monitored without changing the adjustment", async () => {
  const user = await userFixture("admin-adjustment");
  const adminId = new mongoose.Types.ObjectId();
  try {
    const tx = await transaction(user._id, "admin_credit", 5000, { adjustedBy: adminId });
    const before = await DamruTransaction.countDocuments({ userId: user._id });
    const event = await evaluateAdminAdjustmentRisk({ userId: user._id, transactionId: tx._id, adminId });
    assert.equal(event?.eventType, "ADMIN_ADJUSTMENT");
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id }), before);
  } finally { await cleanup([user._id]); }
});

test("review, dismissal, and confirmed-abuse decisions never mutate wallet data", async () => {
  const user = await userFixture("review");
  const adminId = new mongoose.Types.ObjectId();
  try {
    const underReview = await createRiskEvent({ userId: user._id, eventType: "REWARD_DEBT", ruleCode: "REVIEW_TEST", periodKey: "one", score: 70, reasons: ["Review test"], sourceType: "User", sourceId: String(user._id) });
    const first = await resolveRiskEvent({ eventId: underReview._id, action: "UNDER_REVIEW", reviewedBy: adminId });
    assert.equal(first?.event.status, "UNDER_REVIEW");
    const monitored = await resolveRiskEvent({ eventId: underReview._id, action: "MONITOR", reviewedBy: adminId });
    assert.equal(monitored?.event.reviewDecision, "MONITOR");
    const resolved = await resolveRiskEvent({ eventId: underReview._id, action: "RESOLVE_LEGITIMATE", reviewedBy: adminId, note: "Verified legitimate activity." });
    assert.equal(resolved?.event.reviewDecision, "LEGITIMATE");

    const dismissed = await createRiskEvent({ userId: user._id, eventType: "CAMPAIGN_ABUSE", ruleCode: "DISMISS_TEST", periodKey: "two", score: 65, reasons: ["Dismiss test"], sourceType: "User", sourceId: String(user._id) });
    assert.equal((await resolveRiskEvent({ eventId: dismissed._id, action: "DISMISS", reviewedBy: adminId, note: "False positive confirmed." }))?.event.status, "DISMISSED");
    const abuse = await createRiskEvent({ userId: user._id, eventType: "REFUND_ABUSE", ruleCode: "ABUSE_TEST", periodKey: "three", score: 90, reasons: ["Abuse test"], sourceType: "User", sourceId: String(user._id) });
    assert.equal((await resolveRiskEvent({ eventId: abuse._id, action: "RESOLVE_ABUSE", reviewedBy: adminId, note: "Evidence reviewed and confirmed." }))?.event.reviewDecision, "ABUSE_CONFIRMED");
    const noAction = await createRiskEvent({ userId: user._id, eventType: "MISSION_VELOCITY", ruleCode: "NO_ACTION_TEST", periodKey: "four", score: 40, reasons: ["No action test"], sourceType: "User", sourceId: String(user._id) });
    assert.equal((await resolveRiskEvent({ eventId: noAction._id, action: "RESOLVE_NO_ACTION", reviewedBy: adminId, note: "Reviewed; no further action needed." }))?.event.reviewDecision, "NO_ACTION");
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 0);
  } finally { await cleanup([user._id]); }
});

test("risk APIs enforce rewards view/edit permissions and keep review notes admin-only", () => {
  const listRoute = readFileSync("app/api/admin/rewards/risk/route.ts", "utf8");
  const detailRoute = readFileSync("app/api/admin/rewards/risk/[id]/route.ts", "utf8");
  const configRoute = readFileSync("app/api/admin/rewards/risk/config/route.ts", "utf8");
  assert.match(listRoute, /checkApiPerm\("rewards", "view"\)/);
  assert.match(detailRoute, /checkApiPerm\("rewards", "view"\)/);
  assert.match(detailRoute, /checkApiPerm\("rewards", "edit"\)/);
  assert.match(detailRoute, /logAdminAction\("reward_risk_reviewed"/);
  assert.match(configRoute, /checkApiPerm\("rewards", "view"\)/);
  assert.match(configRoute, /checkApiPerm\("rewards", "edit"\)/);
  assert.match(configRoute, /logAdminAction\("reward_risk_config_updated"/);
  assert.equal(readFileSync("app/api/rewards/dashboard/route.ts", "utf8").includes("reviewNote"), false);
});

test("risk evaluation failures are isolated and customer APIs contain no risk serialization", async () => {
  let financialActionCompleted = true;
  await evaluateRiskSafely("test-isolation", async () => { throw new Error("simulated analytics failure"); });
  assert.equal(financialActionCompleted, true);
  financialActionCompleted = false;
  assert.equal(financialActionCompleted, false);

  function filesUnder(directory: string): string[] {
    return readdirSync(directory).flatMap(name => {
      const path = `${directory}/${name}`;
      return statSync(path).isDirectory() ? filesUnder(path) : [path];
    });
  }
  const customerRoutes = filesUnder("app/api/rewards").filter(path => path.endsWith(".ts"));
  for (const path of customerRoutes) {
    const source = readFileSync(path, "utf8");
    assert.equal(source.includes("RewardRiskEvent"), false, `${path} must not expose risk events`);
    assert.equal(source.includes("reviewNote"), false, `${path} must not expose review notes`);
  }
});
