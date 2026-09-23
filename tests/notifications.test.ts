import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { awardDamru } from "../lib/rewardEngine";
import { notifyRewardEvent } from "../lib/notifications/rewardNotificationService";
import { markRead, markAllRead, listNotifications } from "../lib/notifications/notificationService";
import { generateExpiryWarnings } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";
import Notification from "../models/Notification";

async function makeUser(overrides: Partial<{ damruBalance: number }> = {}) {
  return User.create({
    name: "Notification Test User",
    email: `notif-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance: overrides.damruBalance ?? 0,
    notificationPreferences: { rewardUpdates: false, orderUpdates: false },
  });
}

async function cleanupUser(userId: mongoose.Types.ObjectId) {
  await DamruTransaction.deleteMany({ userId });
  await Notification.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

test("a reward credit produces exactly one notification, and a duplicate award attempt produces no second one", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    const first = await awardDamru({
      userId: user._id, category: "birthday", amount: 500,
      description: "Birthday Reward", idempotencyKey: `notif-dedup-test-${user._id}`,
    });
    assert.equal("duplicate" in first && first.duplicate, false);

    // Same event retried (e.g. a re-run occasion-reward scheduler) — awardDamru
    // itself is idempotent on idempotencyKey, so notifyRewardEvent is never
    // even reached a second time for this transaction.
    const retry = await awardDamru({
      userId: user._id, category: "birthday", amount: 500,
      description: "Birthday Reward", idempotencyKey: `notif-dedup-test-${user._id}`,
    });
    assert.equal("duplicate" in retry && retry.duplicate, true);

    const notifCount = await Notification.countDocuments({ userId: user._id, type: "BIRTHDAY_REWARD" });
    assert.equal(notifCount, 1, "exactly one notification must exist regardless of the retried award attempt");
  } finally {
    await cleanupUser(user._id);
  }
});

test("calling notifyRewardEvent twice with the same sourceId is a safe no-op the second time", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    const sourceId = new mongoose.Types.ObjectId();
    const first = await notifyRewardEvent({ userId: user._id, type: "DAMRU_CREDITED", sourceId, amount: 100 });
    const second = await notifyRewardEvent({ userId: user._id, type: "DAMRU_CREDITED", sourceId, amount: 100 });

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);

    const count = await Notification.countDocuments({ userId: user._id, sourceId: String(sourceId) });
    assert.equal(count, 1);
  } finally {
    await cleanupUser(user._id);
  }
});

test("a user cannot read or mark-read another user's notification", async () => {
  await connectDB();
  const userA = await makeUser();
  const userB = await makeUser();
  try {
    const result = await notifyRewardEvent({ userId: userA._id, type: "DAMRU_CREDITED", sourceId: new mongoose.Types.ObjectId(), amount: 100 });
    assert.equal(result.duplicate, false);
    const notif = await Notification.findOne({ userId: userA._id });
    assert.ok(notif);

    // User B attempts to mark user A's notification as read — must fail (no ownership match).
    const marked = await markRead(userB._id, String(notif!._id));
    assert.equal(marked, false, "a foreign notification id must never be markable by another user");

    const reloaded = await Notification.findById(notif!._id).lean();
    assert.equal(reloaded?.isRead, false, "the notification must remain unread since ownership didn't match");

    // User B's own list must not include user A's notification.
    const listB = await listNotifications(userB._id, 1, 20);
    assert.equal(listB.notifications.some(n => String(n._id) === String(notif!._id)), false);

    // markAllRead for user B must not touch user A's notification either.
    await markAllRead(userB._id);
    const stillUnread = await Notification.findById(notif!._id).lean();
    assert.equal(stillUnread?.isRead, false);
  } finally {
    await cleanupUser(userA._id);
    await cleanupUser(userB._id);
  }
});

test("rewardUpdates=false skips the email channel but the in-app notification is still created", async () => {
  await connectDB();
  const user = await makeUser();
  await User.updateOne({ _id: user._id }, { $set: { notificationPreferences: { orderUpdates: true, rewardUpdates: false, promotionalPush: true, promotionalEmail: true, promotionalInApp: true } } });
  try {
    const result = await notifyRewardEvent({
      userId: user._id, type: "BIRTHDAY_REWARD", sourceId: new mongoose.Types.ObjectId(), amount: 250,
    });
    assert.equal(result.success, true);
    assert.equal(result.duplicate, false);

    const notif = await Notification.findOne({ userId: user._id, type: "BIRTHDAY_REWARD" }).lean();
    assert.ok(notif, "the in-app notification must still be created even with rewardUpdates disabled");
    assert.ok(notif?.channels.includes("IN_APP"));
    assert.equal(notif?.channels.includes("EMAIL"), false, "email channel must be skipped when rewardUpdates is false");
    assert.equal(notif?.delivery.email.status, "SKIPPED");
  } finally {
    await cleanupUser(user._id);
  }
});

test("expiry warnings fire once per lot per window, not once per scheduler run", async () => {
  await connectDB();
  const user = await makeUser({ damruBalance: 500 });
  const expiresIn20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  await DamruTransaction.create({
    userId: user._id, type: "credit", category: "birthday", amount: 500, balanceAfter: 500,
    description: "Test lot", idempotencyKey: `expiry-warning-dedup-test-${user._id}`,
    originalAmount: 500, remainingAmount: 500, expiresAt: expiresIn20Days,
  });
  try {
    // Two "scheduler runs" back to back — this lot falls inside the 30-day window only.
    await generateExpiryWarnings();
    await generateExpiryWarnings();

    const count = await Notification.countDocuments({ userId: user._id, type: "DAMRU_EXPIRING_SOON" });
    assert.equal(count, 1, "the 30-day warning must fire exactly once, not once per scheduler run");
  } finally {
    await cleanupUser(user._id);
  }
});
