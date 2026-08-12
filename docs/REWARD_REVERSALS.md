# Damru Reward Reversals

## Accounting model

Reward credits are immutable. When a previously valid reward becomes invalid, Damru creates a separate `reward_reversal` debit linked to the original credit through `originalTransactionId`. The reversal records the original category, source, order/refund/campaign references, reason, actor, and resulting wallet balance.

Example:

```text
+100 order_reward
-100 reward_reversal
```

`RewardReversal` is the exactly-once reservation and audit record. Its unique `originalTransactionId` prevents all triggers combined from reversing the same credit more than once.

## Reversal triggers

- An existing order cancellation invokes the engine with `ORDER_CANCELLED`.
- A confirmed full refund invokes it with `FULL_REFUND` from the shared refund finalizer.
- Duplicate cancellation, refund webhook, and refund reconciliation calls safely replay the same engine.
- Failed and merely requested refunds do not invoke refund-triggered reversal.
- An authorized administrator may reverse a selected original credit using `ADMIN_CORRECTION` and a required note.
- `PAYMENT_REVERSED`, `FRAUD_CONFIRMED`, and `OTHER` are supported engine reasons for an approved caller; fraud detection is outside this module.

## Supported reward types

Automatic order reversal supports indexed, directly order-linked credits:

- `order_reward`
- `campaign`
- `first_order`

Birthday, anniversary, daily streak, profile, account-age, and other unrelated rewards are never selected. Historical or other credits without a reliable order reference are not guessed.

## Campaign reversal

Campaign credits are reversed independently from base order rewards. Original campaign transactions, `RewardCampaignUsage`, per-user usage, and campaign budgets remain unchanged. Campaign analytics therefore represent gross issuance, reversed issuance, and net issuance. A clawback never reopens an expired or exhausted campaign budget.

## Refund integration

`finalizeRefund()` invokes `reverseOrderRewards()` only after a full refund reaches `processed`. The already-processed path deliberately replays idempotent restoration, reversal, and notification work so a crash or missed webhook can be reconciled safely. Partial refunds do not reverse rewards pending an approved remaining-eligibility policy.

## Cancellation integration

The existing customer/API and admin order cancellation flows invoke the same `reverseOrderRewards()` implementation after the order is cancelled. Cancelling before reward issuance is a no-op. Repeating cancellation after issuance is safe.

## Idempotency and concurrency

- Reversal request key: `reward-reversal:{originalTransactionId}:{triggerId}`.
- Reversal ledger key: `reward-reversal:{originalTransactionId}`.
- A unique index on `RewardReversal.originalTransactionId` is the cross-trigger concurrency boundary.
- The original credit amount is backend-derived; callers cannot supply an arbitrary reversal amount.
- A second cancellation, refund, webhook, reconciliation, or admin retry returns the existing reservation/reversal.

## Insufficient balance and debt recovery

Damru uses reward debt rather than negative customer balances. If 100 Damru must be reversed and only 30 remains, the wallet reaches 0 and `User.rewardDebt` becomes 70. The reversal record preserves `walletAmount: 30` and `debtAmount: 70`; the ledger still records the full 100 adjustment.

Future credits remain auditable as gross rewards. A separate `reward_debt_recovery` debit consumes the lesser of the new credit, wallet balance, and debt. The remaining earned amount stays in the wallet. Frontends only display backend-provided debt and never calculate it.

## First-order policy

An existing order-linked first-order reward is reversed when its order is fully cancelled or refunded. Later requalification is deferred: the current permanent `first_order_{userId}` idempotency key cannot safely represent a second qualifying order without changing product semantics and migration rules.

## Referral implications

Referral relationships and rewards are preserved. The current data does not reliably prove that a particular refunded order was the referral qualification event, so automatic referral clawback is deferred pending an explicit qualification/revocation policy and source linkage.

## Mission implications

Mission progress and rewards are preserved. Order-count or spend missions require recomputation from valid source events and an explicit policy for revoking a completed mission; blind progress decrement is not used.

## Achievement implications

Achievements are preserved. Order-dependent achievements need condition-specific recomputation and revocation rules. Non-order achievements such as profile, account age, and streak milestones remain unrelated to order reversals.

## Loyalty implications

Loyalty tier status and tier-up rewards are not automatically downgraded or reversed. These are separate product decisions and require explicit policy.

## Legacy handling

Automated matching requires a reliable indexed `orderId`. Legacy credits without that source mapping are reported as unsupported and require deliberate admin review of a selected original transaction. The system never scans or infers historical relationships by description or amount.

## Analytics

Rewards Analytics reports:

- Gross Issued: all normal issued reward credits, unchanged by reversal.
- Reward Reversed: `reward_reversal` debits.
- Net Issued: `Gross Issued - Reward Reversed`.
- Campaign Reversed: reversals whose original category was `campaign`.
- Order Reward Reversed: reversals whose original category was `order_reward` or `first_order`.
- Reward Debt: outstanding backend-authoritative debt, reported separately from wallet liability.

## Admin workflow

An administrator with mutation-level `rewards:edit` permission opens a credit transaction, selects **Reverse Reward**, enters the required reason note, and confirms the permanent adjustment. The backend reloads the original credit and computes the full reversible amount. The resulting reversal stores the actor and the existing Admin Audit Log records the action. `rewards:view` alone is insufficient.

## Customer UX

Website and mobile use the same reward dashboard/history API. History shows neutral labels such as `Reward Adjusted - Order #DMR... was refunded.` and debt recovery as Damru used to settle a prior reward adjustment. Internal notes, database IDs, and fraud details are never exposed. The existing notification system emits `REWARD_ADJUSTED`; sensitive reasons use neutral customer copy.

## Troubleshooting

- **No reversal after a requested refund:** expected; wait for confirmed `processed` status.
- **No reversal after a failed refund:** expected; failed refunds do not claw back rewards.
- **No transaction selected:** verify the original credit has `type: credit`, a supported category, and the correct indexed `orderId`.
- **Duplicate trigger returns no new debit:** expected exactly-once behavior; inspect the existing `RewardReversal` by `originalTransactionId`.
- **Wallet is zero but reversal exceeds wallet:** inspect `User.rewardDebt` and the reversal's wallet/debt split.
- **Future reward is smaller than expected:** inspect the accompanying `reward_debt_recovery` transaction.
- **Partial refund:** intentionally unsupported until remaining-eligibility rules are approved.
- **First-order did not requalify:** requalification is intentionally deferred.

