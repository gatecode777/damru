# Damru Rewards Production Readiness

Audit date: 12 August 2026  
Overall status: **READY WITH BLOCKERS**

This report audits the existing rewards platform. It does not introduce a second wallet, ledger, reward engine, reversal engine, campaign engine, or risk engine.

## Launch decision

The locally audited rewards and financial-integrity paths are suitable for release after the production blockers below are cleared. A full launch must not be represented as complete today because the deployed campaign endpoint is missing, real Razorpay test-mode payment/refund execution is unavailable, and registration currently awards/signs in a user before email verification.

## Architecture summary

- `User.damruBalance` is the authoritative current wallet balance.
- `DamruTransaction` is the append-only financial ledger and owns globally unique idempotency keys.
- `rewardEngine` owns issuance, redemption, adjustment, and reward eligibility.
- `damruAllocation` owns FEFO/FIFO lot consumption, expiry, rollback of failed allocations, and lot reconciliation.
- `reversalEngine` preserves original credits, creates separate reversal debits, creates Reward Debt when the wallet is insufficient, and recovers debt from later credits.
- `campaignEngine` owns eligibility, stacking, event/user/global caps, budget reservation, and campaign issuance.
- `riskEngine` is detection-only: detect, score, flag, and review. It does not auto-ban or silently change wallet state.
- Razorpay client verification, webhook processing, and reconciliation converge on the same payment finalizer.
- Website and mobile clients consume backend reward APIs; neither duplicates financial reward calculations.

## Complete reward lifecycle

1. Registration creates the customer and optional referral relationship.
2. Welcome reward uses the central Reward Engine and a user-scoped idempotency key.
3. Login/current-user activity performs the daily check-in through the backend; the date lock and ledger idempotency key prevent duplicate streak rewards.
4. Cart and checkout send intent only. The backend resolves prices, coupon usage, delivery, tax, Damru redemption, and payable amount.
5. COD orders can enter fulfilment. Online orders remain pending until server-side Razorpay signature/webhook/reconciliation confirms payment.
6. Only delivered COD or server-confirmed paid online orders can issue base, first-order, campaign, mission, achievement, referral, and loyalty effects.
7. Cancellation/refund paths preserve original transactions and use restoration/reversal engines.
8. If a clawback exceeds the wallet, the remainder becomes Reward Debt and later credits recover it idempotently.
9. Notifications and analytics consume completed authoritative events; risk evaluation failure is isolated from financial success.

Known lifecycle exception: there is no registration email-verification state or gate. Registration currently creates a session and issues the welcome reward immediately. This is a production blocker for the PRD's required registration-to-verification journey.

## Event map

| Event | Authoritative handler | Financial/derived effects |
| --- | --- | --- |
| Registration | `POST /api/user/register` | Referral association, referral code, welcome reward, session |
| Login/current-user activity | user login/me routes | Daily check-in, streak, eligible occasion processing |
| Delivered order | admin order action | Base/first-order/campaign rewards, missions, achievements, referral, loyalty, notification, risk |
| Redemption | Reward Engine + allocation service | Atomic guarded wallet debit, FEFO allocations, ledger debit |
| Payment success | shared Razorpay finalizer | Paid/confirmed state and payment/order notifications |
| Payment failure | shared payment failure handler | Pending/failed state and retry notification |
| Payment reconciliation | reconciliation service | Trusted gateway state applied through shared finalizer |
| Cancellation | customer/admin cancellation | Coupon release, eligible Damru restore, reward reversal, debt/risk, notification |
| Refund processed | refund finalizer | Refund counters/status, Damru restore, full-refund reward reversal |
| Expiry | rewards scheduler | Atomic lot claim, wallet debit, expiry ledger entry, notification |
| Risk signal | Risk Engine | Admin-only review event; no automatic financial mutation |

## Financial invariants

- A reward-producing event must have one deterministic/unique idempotency key.
- Wallet debits use the central allocation service and cannot overspend.
- Original financial records are never deleted or rewritten to simulate a reversal.
- A reward reversal ledger debit records the full clawback; `RewardReversal.walletAmount` records the portion that actually touched the wallet and `debtAmount` records the shortfall.
- Refund restoration is a restoration credit, not new reward issuance.
- Legacy opening balance is explicitly represented when migrated and is excluded from period issuance analytics.
- Current liability is the sum of non-negative authoritative user balances multiplied by the configured redemption rate, not a naive period transaction sum.
- Online orders require backend-confirmed `paid` state before fulfilment or any order-derived reward. COD remains eligible at fulfilment.
- Reconciliation is diagnostic only and never changes balances.

`reconcileUserWallet` now provides a reusable read-only reconciliation for a user. It accounts for credits, legacy opening balance, ordinary debits, reversal wallet portions, Reward Debt, and debt-recovery transactions, and reports mismatches rather than repairing them.

## Validation matrix

| Area | Status | Evidence / limitation |
| --- | --- | --- |
| Existing regression suite | PASS | Baseline rerun completed 144/144 before changes |
| Added focused coverage | PASS | Payment eligibility, wallet/ledger reconciliation, and permission matrix |
| Duplicate rewards | PASS | Existing idempotency and retry tests |
| Concurrent rewards/redemption | PASS | Existing concurrency suite |
| Campaign budget concurrency | PASS | Existing campaign suite |
| Refund idempotency | PASS | Existing refund reservation/finalization tests |
| Reversal idempotency | PASS | Existing reversal suite |
| Reward Debt recovery | PASS | Existing reversal suite plus wallet reconciliation |
| Risk failure isolation | PASS | Controlled simulated risk failure preserves reward state |
| Customer risk privacy | PASS | Customer route source audit and regression coverage |
| Risk permission matrix | PASS | Customer/no-permission/view/edit/super-admin permission service matrix |
| Analytics formulas | PASS | Issuance excludes restore/expiry/redemption/legacy; liability uses authoritative balances |
| Real Razorpay payment/refund | BLOCKED | Local configuration is live mode; live money was not used |
| Physical Android/iOS runtime | BLOCKED | No device was available in this audit |

## Reward-system validation

- Welcome: unique user key prevents duplicate issuance; registration verification gate remains blocked.
- Daily check-in and streak: atomic date guard, deterministic period keys, retry/concurrency tests, Asia/Kolkata business dates.
- Occasions: deterministic user/year idempotency keys and India calendar-date policy.
- Order and first-order rewards: paid/COD delivery filter is enforced in both the status transition and Reward Engine.
- Achievements, missions, referrals, and loyalty: delivered-order aggregates now exclude unpaid online orders.
- Campaigns: fixed/multiplier/percentage math, stacking modes, event/user/global caps, concurrency, pause/resume/cancel, and duplicate evaluation are covered by the campaign suite. Order-triggered campaign issuance re-checks the authoritative order and payment state.
- Coupons plus Damru: coupon reservation/release and backend quote/order math are authoritative; concurrent coupon limits are tested.
- Expiry: FEFO/FIFO allocation, concurrent expiry/redemption, warnings, migration, and default-off configuration are tested.

## Website validation

- Rewards dashboard/history/coupons/upcoming/missions/achievements/referrals/loyalty/expiry use backend APIs.
- Reward Debt and expiry messaging are displayed without exposing risk events.
- Checkout uses backend quotes and stored payable amounts.
- Razorpay failure UI supports retry and does not confirm an unpaid order.
- Static/type/build validation is recorded in the final validation section.

## Mobile validation

- Mobile uses the same reward and notification endpoints as the website.
- Mobile does not calculate or issue rewards locally.
- The mobile reward transaction union now includes `campaign`, `reward_reversal`, and `reward_debt_recovery`; the coupon contract includes optional user ownership.
- Mobile TypeScript passes.
- Full mobile lint remains blocked by pre-existing unrelated errors; the PRD-modified mobile type file passes targeted root ESLint.
- Physical Expo/Android/iOS runtime validation was not possible without a device.

## Admin validation

- Reward configuration, users, campaigns, analytics, risk review, and audit logs are permission-gated in backend routes/actions.
- Risk list/detail/config routes require `rewards.view` or `rewards.edit` as appropriate.
- Customer and non-admin identities cannot obtain reward-risk access from the permission service.
- Online payment state cannot be manually changed by the admin action; it must be verified or reconciled from Razorpay. Manual status editing is limited to COD.
- Admin cannot move an unpaid online order into confirmed/preparing/out-for-delivery/delivered states.

## Razorpay validation

| Check | Status | Notes |
| --- | --- | --- |
| Amount authority | PASS | Gateway amount comes from stored backend payable amount |
| Payment signature | PASS | Valid/tampered/wrong-secret regression tests |
| Webhook signature code | PASS | Raw-body signature verification and invalid-signature rejection covered |
| Shared finalization | PASS | Client callback and webhook use the same idempotent finalizer |
| Lost callback | PASS (code/test) | Webhook/reconciliation path can finalize independently of the browser callback |
| Reconciliation | PASS (mocked) | Stale pending gateway lookup and state convergence tested |
| Duplicate webhook/finalization | PASS | Conditional paid transition prevents duplicate effects |
| Real test order/payment | BLOCKED | Only live-mode credentials are configured locally |
| Real test refund/webhook delivery | BLOCKED | Test credentials and a test webhook environment are unavailable |

No key, secret, signature, payment identifier, or customer credential is recorded in this document.

## Refund, reversal, and Reward Debt validation

- Refund requests have client request IDs, unique gateway refund IDs, guarded reservation counters, and over-refund protection.
- Duplicate sync/webhook finalization cannot increment refunded totals twice.
- Failed refund releases the reservation and restores the previous payment state.
- Full confirmed refunds reverse eligible order/first-order/campaign credits while preserving originals.
- Reversal is exactly-once per original credit and records the triggering order/refund/admin context.
- Insufficient wallet balance creates Reward Debt; later credit recovery creates its own idempotent debit.
- Partial-refund reward clawback remains deliberately disabled pending product policy.

## Campaign and branch validation

Delivery checkout resolves a trusted nearest `branchId`, stores it on the order, and passes it to campaign evaluation. Branch campaigns therefore work for serviceable delivery orders.

**BRANCH CAMPAIGN: BLOCKED for dine-in orders.** Table records/tokens do not contain a branch relationship, so a trustworthy branch cannot be derived. No branch was invented. Product/data architecture must associate each table with a branch before dine-in branch campaigns can be enabled.

## Risk validation

- Covered signals: earning velocity, redemption velocity, earn/redeem/refund patterns, refund and cancellation abuse, reversals, Reward Debt, referral farming, campaign abuse, and admin adjustments.
- Dedupe keys bound repeated/concurrent evaluations.
- Review decisions and notes are admin-only and audit logged.
- A forced risk-evaluation failure leaves the already-issued reward valid.
- Customer reward and notification APIs do not serialize risk records or internal review notes.
- No risk rule auto-bans, auto-deletes, or silently mutates wallet state.

## Analytics reconciliation

- Gross Issued: only configured reward-issuance credit categories.
- Reversed: separate `reward_reversal` debits.
- Net Issued: Gross Issued minus Reversed.
- Redeemed: `redemption` debits.
- Expired: `expiry` debits.
- Restored: `refund_restore` credits, shown separately from issuance.
- Outstanding: non-negative authoritative user wallet balances.
- Liability: Outstanding multiplied by configured rupees per Damru.
- Reward Debt: non-negative authoritative user Reward Debt balances.
- Campaign Issued/Reversed and Order Reward Reversed are separately attributable.
- Risk analytics are separate from issuance/liability metrics.

## Security validation

- Customer APIs use signed customer sessions and ownership-scoped queries.
- Admin APIs/actions resolve an active admin identity and enforce module/action permissions on the backend.
- Payment and refund routes have targeted rate limits.
- Razorpay callbacks verify signatures using server-side secrets and stored gateway order IDs.
- Webhook verification uses the raw request body.
- Production-facing handlers return controlled messages rather than stack traces/database details.
- Reward-risk data remains admin-only.
- Secrets were checked only for presence/mode and were never printed.

## Database index audit

- `DamruTransaction`: unique idempotency key; user history; order/category; original transaction; admin/time; analytics time/type/category; user lots; expiry lots.
- `RewardReversal`: unique original transaction and idempotency keys; order, refund, and user history.
- `RewardCampaignUsage`: unique campaign/user/source reservation plus campaign and user/status indexes.
- `RewardRiskEvent`: unique dedupe key plus user/time, review queue, rule/user, source, and event/time indexes.
- `Referral`: unique referred user plus referrer/history/status, code, qualification order, and due reward indexes.
- `Mission` and `Achievement`: unique codes plus active/type indexes.
- `PaymentRefund`: unique request ID plus order/time, gateway refund ID, and user/status indexes.
- `Order`: unique public order ID plus user/history/status and stale-payment reconciliation indexes.

No duplicate index was added by this PRD.

## Performance review

- Customer history is paginated and bounded.
- Risk lists and admin analytics use bounded pages/date ranges.
- Independent dashboard reads use `Promise.all`.
- Major read paths use projections and `lean()` where mutation is unnecessary.
- Scheduler and expiry processing are bounded and index-backed.
- Wallet reconciliation uses bounded aggregate result sets instead of reading every transaction document into application memory.
- No premature broad rewrite was performed.

## Production API validation

Unauthenticated probes are sufficient to distinguish an existing protected JSON route (`401 application/json`) from the reported stale HTML 404.

| Production endpoint | Result on 12 Aug 2026 |
| --- | --- |
| `/api/rewards/dashboard` | 401 JSON — route exists |
| `/api/rewards/history` | 401 JSON — route exists |
| `/api/rewards/coupons` | 401 JSON — route exists |
| `/api/rewards/upcoming` | 401 JSON — route exists |
| `/api/rewards/missions` | 401 JSON — route exists |
| `/api/rewards/achievements` | 401 JSON — route exists |
| `/api/rewards/referrals` | 401 JSON — route exists |
| `/api/rewards/expiry` | 401 JSON — route exists |
| `/api/rewards/campaigns` | **404 HTML — route missing in deployment** |
| `/api/notifications` | 401 JSON — route exists |
| `/api/notifications/unread-count` | 401 JSON — route exists |

Production API validation is therefore **BLOCKED**, not passed.

## Production blockers

1. Deploy the current backend so `/api/rewards/campaigns` no longer returns an HTML 404, then repeat all endpoint probes with authenticated website/mobile test accounts.
2. Implement and approve the registration email-verification lifecycle. Do not issue the welcome reward or create a normal signed-in session before the approved verification point.
3. Provide Razorpay **test-mode** key pair, test webhook secret/environment, and a test customer/order. Execute one real test payment, lost-callback/webhook recovery, duplicate webhook, full refund, and failed/retried refund. Never use the configured live key for validation.
4. Associate dine-in tables with trusted branches before enabling branch-targeted dine-in campaigns.
5. Run website/mobile smoke tests on supported physical devices/browsers after deployment.
6. Resolve or formally baseline the existing mobile lint backlog before using full mobile lint as a release gate.

## Deferred product policy register

### 1. Partial-refund reward reversal

- Current behavior: payment totals support partial refunds, but order/campaign reward clawback is not performed for a partial refund.
- Risk: users may retain rewards calculated from value later refunded; an improvised proportional rule could also claw back the wrong reward components.
- Recommended options: no clawback; proportional eligible-value clawback; threshold-based recomputation; defer all clawback until fully refunded.
- Decision required: product/finance must define eligible amount, rounding, campaign treatment, and repeated partial-refund behavior.
- Production impact: launch may proceed only if finance accepts the documented retained-reward exposure.

### 2. First-order reward requalification

- Current behavior: first-order reward is user-scoped and issued once; cancellation/refund reverses it, but a later order does not automatically requalify.
- Risk: a customer whose first rewarded order is reversed may permanently lose the incentive, or requalification could be abused through repeated cancellations.
- Recommended options: never requalify; requalify once after full reversal; requalify only after admin review.
- Decision required: product/fraud ownership and the exact qualifying event.
- Production impact: customer-support policy must match the chosen rule.

### 3. Referral clawback

- Current behavior: referral rewards are issued after qualification; automatic clawback following later refund/cancellation is not defined.
- Risk: referral farming can retain value after the qualifying purchase is economically reversed.
- Recommended options: claw back on any full refund; claw back during a defined cooling period; delayed issuance; manual fraud-confirmed reversal.
- Decision required: product/fraud must define timing, both-party treatment, and debt behavior.
- Production impact: referral financial exposure remains until a policy is approved.

### 4. Mission recomputation/clawback

- Current behavior: completed mission progress/reward is not recomputed after an underlying order is reversed.
- Risk: mission rewards may remain after qualifying activity is removed; recomputation can produce confusing regressions.
- Recommended options: immutable completion; recompute before reward maturity; claw back only fraud-confirmed missions; event-specific rules.
- Decision required: whether mission progress is historical activity or net retained activity.
- Production impact: disclose/accept retained mission reward exposure.

### 5. Achievement revocation

- Current behavior: unlocked achievements are not revoked when supporting activity is later reversed.
- Risk: badges/rewards can remain after qualification no longer holds; revocation harms user expectations.
- Recommended options: achievements remain historical; revoke financial reward only; revoke both badge and reward; fraud-only revocation.
- Decision required: product must define permanence separately for badge and Damru.
- Production impact: analytics and customer messaging must follow the decision.

### 6. Loyalty downgrade

- Current behavior: loyalty evaluation upgrades/updates from current qualification data; automatic downgrade-after-refund is not an approved policy.
- Risk: users may retain a tier after refunded spend, while aggressive downgrade can create oscillation and clawback ambiguity.
- Recommended options: no downgrade during a tier period; periodic recomputation; grace window; immediate downgrade without bonus clawback; downgrade plus approved clawback.
- Decision required: qualification period, grace, tier-bonus treatment, and notification policy.
- Production impact: liability/benefit projections depend on this rule.

### 7. Branch campaign limitation

- Current behavior: delivery orders have a trusted serviceability-derived branch; dine-in orders have only a table identity and therefore fail branch-targeted eligibility.
- Risk: inventing/defaulting a branch can misallocate campaign budget and analytics.
- Recommended options: add required `branchId` to tables; sign branch identity into the table token and revalidate it from the database; keep dine-in branch campaigns disabled.
- Decision required: operations/data ownership of tables and branch migration.
- Production impact: branch campaigns are safe for delivery but blocked for dine-in.

## Deployment checklist

- [ ] Review and approve every deferred policy or explicitly accept its exposure.
- [ ] Add registration email verification and verify welcome/referral timing.
- [ ] Deploy the current backend and confirm all required endpoints return JSON.
- [ ] Use Razorpay test mode for payment/refund/webhook validation.
- [ ] Confirm production secrets are present in the deployment platform without exposing values.
- [ ] Run database index synchronization/migration through the approved deployment process; do not drop financial indexes.
- [ ] Run root TypeScript, full tests, production build, targeted lint, and mobile TypeScript on the release commit.
- [ ] Run authenticated website and mobile smoke tests with a dedicated test customer.
- [ ] Reconcile the test customer's wallet and ledger before and after order, refund, reversal, and debt recovery.
- [ ] Verify admin view/edit permission combinations and audit entries in the deployed environment.
- [ ] Monitor payment reconciliation, refund failures, Reward Debt, reversals, campaign budgets, and risk queue after release.

## Rollback considerations

- Roll back application code through the normal deployment mechanism; do not delete or rewrite ledger, reversal, refund, campaign-usage, or risk records.
- Do not reset user balances as part of rollback.
- If issuance must be stopped, pause reward rules/campaigns through existing controlled configuration rather than removing records.
- Preserve unique idempotency keys across retry/redeploy.
- If a payment deployment is rolled back, keep webhook delivery and reconciliation available or explicitly queue reconciliation work.
- Run read-only wallet and lot reconciliation after rollback and escalate mismatches for review.

## Validation record

- Root TypeScript: PASS — `npx tsc --noEmit`.
- Mobile TypeScript: PASS — `cd mobile-app && npx tsc --noEmit`.
- Baseline automated tests: PASS — 144/144.
- Added focused tests: PASS — payment eligibility, wallet reconciliation, permission matrix.
- Full post-change suite: pending final recorded run.
- Targeted ESLint for PRD-modified files: PASS.
- Full mobile lint: BLOCKED — pre-existing unrelated lint failures.
- Production build: PASS — Next.js 16.2.4 compiled, type-checked, and generated 131 static pages.
- Real Razorpay test: BLOCKED — test-mode credentials/environment unavailable.
- Production API test: BLOCKED — `/api/rewards/campaigns` returns 404 HTML.

## Files created by PRD 4G

- `lib/orders/orderPaymentPolicy.ts`
- `lib/rewards/walletReconciliation.ts`
- `tests/orderRewardPaymentEligibility.test.ts`
- `tests/walletReconciliation.test.ts`
- `tests/rewardRiskPermissions.test.ts`
- `docs/REWARDS_PRODUCTION_READINESS.md`

## Files modified by PRD 4G

- `app/actions/orders.ts`
- `lib/rewardEngine.ts`
- `lib/achievementEngine.ts`
- `lib/missionEngine.ts`
- `lib/referralEngine.ts`
- `lib/loyaltyEngine.ts`
- `lib/rewards/campaignEngine.ts`
- `mobile-app/src/types/rewards.ts`
- `tests/rateLimit.test.ts`

## Final recommendation

**READY WITH BLOCKERS.** The locally tested financial core is materially safer after enforcing paid-online fulfilment and adding wallet/ledger reconciliation, but production release sign-off requires the listed deployment, email-verification, Razorpay test-mode, and branch/device blockers to be resolved or explicitly accepted by the accountable product/finance/security owners.
