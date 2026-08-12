import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import DamruTransaction from "@/models/DamruTransaction";
import RewardReversal from "@/models/RewardReversal";
import User from "@/models/User";

type LedgerTotals = {
  credits: number;
  debitsExcludingReversals: number;
  reversalLedgerAmount: number;
  transactionCount: number;
};

export type WalletReconciliationResult = LedgerTotals & {
  userId: string;
  actualBalance: number;
  expectedBalance: number;
  difference: number;
  rewardDebt: number;
  reversalWalletAmount: number;
  reversalDebtAmount: number;
  reversalRecordedAmount: number;
  reconciled: boolean;
  issues: string[];
};

/**
 * Read-only wallet reconciliation. Reward reversals are intentionally special:
 * their ledger debit records the full clawback, while only `walletAmount`
 * touches the current wallet and the remainder becomes Reward Debt.
 */
export async function reconcileUserWallet(
  userId: string | mongoose.Types.ObjectId,
): Promise<WalletReconciliationResult | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(userId)) return null;
  const objectId = new mongoose.Types.ObjectId(String(userId));

  const [user, ledgerRows, reversalRows, recoveryRows] = await Promise.all([
    User.findById(objectId).select("damruBalance rewardDebt").lean<{
      damruBalance?: number;
      rewardDebt?: number;
    }>(),
    DamruTransaction.aggregate<LedgerTotals>([
      { $match: { userId: objectId } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } },
          debitsExcludingReversals: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "debit"] }, { $ne: ["$category", "reward_reversal"] }] },
                "$amount",
                0,
              ],
            },
          },
          reversalLedgerAmount: {
            $sum: { $cond: [{ $eq: ["$category", "reward_reversal"] }, "$amount", 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0, credits: 1, debitsExcludingReversals: 1, reversalLedgerAmount: 1, transactionCount: 1 } },
    ]),
    RewardReversal.aggregate<{
      reversalWalletAmount: number;
      reversalDebtAmount: number;
      reversalRecordedAmount: number;
    }>([
      { $match: { userId: objectId, status: "APPLIED", reversalTransactionId: { $exists: true } } },
      {
        $group: {
          _id: null,
          reversalWalletAmount: { $sum: "$walletAmount" },
          reversalDebtAmount: { $sum: "$debtAmount" },
          reversalRecordedAmount: { $sum: "$amount" },
        },
      },
      { $project: { _id: 0, reversalWalletAmount: 1, reversalDebtAmount: 1, reversalRecordedAmount: 1 } },
    ]),
    DamruTransaction.aggregate<{ amount: number }>([
      { $match: { userId: objectId, category: "reward_debt_recovery", type: "debit" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, amount: 1 } },
    ]),
  ]);

  if (!user) return null;
  const ledger = ledgerRows[0] || { credits: 0, debitsExcludingReversals: 0, reversalLedgerAmount: 0, transactionCount: 0 };
  const reversals = reversalRows[0] || { reversalWalletAmount: 0, reversalDebtAmount: 0, reversalRecordedAmount: 0 };
  const expectedBalance = ledger.credits - ledger.debitsExcludingReversals - reversals.reversalWalletAmount;
  const actualBalance = Number(user.damruBalance || 0);
  const difference = actualBalance - expectedBalance;
  const rewardDebt = Number(user.rewardDebt || 0);
  const issues: string[] = [];

  if (difference !== 0) {
    issues.push(`Wallet differs from ledger-derived balance by ${difference} Damru.`);
  }
  if (ledger.reversalLedgerAmount !== reversals.reversalRecordedAmount) {
    issues.push("Applied reversal records do not reconcile with reversal ledger debits.");
  }
  const expectedDebt = Math.max(0, reversals.reversalDebtAmount - Number(recoveryRows[0]?.amount || 0));
  if (rewardDebt !== expectedDebt) {
    issues.push(`Reward Debt differs from reversal/debt-recovery records by ${rewardDebt - expectedDebt} Damru.`);
  }

  return {
    userId: String(objectId),
    actualBalance,
    expectedBalance,
    difference,
    rewardDebt,
    ...ledger,
    ...reversals,
    reconciled: issues.length === 0,
    issues,
  };
}
