# Damru Rewards Risk and Abuse Monitoring

## Architecture

The risk layer is a deterministic, server-side detection and admin-review system. `lib/rewards/riskEngine.ts` consumes authoritative records from the existing wallet, order, refund, reversal, referral, campaign, and admin-adjustment systems. It writes `RewardRiskEvent` records but never changes rewards, orders, accounts, payments, or login access.

Risk evaluation runs after a financial action succeeds and is wrapped by `evaluateRiskSafely()`. A detection failure is logged and cannot roll back or fail the completed financial action. All queries use bounded windows; no startup or request performs an unbounded historical scan.

## Supported signals

- Reward earning amount, count, source mix, and promotional share over 24 hours.
- Redemption amount, count, and proximity to promotional credits over one hour.
- Processed-refund frequency, value, related redemptions, reward reversals, and reward debt over 30 days.
- Order cancellation ratio and cancellation-related reversals over 30 days.
- Current reward debt and applied reversal frequency over 30 days.
- Referral relationships created and qualified/rewarded over seven days.
- Campaign award count, issued promotional amount, and campaign reversal frequency over 24 hours.
- Manual credit/debit amount and velocity by affected user and acting administrator over 24 hours.
- Mission reward completion count and issued amount over 24 hours, while preserving mission progress.
- Achievement structural protection through the existing per-user unique achievement record and idempotent reward key.

## Partially supported signals

- Refund analysis covers authoritative, processed Razorpay refunds. Cash returned outside the payment-refund model cannot be measured reliably.
- Referral-network analysis covers stored relationships, qualification, reward issuance, and reversal history, but not cross-account identity graphs.
- Loyalty risk context can be inferred from qualifying orders, refunds, reversals, and debt. Automatic loyalty downgrade/clawback is intentionally a separate product policy.
- Mission velocity is measured from authoritative mission reward transactions; mission progress is not modified or clawed back by a risk alert.

## Unsupported signals

The application does not authoritatively collect device fingerprints, durable login IP history, household identity, contacts, or location telemetry. The risk system therefore does not claim shared-device, shared-network, or household fraud. Self-referral is blocked only when the two account IDs are identical; broader identity equivalence is unsupported. Payment-card or UPI credentials are never collected by this module. A phone number's presence is not treated as OTP-verified identity because durable phone-verification state is not available.

## Scoring

Scores are deterministic review-priority indicators, not proof:

```text
0-29   LOW
30-59  MEDIUM
60-79  HIGH
80-100 CRITICAL
```

Each rule adds documented points for observed threshold crossings, and `calculateRiskScore()` bounds the result to 0–100. The user summary uses the strongest active event plus a small bounded multi-signal uplift; it does not add scores without limit.

## Thresholds and risk rules

All defaults live in `lib/rewards/riskConfig.ts` rather than individual routes. Authorized admins can update validated numeric thresholds from `/admin/rewards/risk`; the singleton `RewardRiskConfig` document stores overrides and every update is added to the existing admin audit log. Invalid, non-finite, negative, out-of-range, and unordered score values are rejected. Current defaults are:

- Earning: 5,000 Damru plus either 10 credits or 3,000 promotional Damru in 24 hours.
- Redemption: three redemptions, or at least two totalling 3,000 Damru, in one hour.
- Earn/redeem/refund: at least two processed refunds, two reward reversals, and 100 Damru redeemed in 30 days.
- Refund: at least three orders, a 50% refunded-order ratio, and Rs 1,000 refunded in 30 days.
- Cancellation: at least four orders and a 60% cancellation ratio in 30 days.
- Reversal frequency: three reversals, 500 reversed Damru, or a 50% reversal-to-issuance ratio after at least 500 Damru was issued, in 30 days.
- Debt: 500 Damru debt, or positive debt with three reversals in 30 days.
- Referral: 10 relationships created or five qualified/rewarded in seven days.
- Campaign: eight awards, 5,000 promotional Damru, or three campaign reversals in 24 hours.
- Mission: five mission rewards or 2,500 mission Damru in 24 hours.
- Admin adjustment: five adjustments or 5,000 Damru for one user, or 20 actions by one admin, in 24 hours.

Changing thresholds is a permission-protected financial-control operation. Saved settings apply to future evaluations; historical events retain their detected evidence. The dashboard exposes observed reasons and configuration only to admins, never to customers.

## Refund and cancellation abuse

Only confirmed `PaymentRefund.status = processed` records count as refunds. Requested or failed refunds do not create refund-abuse evidence. The refund ratio denominator is restricted to recently delivered, paid/refunded eligible orders, preventing pending or failed orders from distorting the ratio. A separate high-priority rule records repeated earn → redeem → refund → reversal/debt sequences and their earned, redeemed, refunded, reversed, and debt amounts. Cancellation monitoring uses actual `Order.status = cancelled` records and distinguishes occasional cancellation from repeated high-ratio behavior.

No refund or cancellation is blocked by a risk event.

## Referral abuse

Referral velocity uses the indexed `referrerUserId`, relationship creation timestamps, qualification status, and qualification timestamps. It never deletes or rewrites referral history. Identical account IDs are already rejected by referral validation; stronger self-referral claims are unsupported without reliable identity signals.

## Campaign abuse

Campaign monitoring reads `RewardCampaignUsage`, campaign ledger credits, and campaign-linked reversals. Existing atomic global budget, per-user cap, per-event cap, and stacking enforcement remain authoritative and unchanged. Risk review never reopens or alters campaign budgets or usage history.

## Reward debt monitoring

`User.rewardDebt` and `RewardReversal` are monitored as evidence. Detection never clears, increases, or otherwise modifies debt. Future earnings continue to recover debt only through the existing reversal/debt-recovery engine.

## Reward reversal monitoring

Every successfully applied reversal triggers a failure-isolated evaluation of bounded 30-day frequency, total reversed Damru, reversal-to-issued ratio, reasons, and debt creation. The reversal remains authoritative even if evaluation fails. The risk system does not create, retry, or undo a reversal.

## Daily streak, missions, achievements, and loyalty

- Daily streak requests are protected by an atomic `lastEligibleActivityDate` guard plus a per-user/day ledger idempotency key. Repeated clicks, refreshes, website/mobile retries, and concurrent claims converge on one award.
- Mission events use a unique event key, user/mission/period uniqueness, and an idempotent reward key.
- Achievement records are unique per user/achievement and award keys are idempotent.
- Loyalty assignment and bonuses reuse existing logic. Risk alerts may provide refund/reversal context but never downgrade a tier.

## Admin adjustment monitoring

The ledger's `adjustedBy`, `admin_credit`, and `admin_debit` records support internal financial-control alerts. Authorized adjustments still complete normally. A risk alert does not remove admin permissions or reverse a transaction.

## Deduplication and concurrency

Every alert uses a deterministic key:

```text
risk:{ruleCode}:{userId}:{periodKey}
```

`RewardRiskEvent.dedupeKey` is unique. Atomic upsert makes retries and concurrent evaluators converge on one event while increasing `occurrenceCount` and refreshing the latest evidence. Alerts are never created per API retry.

## Review workflow

Admins use `/admin/rewards/risk` to filter and search a bounded queue, inspect reasons and related financial activity, and choose:

- Mark Under Review
- Continue Monitoring
- Resolve as Legitimate
- Resolve with No Action
- Confirm Abuse
- Dismiss Alert

These decisions only update the risk record. Confirming abuse does not mutate a wallet. Any financial correction must be separately confirmed through the existing permission-protected Reward Reversal action.

## Permissions and audit

- Dashboard, queue, detail, and user-risk summary require `rewards.view`.
- Review mutations require `rewards.edit`.
- Risk configuration reads require `rewards.view`; updates require `rewards.edit`.
- Super Admin uses the existing explicit permission bypass.
- Every review mutation writes an `AdminAuditLog` containing previous status, new status, decision, note, target event, actor, and timestamp.
- Every configuration update records the previous and next validated thresholds in `AdminAuditLog`.
- Admin notes, reviewer identity, reasons, score, and thresholds are only returned by admin APIs. No customer route imports or serializes risk records.

## Risk analytics

Risk analytics are separated from issuance metrics and include open events, high/critical events, high-risk users, Damru associated with active alerts, reversed Damru associated with affected users, reward debt at risk, and referral/campaign/refund alert counts. The main Rewards Analytics view includes a distinct Risk Monitoring section; normal issuance totals remain unchanged.

## Privacy

Only existing transactional identifiers and aggregates are stored. Metadata contains counts, amounts, ratios, and bounded window definitions—not credentials, payment secrets, device fingerprints, contacts, exact location, or unrelated personal data. Customers receive no fraud notification or accusation.

## Operational response

1. Prioritize CRITICAL and HIGH events.
2. Review the human-readable reasons and bounded financial timeline.
3. Compare orders, processed refunds, reversals, referral records, and campaign usage.
4. Mark the event under review while investigating.
5. Resolve legitimate activity or dismiss a false positive with a clear note.
6. Confirm abuse only when evidence supports it.
7. If a reward is genuinely invalid, use the separate existing Reward Reversal workflow.

No account ban, login suspension, order cancellation, payment freeze, or wallet mutation is automatic.

## False positives

A high score may reflect legitimate bulk ordering, a promotion, a service recovery, or unusual but valid customer behavior. Scores prioritize attention only. Reviewers should use related business context before deciding. Dismissal and legitimate-resolution decisions preserve the evidence and financial history.

## Limitations and future hold architecture

- No device/IP/network relationship detection.
- No inferred household matching.
- No automated account ban or payment freeze.
- No automatic historical full-database scan.
- No automatic mission/achievement rollback.
- No automatic financial clawback from review actions.
- A future `Reward Pending` hold could delay promotional settlement, but current settlement semantics are intentionally unchanged.

## Troubleshooting

- **No alert after a failed refund:** expected; only processed refunds are authoritative.
- **Repeated evaluation has one row:** expected; inspect `occurrenceCount` and `lastDetectedAt`.
- **No referral alert:** confirm the user is the `referrerUserId` and records fall within seven days.
- **No campaign alert:** confirm usage is RESERVED/AWARDED and ledger credits are campaign-category records within 24 hours.
- **Risk evaluation error in logs:** the financial action remains committed; safely retry evaluation for the same source/period.
- **Review action returns 403:** the admin needs `rewards.edit`, not only `rewards.view`.
- **Closed event cannot be edited:** resolved/dismissed decisions are immutable through the review API; use audit-guided operational correction if necessary.
