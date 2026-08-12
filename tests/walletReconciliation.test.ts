import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { reconcileUserWallet } from "../lib/rewards/walletReconciliation";
import DamruTransaction from "../models/DamruTransaction";
import RewardReversal from "../models/RewardReversal";
import User from "../models/User";

test("wallet reconciliation accounts for opening balance, reversals, debt recovery, redemption and restoration", async () => {
  await connectDB();
  const user = await User.create({
    name: "Wallet reconciliation test",
    email: `wallet-reconcile-${Date.now()}-${Math.random()}@example.test`,
    password: "test",
    damruBalance: 10,
    rewardDebt: 30,
  });
  const original = await DamruTransaction.create({
    userId: user._id, type: "credit", category: "legacy_opening_balance", amount: 100,
    balanceAfter: 100, description: "Opening balance", idempotencyKey: `reconcile-opening:${user._id}`,
  });
  const redemption = await DamruTransaction.create({
    userId: user._id, type: "debit", category: "redemption", amount: 80,
    balanceAfter: 20, description: "Redemption", idempotencyKey: `reconcile-redemption:${user._id}`,
  });
  const reversalTx = await DamruTransaction.create({
    userId: user._id, type: "debit", category: "reward_reversal", amount: 100,
    balanceAfter: 0, description: "Reversal", idempotencyKey: `reconcile-reversal:${user._id}`,
    originalTransactionId: original._id,
  });
  const newCredit = await DamruTransaction.create({
    userId: user._id, type: "credit", category: "order_reward", amount: 50,
    balanceAfter: 50, description: "New reward", idempotencyKey: `reconcile-credit:${user._id}`,
  });
  const recovery = await DamruTransaction.create({
    userId: user._id, type: "debit", category: "reward_debt_recovery", amount: 50,
    balanceAfter: 0, description: "Debt recovery", idempotencyKey: `reconcile-recovery:${user._id}`,
  });
  const restoration = await DamruTransaction.create({
    userId: user._id, type: "credit", category: "refund_restore", amount: 10,
    balanceAfter: 10, description: "Refund restoration", idempotencyKey: `reconcile-restore:${user._id}`,
  });
  const reversal = await RewardReversal.create({
    userId: user._id,
    originalTransactionId: original._id,
    reversalTransactionId: reversalTx._id,
    amount: 100,
    walletAmount: 20,
    debtAmount: 80,
    reason: "FULL_REFUND",
    status: "APPLIED",
    idempotencyKey: `reconcile-record:${user._id}`,
  });

  try {
    const result = await reconcileUserWallet(user._id);
    assert.ok(result);
    assert.equal(result.reconciled, true);
    assert.equal(result.expectedBalance, 10);
    assert.equal(result.actualBalance, 10);
    assert.equal(result.rewardDebt, 30);
    assert.deepEqual(result.issues, []);
  } finally {
    await Promise.all([
      RewardReversal.deleteOne({ _id: reversal._id }),
      DamruTransaction.deleteMany({ _id: { $in: [original._id, redemption._id, reversalTx._id, newCredit._id, recovery._id, restoration._id] } }),
      User.deleteOne({ _id: user._id }),
    ]);
  }
});
