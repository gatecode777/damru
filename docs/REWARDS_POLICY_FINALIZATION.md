# PRD 4H — Rewards Policy Finalization & Automated Clawback

## Summary

This document records the finalized business policies and implementation for Damru's deferred reward clawback behaviors. All policies make reward behavior **deterministic** when underlying customer activity later becomes invalid.

---

## Implemented Policies

### 1. Partial-Refund Reward Reversal

**Policy**: When a Razorpay order is partially refunded, the order reward (and any campaign bonus) is proportionally reversed using the formula:
```
targetReversal = originalReward - floor(remainingEligibleAmount / 10)
additionalReversal = clamp(targetReversal - alreadyReversed, 0, remaining)
```
Campaign rewards in `FIXED_DAMRU` mode are fully reversed on any refund. `PERCENT_BONUS` and `MULTIPLIER` campaigns are scaled proportionally.

**Idempotency key**: `reward-reversal:{originalTxId}:{refundId}` (one reversal per refund event per original credit).

**Entry point**: `lib/rewards/recomputeEntitlements.ts` → `recomputeRewardEntitlements({ trigger: "REFUND_PROCESSED" })`.

---

### 2. First-Order Reward Requalification

**Policy**: If the order that earned a customer's first-order reward is fully refunded or cancelled, the reward is reversed and the **next** earliest eligible delivered order (if any) is awarded the first-order reward with a fresh idempotency key (`first_order_requalified:{userId}:{triggerId}`).

**Entry point**: `lib/rewards/recomputeEntitlements.ts` → `recomputeFirstOrder`.

---

### 3. Referral Reward Clawback

**Policy**: If a `REWARDED` referral's qualification order is fully refunded or cancelled:
1. Both the referrer reward and referred user reward are reversed.
2. The `Referral` document transitions to `INVALIDATED` (not deleted — audit trail preserved).
3. A requalification attempt runs immediately against the referred user's remaining eligible orders.
4. Requalification is allowed once per invalidation event (`requalificationCount` increments each time, feeding the risk engine).

**Idempotency**: compound unique index on `(originalTransactionId, triggerId)` in `RewardReversal`.

**Entry point**: `lib/referralEngine.ts` → `evaluateReferralClawback` + `evaluateReferralRequalification`.

---

### 4. Mission Progress Recomputation

**Policy**: When a full-order invalidation occurs:
- All `CLAIMED`, non-revoked `ORDER_COUNT` and `SPENDING_AMOUNT` UserMissions with `isReversible: true` are checked.
- The true progress is recomputed excluding the invalidated order.
- Any mission whose progress has fallen below its target has its reward reversed.
- The `UserMission` record is marked `isRevoked: true` (record preserved, not deleted).

**Non-reversible missions** (`LOGIN_STREAK`, `PROFILE_COMPLETE`) are skipped — set `isReversible: false` on those mission configs.

**Entry point**: `lib/missionEngine.ts` → `recomputeMissionProgress`.

---

### 5. Achievement Revocation

**Policy**: After any full-order invalidation, `ORDER_COUNT` and `LIFETIME_SPEND` achievements with `isReversible: true` are re-evaluated against current valid order counts. Any `CLAIMED` achievement whose metric has regressed below threshold has its reward reversed and is marked `isRevoked: true`.

**Entry point**: `lib/achievementEngine.ts` → `recomputeAchievementProgress`.

---

### 6. Loyalty Tier Downgrade

**Policy**: `evaluateLoyaltyTier` is called with `issueBonus: false` after every invalidation event. If the user's computed tier is lower than their stored tier, the tier record is updated and a `LOYALTY_TIER_DOWNGRADED` in-app notification is sent.

**Q1 Policy Resolution**: Tier upgrade bonuses (Damru issued at the time of upgrade) are **permanent — not reversed** on downgrade. This is a one-time incentive, not a recurring benefit.

**Entry point**: `lib/loyaltyEngine.ts` → `evaluateLoyaltyTier({ issueBonus: false })`.

---

### 7. Branch Campaign Consistency

Campaigns with `isActive: false` or expired `endsAt` are excluded at issuance time by `campaignEngine.ts`. No new policy change required — this was already enforced.

---

## Schema Changes

| Model | Change |
|---|---|
| `RewardReversal` | Removed unique on `originalTransactionId`; added `triggerId` (required), `partialAmount`; compound unique on `(originalTransactionId, triggerId)` |
| `Referral` | Added `INVALIDATED`, `REQUALIFIED` statuses; `invalidatedAt`, `invalidationOrderId`, `invalidationReason`, `requalificationCount` |
| `Mission` | Added `isReversible: boolean` (default `true`) |
| `Achievement` | Added `isReversible: boolean` (default `true`) |
| `UserMission` | Added `isRevoked`, `revokedAt`, `revokedTransactionId` |
| `UserAchievement` | Added `isRevoked`, `revokedAt`, `revokedTransactionId` |
| `Notification` | Added `LOYALTY_TIER_DOWNGRADED`, `MISSION_PROGRESS_ADJUSTED` types |

---

## New Files

- `lib/rewards/recomputeEntitlements.ts` — orchestrator, runs all 6 sub-policies in parallel, failure-isolated, idempotent.

## Modified Files

- `lib/rewards/reversalEngine.ts` — `applyPartialReversal`, `getTotalReversedAmount`, `calculatePartialReversalAmount`, removed `calculatePostRefundEligibility` stub.
- `lib/rewardEngine.ts` — `checkAndAwardFirstOrderReward` accepts `options.requalificationSuffix`.
- `lib/referralEngine.ts` — `evaluateReferralClawback`, `evaluateReferralRequalification`.
- `lib/missionEngine.ts` — `recomputeMissionProgress`.
- `lib/achievementEngine.ts` — `recomputeAchievementProgress`.
- `lib/loyaltyEngine.ts` — downgrade detection, tier rank tracking, `LOYALTY_TIER_DOWNGRADED` notification.
- `lib/payments/refunds.ts` — `finalizeRefund` calls orchestrator for both partial and full paths.
- `app/actions/orders.ts` — `cancelOrder` and `updateOrderStatus` (cancelled branch) call orchestrator.
- `lib/notifications/notificationTemplates.ts` — `LOYALTY_TIER_DOWNGRADED`, `MISSION_PROGRESS_ADJUSTED` copy.

---

## Idempotency Contract

Every financial write in this system is keyed by `triggerId`:
- `REFUND_PROCESSED`: `String(refund._id)`
- `ORDER_CANCELLED`: `` `cancel:${orderId}` ``

Replaying the same triggerId is always a safe no-op — all `RewardReversal` inserts use a compound unique index on `(originalTransactionId, triggerId)`, and `DamruTransaction` inserts use `idempotencyKey`.

---

## Migration Notes for Existing Data

- **`RewardReversal`**: The old unique index on `originalTransactionId` must be dropped and replaced with the compound unique on `(originalTransactionId, triggerId)`. A migration script should backfill `triggerId` on existing rows using their `idempotencyKey` (which already contains the trigger suffix after the colon).
- **`Mission.isReversible`**: Defaults `true`. Admins should set `isReversible: false` on `LOGIN_STREAK` and `PROFILE_COMPLETE` missions via the admin panel to prevent spurious clawback attempts on non-reversible mission types.
- **`Achievement.isReversible`**: Same — set `false` on `LOGIN_STREAK`, `PROFILE_COMPLETE`, `ACCOUNT_AGE_DAYS` achievements.
