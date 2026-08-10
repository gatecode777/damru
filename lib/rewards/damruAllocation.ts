import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import DamruTransaction, { DamruTransactionCategory, IDamruAllocation } from "@/models/DamruTransaction";
import type { DamruConfigValues } from "@/lib/getDamruConfig";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";

/**
 * Central Damru expiry/allocation service (PRD 4A). Every path that debits a
 * user's wallet (redemption, admin debit, expiry itself) must go through
 * `allocateDebit()` here instead of touching `damruBalance` directly, and every
 * path that credits it (awardDamru, admin credit, refund restoration) must call
 * `assignLotFields()` when creating the DamruTransaction so the credit becomes a
 * spendable, expirable "lot". This file is the ONLY place FEFO/FIFO ordering is
 * implemented — do not re-derive it elsewhere.
 *
 * Timezone policy: expiry is a fixed-duration offset ("N days from now"), not a
 * calendar-date concept like birthdays — so it is computed and stored as a plain
 * UTC instant (`Date.now() + days * 86400000`), never localized. Website/mobile
 * may display `expiresAt` in local time; the stored value itself is timezone-free.
 *
 * Concurrency policy: no MongoDB multi-document transactions, consistent with
 * the rest of this codebase (see docs/PAYMENT_RELIABILITY_REFUNDS.md's own
 * rationale). Every mutation here is a single-document atomic conditional
 * `findOneAndUpdate`, so two concurrent callers touching the SAME lot always
 * serialize correctly at the document level — one wins, the other's conditional
 * update matches zero documents and is retried against fresh state. Multi-step
 * sequences (wallet decrement + N lot claims + ledger insert) use the same
 * insert-first-catch-duplicate-key + explicit compensating rollback idiom
 * already established by redeemDamru/adjustDamru/requestRefund.
 */

const NEVER_EXPIRES_CATEGORIES: ReadonlySet<DamruTransactionCategory> = new Set(["legacy_opening_balance"]);

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000;
}

/** Whether `category` is even a candidate for an expiry date under the current policy (before checking config/opt-outs). */
export function categoryIsExpiryEligible(category: DamruTransactionCategory): boolean {
  return !NEVER_EXPIRES_CATEGORIES.has(category);
}

/**
 * Computes the expiry date a NEW credit of `category` should receive right now.
 * Returns null (never expires) whenever: expiry is disabled, no validity period
 * is configured, the category is structurally non-expiring (legacy opening
 * balance), or the caller explicitly opted the credit out (admin "never
 * expires" checkbox). Centralizing this is what section 12/40 of the PRD
 * requires — every reward engine funnels through here rather than each
 * computing its own date.
 */
export function computeExpiry(
  category: DamruTransactionCategory,
  config: Pick<DamruConfigValues, "expiryEnabled" | "expiryDays">,
  opts?: { neverExpires?: boolean }
): Date | null {
  if (opts?.neverExpires) return null;
  if (!config.expiryEnabled) return null;
  if (!config.expiryDays || config.expiryDays <= 0) return null;
  if (!categoryIsExpiryEligible(category)) return null;
  return new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000);
}

/**
 * Server-side validation for PUT /api/admin/rewards/config's expiry fields
 * (PRD section 39) — extracted as a pure function so it's unit-testable
 * without mocking an admin session. Only enforced when expiry would be
 * enabled by the resulting config; a disabled config tolerates any stored
 * expiryDays/expiryWarningDays values (they're simply inert while disabled).
 */
export function validateExpiryConfig(values: {
  expiryEnabled: boolean;
  expiryDays: number | null;
  expiryWarningDays: number;
}): string | null {
  if (!values.expiryEnabled) return null;
  if (!Number.isInteger(values.expiryDays) || (values.expiryDays as number) <= 0 || (values.expiryDays as number) > 3650) {
    return "Expiry validity must be a whole number of days between 1 and 3650.";
  }
  if (!Number.isInteger(values.expiryWarningDays) || values.expiryWarningDays < 0) {
    return "Expiring-soon warning period must be a non-negative whole number of days.";
  }
  if (values.expiryWarningDays >= (values.expiryDays as number)) {
    return "The expiring-soon warning period must be shorter than the validity period.";
  }
  return null;
}

/** Spread into DamruTransaction.create() for any NEW credit transaction — turns it into a lot. */
export function assignLotFields(
  amount: number,
  category: DamruTransactionCategory,
  config: Pick<DamruConfigValues, "expiryEnabled" | "expiryDays">,
  opts?: { neverExpires?: boolean }
): { originalAmount: number; remainingAmount: number; expiresAt: Date | null } {
  return { originalAmount: amount, remainingAmount: amount, expiresAt: computeExpiry(category, config, opts) };
}

const FAR_FUTURE = new Date("9999-12-31T00:00:00.000Z");

/**
 * Picks the single best next lot to consume: FEFO (earliest expiresAt first),
 * FIFO tie-breaker (oldest createdAt), non-expiring lots last (via the
 * $ifNull sentinel, which sorts after every real date).
 */
async function pickNextLot(userId: string | mongoose.Types.ObjectId) {
  const [lot] = await DamruTransaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), type: "credit", remainingAmount: { $gt: 0 } } },
    { $addFields: { _sortKey: { $ifNull: ["$expiresAt", FAR_FUTURE] } } },
    { $sort: { _sortKey: 1, createdAt: 1 } },
    { $limit: 1 },
  ]);
  return (lot as { _id: mongoose.Types.ObjectId; remainingAmount: number } | undefined) || null;
}

async function releaseLots(allocations: IDamruAllocation[]): Promise<void> {
  for (const a of allocations) {
    await DamruTransaction.updateOne({ _id: a.creditTransactionId }, { $inc: { remainingAmount: a.amount } });
  }
}

export interface AllocationResult {
  success: boolean;
  allocations: IDamruAllocation[];
  /** Portion of `amount` that could not be attributed to a tracked lot — always 0 after migration; see module docs. */
  untrackedAmount: number;
  newBalance?: number;
  error?: string;
}

/**
 * Atomically debits `amount` from the user's wallet AND allocates it against
 * their oldest-expiring lots (FEFO+FIFO). The wallet decrement is guarded
 * exactly like the pre-lot-architecture code (`damruBalance: {$gte: amount}`)
 * so the "never overspend" invariant is unchanged.
 *
 * Ordering is deliberately LOT-CLAIM-FIRST, wallet-decrement-second (mirroring
 * processExpiredDamru's own claim-then-account order), not the other way
 * round. An earlier version decremented the wallet first and only then walked
 * lots — that made it possible for a redemption and a concurrent expiry run to
 * both "win" against the same lot's Damru: expiry claims the lot atomically
 * and unconditionally decrements the wallet for what it claimed, so if
 * redemption's wallet decrement had ALREADY happened first (independently,
 * before either side touched the lot), the wallet would be decremented twice
 * for the same underlying Damru, going negative. Claiming lots first — the
 * same atomic per-document guard expiry uses — means only one of the two can
 * ever win a given lot; whichever loses simply finds nothing left to claim.
 * See tests/damruExpiryConcurrency.test.ts's "redemption vs expiry" case.
 *
 * Graceful degradation: if tracked lots don't cover the full amount (a user
 * with legacy pre-migration balance, or a user redeeming faster than lots were
 * ever created for), the shortfall is returned as `untrackedAmount` rather than
 * failing the debit — Damru redemption must keep working regardless of
 * migration status (see docs/DAMRU_EXPIRY_SYSTEM.md's rollout section). The
 * caller is expected to insert its own debit ledger transaction after this
 * returns success; on failure to do so it MUST call releaseAllocation() to
 * roll back both the wallet and any lot claims already made.
 */
export async function allocateDebit(
  userId: string | mongoose.Types.ObjectId,
  amount: number,
  extraWalletInc: Record<string, number> = {}
): Promise<AllocationResult> {
  await connectDB();
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, allocations: [], untrackedAmount: 0, error: "Invalid amount." };
  }

  const allocations: IDamruAllocation[] = [];
  let remaining = amount;
  const MAX_LOT_CLAIMS = 1000; // defensive bound — no real user has anywhere near this many active lots

  for (let i = 0; i < MAX_LOT_CLAIMS && remaining > 0; i++) {
    const lot = await pickNextLot(userId);
    if (!lot) break; // no more tracked lots — remainder is untracked legacy balance

    const claim = Math.min(remaining, lot.remainingAmount);
    const claimed = await DamruTransaction.findOneAndUpdate(
      { _id: lot._id, remainingAmount: { $gte: claim } },
      { $inc: { remainingAmount: -claim } },
      { new: true }
    );
    if (!claimed) continue; // lost a race for this lot to a concurrent debit/expiry — repick and retry

    allocations.push({ creditTransactionId: lot._id, amount: claim });
    remaining -= claim;
  }

  // The wallet decrement is for the FULL requested amount (not just what was
  // lot-claimed) — untrackedAmount is expected to come out of the wallet too,
  // it just isn't attributed to a specific lot. This guard is what still
  // rejects a genuinely-insufficient balance, and what closes the race
  // described above against a concurrent expiry run on the same lot(s).
  const user = await User.findOneAndUpdate(
    { _id: userId, damruBalance: { $gte: amount } },
    { $inc: { damruBalance: -amount, ...extraWalletInc } },
    { new: true }
  );
  if (!user) {
    if (allocations.length > 0) await releaseLots(allocations);
    return { success: false, allocations: [], untrackedAmount: 0, error: "Insufficient Damru balance." };
  }

  return { success: true, allocations, untrackedAmount: remaining, newBalance: user.damruBalance };
}

/** Rolls back a successful allocateDebit() when the caller's own subsequent step (ledger insert) fails. */
export async function releaseAllocation(
  userId: string | mongoose.Types.ObjectId,
  allocations: IDamruAllocation[],
  totalAmount: number,
  extraWalletInc: Record<string, number> = {}
): Promise<void> {
  await connectDB();
  await releaseLots(allocations);
  await User.updateOne({ _id: userId }, { $inc: { damruBalance: totalAmount, ...extraWalletInc } });
}

export interface ExpiringSummary {
  enabled: boolean;
  expiringSoonAmount: number;
  nearestExpiryDate: Date | null;
  warningDays: number;
}

/**
 * Dashboard summary. Deliberately computed from ACTUAL lot data regardless of
 * the current `expiryEnabled` flag — if expiry was later disabled (section 41),
 * already-assigned expiry dates are not cancelled, so a customer with real
 * expiring lots must still be warned. `enabled` is returned separately as
 * display context for the frontend, not as a gate on the numbers themselves.
 */
export async function getExpiringSummary(
  userId: string | mongoose.Types.ObjectId,
  config: Pick<DamruConfigValues, "expiryEnabled" | "expiryWarningDays">
): Promise<ExpiringSummary> {
  await connectDB();
  const warningCutoff = new Date(Date.now() + config.expiryWarningDays * 24 * 60 * 60 * 1000);

  const [agg] = await DamruTransaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "credit",
        remainingAmount: { $gt: 0 },
        expiresAt: { $ne: null, $lte: warningCutoff },
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingAmount" }, nearest: { $min: "$expiresAt" } } },
  ]);

  return {
    enabled: config.expiryEnabled,
    expiringSoonAmount: agg?.total || 0,
    nearestExpiryDate: agg?.nearest || null,
    warningDays: config.expiryWarningDays,
  };
}

export interface ExpiryBreakdown {
  next30Days: number;
  next60Days: number;
  later: number;
  neverExpires: number;
}

/** Grouped, customer-safe expiry buckets for GET /api/rewards/expiry — no internal lot IDs exposed. */
export async function getExpiryBreakdown(userId: string | mongoose.Types.ObjectId): Promise<ExpiryBreakdown> {
  await connectDB();
  const now = Date.now();
  const in30 = new Date(now + 30 * 24 * 60 * 60 * 1000);
  const in60 = new Date(now + 60 * 24 * 60 * 60 * 1000);

  const rows = await DamruTransaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), type: "credit", remainingAmount: { $gt: 0 } } },
    {
      $project: {
        remainingAmount: 1,
        bucket: {
          $switch: {
            branches: [
              { case: { $eq: ["$expiresAt", null] }, then: "never" },
              { case: { $lte: ["$expiresAt", in30] }, then: "next30" },
              { case: { $lte: ["$expiresAt", in60] }, then: "next60" },
            ],
            default: "later",
          },
        },
      },
    },
    { $group: { _id: "$bucket", total: { $sum: "$remainingAmount" } } },
  ]);

  const result: ExpiryBreakdown = { next30Days: 0, next60Days: 0, later: 0, neverExpires: 0 };
  for (const r of rows as { _id: string; total: number }[]) {
    if (r._id === "next30") result.next30Days = r.total;
    else if (r._id === "next60") result.next60Days = r.total;
    else if (r._id === "later") result.later = r.total;
    else if (r._id === "never") result.neverExpires = r.total;
  }
  return result;
}

/**
 * Atomically claims ONE due lot for expiry: guarded on remainingAmount>0 AND
 * expiryProcessedAt being unset, so this can never double-process a lot even
 * under concurrent cron runs, and can never race a concurrent redemption/admin
 * debit claiming from the same lot (whichever write reaches MongoDB first wins;
 * the loser's conditional filter simply matches zero documents). Returns the
 * PRE-update document so the caller knows exactly how much was claimed.
 */
async function claimExpiredLot(now: Date, userId?: string | mongoose.Types.ObjectId) {
  const filter: Record<string, unknown> = { type: "credit", expiresAt: { $ne: null, $lte: now }, remainingAmount: { $gt: 0 }, expiryProcessedAt: null };
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
  return DamruTransaction.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          expiredAmount: { $add: [{ $ifNull: ["$expiredAmount", 0] }, "$remainingAmount"] },
          remainingAmount: 0,
          expiryProcessedAt: now,
        },
      },
    ],
    { new: false, updatePipeline: true }
  );
}

export interface ExpiryBatchResult {
  processedLots: number;
  totalExpired: number;
}

/**
 * Run by the daily rewards scheduler (see app/api/internal/rewards/run-scheduler).
 * Processes up to `maxLots` due lots per invocation via the atomic per-lot claim
 * above — this IS the batching strategy (each claim is a small, indexed,
 * single-document operation; nothing is ever loaded in bulk into memory), and it
 * is what makes the operation safe without a multi-document transaction. Fully
 * idempotent: a lot claimed by a prior run has remainingAmount=0 and
 * expiryProcessedAt set, so it no longer matches claimExpiredLot's filter.
 *
 * `userId` is an optional scoping filter — the production cron always omits it
 * (global sweep); it exists so tests can exercise this function against one
 * fixture's lots without racing other test files' due lots in the same
 * shared database (see tests/damruExpiry.test.ts).
 */
export async function processExpiredDamru(maxLots = 5000, userId?: string | mongoose.Types.ObjectId): Promise<ExpiryBatchResult> {
  await connectDB();
  const now = new Date();
  let processedLots = 0;
  let totalExpired = 0;

  for (let i = 0; i < maxLots; i++) {
    const lot = await claimExpiredLot(now, userId);
    if (!lot) break;

    const claimedAmount = lot.remainingAmount ?? 0;
    if (claimedAmount <= 0) continue; // defensive — remainingAmount>0 was already required to match

    const idempotencyKey = `damru-expiry:${lot._id}`;
    let transaction;
    try {
      transaction = await DamruTransaction.create({
        userId: lot.userId,
        type: "debit",
        category: "expiry",
        amount: claimedAmount,
        balanceAfter: 0, // patched below
        description: "Damru Expired",
        idempotencyKey,
        allocations: [{ creditTransactionId: lot._id, amount: claimedAmount }],
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) continue; // already fully recorded by a prior run — lot claim was a safe no-op
      // Genuine failure after the lot was claimed but before it was ever
      // recorded — roll the claim back so the next run retries this lot.
      await DamruTransaction.updateOne(
        { _id: lot._id },
        { $set: { remainingAmount: claimedAmount, expiryProcessedAt: null }, $inc: { expiredAmount: -claimedAmount } }
      );
      throw err;
    }

    const user = await User.findByIdAndUpdate(lot.userId, { $inc: { damruBalance: -claimedAmount } }, { new: true });
    if (user) {
      transaction.balanceAfter = user.damruBalance;
      await transaction.save();
    }

    await notifyRewardEvent({
      userId: lot.userId,
      type: "DAMRU_EXPIRED",
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount: claimedAmount,
      route: "/my-profile?tab=rewards",
    });

    processedLots++;
    totalExpired += claimedAmount;
  }

  return { processedLots, totalExpired };
}

/**
 * Fixed 30/7/1-day warning windows (PRD 4B v2 section 70/45) — a product
 * default, not admin-configurable per-window (the dashboard's own
 * `expiryWarningDays` from PRD 4A remains a separate, independently
 * configurable "what counts as expiring soon for display" threshold).
 */
const EXPIRY_WARNING_WINDOWS_DAYS = [30, 7, 1] as const;

export interface ExpiryWarningResult {
  warningsCreated: number;
}

/**
 * Run by the daily rewards scheduler. For each window, finds lots that have
 * newly entered it (expiresAt within the window, not yet expired) and fires
 * notifyRewardEvent — its own dedupKey (`expiry-warning:{lotId}:{days}d`)
 * guarantees each lot is warned AT MOST ONCE per window, no matter how many
 * times the scheduler runs (section 21/46). Bounded and indexed — reuses the
 * same `{expiresAt, remainingAmount}` index processExpiredDamru relies on,
 * never scans full lifetime history (section 45).
 */
export async function generateExpiryWarnings(maxLotsPerWindow = 2000): Promise<ExpiryWarningResult> {
  await connectDB();
  const now = new Date();
  let warningsCreated = 0;

  for (const days of EXPIRY_WARNING_WINDOWS_DAYS) {
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const lots = await DamruTransaction.find({
      type: "credit",
      remainingAmount: { $gt: 0 },
      expiresAt: { $ne: null, $gt: now, $lte: cutoff },
    })
      .select("userId remainingAmount expiresAt")
      .limit(maxLotsPerWindow)
      .lean<{ _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; remainingAmount: number; expiresAt: Date }[]>();

    for (const lot of lots) {
      const result = await notifyRewardEvent({
        userId: lot.userId,
        type: "DAMRU_EXPIRING_SOON",
        sourceId: lot._id,
        sourceType: "DamruTransaction",
        amount: lot.remainingAmount,
        expiresAt: lot.expiresAt,
        dedupSuffix: `${days}d`,
        route: "/my-profile?tab=rewards",
      });
      if (result.success && !result.duplicate) warningsCreated++;
    }
  }

  return { warningsCreated };
}

export interface ReconcileMismatch {
  userId: string;
  balance: number;
  lotSum: number;
  diff: number;
}

export interface ReconcileResult {
  checked: number;
  mismatches: ReconcileMismatch[];
}

/**
 * Diagnostic only — never auto-corrects a balance. Intended to be run AFTER
 * the legacy-balance migration (scripts/migrate-damru-expiry-lots.ts); before
 * migration, every user with un-migrated legacy Damru will legitimately show
 * as a "mismatch" here since lots simply don't exist for them yet — that is
 * expected, not a bug, and is exactly what the migration exists to close.
 */
export async function reconcileDamruLots(userId?: string | mongoose.Types.ObjectId): Promise<ReconcileResult> {
  await connectDB();
  const filter = userId ? { _id: new mongoose.Types.ObjectId(userId) } : {};
  const users = await User.find(filter).select("_id damruBalance").lean<{ _id: mongoose.Types.ObjectId; damruBalance: number }[]>();

  const mismatches: ReconcileMismatch[] = [];
  for (const u of users) {
    const [agg] = await DamruTransaction.aggregate([
      { $match: { userId: u._id, type: "credit", remainingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
    ]);
    const lotSum = agg?.total || 0;
    if (u.damruBalance !== lotSum) {
      mismatches.push({ userId: String(u._id), balance: u.damruBalance, lotSum, diff: u.damruBalance - lotSum });
    }
  }
  return { checked: users.length, mismatches };
}
