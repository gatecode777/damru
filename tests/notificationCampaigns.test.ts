import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { createCampaign, sendCampaignNow, estimateAudienceSize } from "../lib/notifications/campaignService";
import User from "../models/User";
import Notification from "../models/Notification";
import NotificationCampaign from "../models/NotificationCampaign";

async function makeUser(email?: string) {
  return User.create({
    name: "Campaign Test User",
    email: email || `campaign-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 0,
  });
}

async function cleanup(userIds: mongoose.Types.ObjectId[], campaignId?: mongoose.Types.ObjectId) {
  await Notification.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  if (campaignId) await NotificationCampaign.deleteOne({ _id: campaignId });
}

test("a campaign sent to SELECTED_USERS notifies exactly those users, once each", async () => {
  await connectDB();
  const userA = await makeUser();
  const userB = await makeUser();
  const adminId = new mongoose.Types.ObjectId();
  let campaignId: mongoose.Types.ObjectId | undefined;

  try {
    const created = await createCampaign({
      name: "Test Campaign",
      audience: { segment: "SELECTED_USERS", userIds: [userA._id, userB._id] },
      channels: ["IN_APP"],
      title: "Test Offer",
      message: "20% off today",
      createdBy: adminId,
    });
    assert.equal(created.success, true);
    campaignId = created.campaign!._id;
    assert.equal(created.campaign!.estimatedRecipients, 2);

    const sendResult = await sendCampaignNow(String(campaignId), adminId);
    assert.equal(sendResult.success, true);

    const notifA = await Notification.countDocuments({ userId: userA._id, campaignId });
    const notifB = await Notification.countDocuments({ userId: userB._id, campaignId });
    assert.equal(notifA, 1);
    assert.equal(notifB, 1);

    const campaign = await NotificationCampaign.findById(campaignId).lean();
    assert.equal(campaign?.status, "COMPLETED");
    assert.equal(campaign?.sentCount, 2);
  } finally {
    await cleanup([userA._id, userB._id], campaignId);
  }
});

test("sending an already-completed campaign again is rejected — no double send", async () => {
  await connectDB();
  const user = await makeUser();
  const adminId = new mongoose.Types.ObjectId();
  let campaignId: mongoose.Types.ObjectId | undefined;

  try {
    const created = await createCampaign({
      name: "Idempotency Test Campaign",
      audience: { segment: "SELECTED_USERS", userIds: [user._id] },
      channels: ["IN_APP"],
      title: "Test",
      message: "Test message",
      createdBy: adminId,
    });
    campaignId = created.campaign!._id;

    const first = await sendCampaignNow(String(campaignId), adminId);
    assert.equal(first.success, true);

    // Simulates a scheduler double-run or an admin double-click on "Send Now".
    const second = await sendCampaignNow(String(campaignId), adminId);
    assert.equal(second.success, false, "a completed campaign must reject a second send attempt");

    const notifCount = await Notification.countDocuments({ userId: user._id, campaignId });
    assert.equal(notifCount, 1, "the user must be notified exactly once, not twice");
  } finally {
    await cleanup([user._id], campaignId);
  }
});

test("estimateAudienceSize for DAMRU_USERS only counts users with a positive balance", async () => {
  await connectDB();
  // Before/after delta around a single fixture, rather than two independent
  // global counts — keeps the race window against other test files'
  // concurrent fixtures (node --test's cross-file parallelism) as tight as
  // possible instead of comparing two separately-timed global snapshots.
  const before = await estimateAudienceSize({ segment: "DAMRU_USERS" });
  const withBalance = await User.create({ name: "Has Damru", email: `damru-users-seg-${Date.now()}@example.test`, password: "x", damruBalance: 100 });
  try {
    const after = await estimateAudienceSize({ segment: "DAMRU_USERS" });
    assert.equal(after, before + 1, "a newly-created user with a positive balance must be counted");
  } finally {
    await User.deleteOne({ _id: withBalance._id });
  }
});

test("createCampaign rejects a LOYALTY_TIER audience with no tier selected", async () => {
  await connectDB();
  const adminId = new mongoose.Types.ObjectId();
  const result = await createCampaign({
    name: "Bad Campaign",
    audience: { segment: "LOYALTY_TIER" },
    channels: ["IN_APP"],
    title: "Test",
    message: "Test",
    createdBy: adminId,
  });
  assert.equal(result.success, false);
});
