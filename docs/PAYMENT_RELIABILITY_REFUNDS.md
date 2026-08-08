# Damru Payment Reliability, Refunds & Reconciliation

Date: 2026-08-08
Scope: the production-grade post-payment reliability layer on top of the existing Razorpay integration (`docs/RAZORPAY_INTEGRATION.md`) — reconciliation of lost/delayed webhooks, admin-initiated refunds, Damru/coupon restoration, and audit visibility. Extends that architecture; does not rebuild any part of it.

## Payment State Machine

`Order.paymentStatus` (extended, not replaced): `"pending" | "paid" | "failed" | "refund_pending" | "partially_refunded" | "refunded"`.

```
PENDING → PAID
PENDING → FAILED → (retry) → PENDING → PAID
PAID → REFUND_PENDING → PARTIALLY_REFUNDED
PAID → REFUND_PENDING → REFUNDED
```

`refund_pending`/`partially_refunded`/`refunded` are Razorpay-only — a COD order's `paymentStatus` never leaves `pending`/`paid`/`failed`. There is deliberately **no** `refund_failed` order-level state: per the "gateway could not be contacted" ≠ "gateway says failed" principle, a failed refund attempt reverts the order to whatever it correctly was before (`paid` or `partially_refunded`) — only the refund *record itself* (see below) carries a `failed` status. `Order.status` (the fulfillment pipeline: pending → confirmed → preparing → out_for_delivery → delivered/cancelled) remains completely separate — a `CANCELLED` order with `REFUNDED` payment is a normal, valid combination.

`Order.paymentStatus` is **derived**, not directly written by callers — `lib/payments/refunds.ts`'s internal `syncOrderPaymentStatus()` recomputes it from `refundedAmount`/`pendingRefundAmount`/`paymentAmount` after every mutation, so a rollback (duplicate request, failed API call) can never leave it stale.

## Refund State Machine

`models/PaymentRefund.ts` — one document per refund *attempt*, status `"pending" | "processed" | "failed"` (minimum necessary, matching Razorpay's own refund `status` values exactly — no invented states). `pending` means Razorpay accepted the refund but it hasn't settled yet (most Indian methods process near-instantly and skip straight to `processed`; some bank-transfer-based methods take longer). `processed`/`failed` are terminal.

## Reconciliation

`lib/payments/reconciliation.ts`'s `reconcileOrderPayment(orderId)` is the single reconciliation entry point, used identically by:
- **Manual admin action**: `POST /api/admin/orders/[id]/reconcile-payment` ("Recheck Payment" button, shown only on a `pending` Razorpay order).
- **Background scheduler**: `GET /api/internal/payments/reconcile`, CRON_SECRET-gated exactly like the existing `app/api/internal/rewards/run-scheduler` (same auth pattern, separate route — reconciliation needs a much shorter cadence than the once-daily reward scheduler). Registered in `vercel.json`'s `crons` array at `*/15 * * * *`; requires a Vercel plan that supports sub-daily cron frequency, otherwise it falls back to whatever minimum interval the plan allows — the admin "Recheck Payment" button and eventual scheduler runs both still converge on the correct state regardless of cadence.

It fetches Razorpay's own payment records for the order (`orders.fetchPayments`) — the trusted state — and finalizes/fails the order via the exact same `finalizeRazorpayPayment()`/`markRazorpayPaymentFailed()` the verify route and webhook already use. **Network/API failure is never treated as payment failure**: if Razorpay can't be reached, internal state is left untouched and the order stays `pending` for the next attempt — only an explicit `failed` status on every payment attempt (with none successful) causes `markRazorpayPaymentFailed()` to run.

`findStalePendingPayments()` is the batched, indexed query behind the scheduler (`{paymentStatus, paymentMethod, createdAt}` compound index on `Order`, capped at 50 per run) — it never loads full order history into memory. The staleness threshold is `PAYMENT_RECONCILE_AFTER_MINUTES = 15`, centralized as a constant in `reconciliation.ts` (matching how `RATE_LIMITS` centralizes its own timing constants — this project has no numeric-config-via-env-var precedent for site settings, which live in the database instead).

**Duplicate payment detection** (a customer somehow paying twice for the same order): if Razorpay reports more than one `captured` payment for an order's `razorpayOrderId`, this is logged as a clear `console.error` flagging manual review — `finalizeRazorpayPayment()`'s own idempotency guard already prevents a second payment from ever re-triggering business effects, so the risk is purely financial (an extra real-world charge), not a data-consistency bug. No automatic remediation exists for this — it needs a human to look at the Razorpay dashboard.

## Refund Architecture

`lib/payments/refunds.ts` is the sole refund entry point (`requestRefund()`), called only from `POST /api/admin/orders/[id]/refund`. Never accepts a client-computed "maximum refundable" — it's recomputed server-side from `Order.refundedAmount`/`pendingRefundAmount`/`paymentAmount` on every request.

**Concurrency safety** (`reserveRefundAmount()`): an atomic `findOneAndUpdate` with `$expr: { $lte: [{$add:["$refundedAmount","$pendingRefundAmount",amount]}, "$paymentAmount"] }` — only a request whose amount still fits under the remaining refundable balance *at that exact instant* succeeds; a concurrent loser is rejected outright, never partially honored or silently capped. Verified under real concurrent load in `tests/refundReservation.test.ts` (two simultaneous requests for the last remaining balance — exactly one wins).

**Idempotency**: every refund request carries a client-generated `refundRequestId` (mirrors `adjustDamru`'s `requestId` pattern), unique-indexed on `PaymentRefund`. A retried request with the same id hits a duplicate-key error on insert, rolls back its (redundant) reservation, and returns the *original* refund's state rather than creating a second one.

**Over-refund is structurally impossible**: the reservation guard above is the only path that can increment `refundedAmount`/`pendingRefundAmount`, and it mathematically cannot exceed `paymentAmount`.

Flow: reserve → insert `PaymentRefund` (pending) → call `getRazorpayClient().payments.refund(paymentId, {amount, speed:"normal"})` (the existing, single Razorpay client — no second client instantiated) → store the returned `gatewayRefundId` → if Razorpay's response status is already `processed`, finalize immediately; if `pending`, the `refund.processed` webhook finalizes it later → on any API failure, mark the refund `failed` and roll back the reservation (order reverts to `paid`/`partially_refunded`, never a phantom `refund_pending`).

**Refund webhooks** extend the *existing* `app/api/webhooks/razorpay` route (no second webhook endpoint) — `refund.processed` calls `finalizeRefund()`, `refund.failed` calls `markRefundFailed()`, both looked up by the stored `gatewayRefundId`. Both are idempotent via the same `status: "pending"` guard pattern used throughout this codebase (coupon reservation, `redeemDamru`, `finalizeRazorpayPayment`) — a duplicate webhook delivery, or a webhook racing the synchronous API-response path, is a safe no-op.

## Refund Authorization

Gated by the existing `"orders"` permission module's `"delete"` action — the same tier already used for order cancellation (both are high-impact, hard-to-undo actions on an order). No new permission module was added; `checkApiPerm`'s existing `isSuperAdmin` bypass architecture applies unchanged. "Recheck Payment" uses the lighter `"orders"/"edit"` tier (same as the pre-existing `updatePaymentStatus`), since it only ever syncs to Razorpay's own trusted state and can never mark an order paid on its own.

**The existing manual payment-status dropdown (pending/paid/failed) is now COD-only** in the admin order detail UI — for Razorpay orders it's replaced by "Recheck Payment" and "Refund". An admin can no longer hand-type "Paid" for a Razorpay order; that value only ever comes from `finalizeRazorpayPayment()` (verify route, webhook, or reconciliation).

## Damru Restoration Policy

**Policy A (adopted): restore Damru only on a FULL refund or a cancellation before any payment was ever collected — proportional restoration for partial refunds is explicitly deferred**, per the PRD's own guidance to implement full-refund restoration first when partial-refund policy isn't otherwise defined.

- **Full refund** (`refundedAmount` reaches `paymentAmount`): `finalizeRefund()` restores the Damru redeemed for that order.
- **Order cancelled before it ever collected payment** — COD (nothing was ever charged) or a Razorpay order still `pending`/`failed`: `cancelOrder()` restores Damru immediately via the same primitive, since there's no payment to refund. A **paid** Razorpay order's Damru is restored only through an actual refund reaching `processed` — never at cancellation time itself (see "Cancellation vs. Refund" below).
- **Partial refund**: `refundedAmount` increases and `paymentStatus` becomes `partially_refunded`, but no Damru is restored. Deferred, undefined product policy — Policy B (proportional) or Policy C (line-item-allocated) would need an explicit product decision.

`restoreDamruForOrder()` (`lib/payments/refunds.ts`) is the single restoration primitive, shared by both paths. It touches **only** `User.damruBalance` — not `damruTotalEarned` (this isn't a new earning; inflating it would wrongly boost loyalty-tier progress from a refund) and not `damruTotalRedeemed` (a lifetime stat; the redemption genuinely happened, restoring it doesn't erase that history). No loyalty recalculation runs. Idempotency key: `refund_restore_<refundId>` or `refund_restore_cancel_<orderId>` — a deterministic, unique key per restoration event, following the same insert-first-catch-duplicate pattern as `awardDamru`.

**Damru expiry**: the wallet has no lot-level expiry tracking anywhere (`DamruConfig.expiryDays` is a configured-but-never-enforced value, confirmed by inspecting every reward/redemption code path) — there is no original-lot expiry to preserve on restoration, so none was invented. Restored Damru simply re-enters the plain balance like any other credit.

## Coupon Restoration Policy

Coupon usage is reserved (`Coupon.usedCount` incremented) atomically at **order-creation** time — before any payment is attempted, for every payment method including COD.

- **Cancelled before fulfilment** (any payment method, any payment state): `cancelOrder()` releases the reservation via `releaseCouponUsage()` — an atomic `usedCount: {$gt:0} → $inc:-1`, floored at zero by construction, so a duplicate release attempt (or the atomic `status:{$ne:"cancelled"}` guard on `cancelOrder` itself, which already prevents this) can never drive it negative.
- **Failed payment, order not cancelled** (customer's Razorpay attempt fails but they might retry): coupon usage is deliberately **NOT** released at that point — only on an actual cancellation. Releasing on every transient `failed` state would create a race: the customer retries the *same* order, but another customer could grab the freed slot in between, defeating the retry. This is a deliberate, documented policy choice, not an oversight — it directly satisfies "a payment that never completed must not permanently consume a coupon" (release happens once cancellation makes non-completion final) while avoiding a worse race condition.
- **Completed/delivered then refunded**: coupon usage is **not** released — the order was fulfilled; the coupon did its job. Only cancellation (which by definition happens before fulfilment, per the existing UI gate that hides "Cancel" once an order is delivered) triggers release.

## Cancellation vs. Refund — a deliberate two-step design

`cancelOrder()` (`app/actions/orders.ts`) does **not** automatically call the Razorpay refund API. Cancelling a paid order stops fulfilment and releases the coupon reservation, but leaves the payment/refund state untouched — an admin must separately, deliberately open the Refund modal (amount, reason, confirmation) to actually move money back. This is intentional, not an oversight: refunding is explicitly required to be a high-impact action with its own confirmation (PRD "Refund is a high-impact action... Require deliberate confirmation"), and folding it silently into a "Cancel Order" click would violate "must NOT trigger refunds based only on UI state." Real-world payment-ops systems commonly decouple these two steps for exactly this reason.

## Admin UI

`app/admin/orders/[id]/OrderDetailClient.tsx` — extended, not redesigned:
- Payment card now shows Captured Amount, Refunded Amount (when > 0), and Remaining Refundable alongside the existing Method/Status/Razorpay IDs/Paid At.
- The manual payment-status dropdown only renders for COD orders (see Refund Authorization above).
- "Recheck Payment" button appears only for a `pending` Razorpay order with a `razorpayOrderId`.
- "Refund" button appears only when there's a positive remaining refundable balance on a Razorpay order; opens a confirmation modal (amount pre-filled to the max, reason dropdown, optional note) before submitting — matches the required confirmation step. The submit button disables while in flight; the actual duplicate-submission protection is backend idempotency (`refundRequestId`), not the disabled button.

## Website & Mobile

Both display backend-confirmed payment/refund state only — no client-side financial calculation, no inference from `order.status`.

- **Website** (`app/(website)/my-profile/page.tsx`): order detail subtitle badge extended to all six `paymentStatus` values with a shared color/label map; a refund-amount line appears for `refund_pending`/`partially_refunded`/`refunded` states, with a note that bank/provider settlement timing can differ from this status (no exact settlement time is promised, since Razorpay doesn't provide one for every method).
- **Mobile** (`mobile-app/src/app/orders.tsx`): same status labels/colors on each order card (mirrors the website's map). The screen now refetches on focus (`useFocusEffect`, the same pattern already used in `(tabs)/profile.tsx`) — returning to the order list after a payment/refund completes elsewhere always shows current state, not a stale cached copy.

## Rate Limiting

Reuses the existing Mongo-backed limiter (`lib/rateLimit.ts`). New entries: `adminRefund` (20/10min per admin), `paymentRecheck` (30/10min per admin). The Razorpay webhook remains explicitly un-rate-limited (unchanged from the base integration) — its security is the signature check, and IP limiting could drop legitimate Razorpay retries.

## Audit Logging

Reuses the existing `logAdminAction()` (`lib/auditLog.ts`) / `AdminAuditLog` model — no new logging infrastructure. New actions: `order_refund_requested` (amount, reason, refund id/status, whether it was a deduplicated retry) and `order_payment_reconciled` (outcome, only logged when reconciliation actually changed something). Never logs Key Secret, Webhook Secret, card data, or the full Razorpay API payload.

## Financial Precision

All amounts are handled as whole-rupee integers throughout (`requestRefund` rejects non-integer amounts), converted to paise only at the Razorpay API boundary via the existing `toRazorpayAmount()` — no new currency-conversion logic was written. Refund amount is validated: finite, positive integer, `<=` the atomically-recomputed remaining refundable balance.

## Database Transaction Safety

No MongoDB multi-document transactions were introduced. Every multi-step financial operation in this codebase (coupon reservation, `redeemDamru`, `adjustDamru`, and now refund reservation/finalization/Damru restoration) uses the same established pattern instead: atomic conditional `findOneAndUpdate` for the concurrency-sensitive step, plus insert-first-catch-duplicate-key for idempotency. This was continued rather than introducing transactions for the first time in this PRD, consistent with "do not introduce transactions everywhere without need" — every individual write here is already atomic at the single-document level, and cross-document consistency is achieved by making each subsequent step idempotent and safely retryable rather than requiring all-or-nothing multi-document atomicity.

## Rewards & Refunded Orders

No clawback exists or was added. Rewards already triggered from a since-cancelled/refunded order (welcome, first-order, achievements, missions, referrals, loyalty progress) are **not** automatically reversed — there is no existing product rule requiring this, and inventing one would be a business-policy decision outside this PRD's scope. `app/actions/orders.ts`'s reward-triggering logic (still gated solely on `status === "delivered"`) was not touched by this work.

## Known Deferred Risks / Decisions Required

- **Partial-refund Damru restoration policy is undefined** — Policy A (full-refund-only, implemented) was chosen as the safe default; a proportional or line-item policy needs an explicit product decision before partial refunds can restore any Damru.
- **COD "refunds" (returning collected cash) are out of scope** — `requestRefund()` explicitly rejects COD orders; there's no gateway transaction to reverse, and a manual cash-refund process is assumed to happen outside this system.
- **No reward/loyalty clawback on refund** — documented above as the current, deliberate policy, not a gap.
- **Reconciliation scheduler cadence depends on the Vercel plan's cron frequency support** — `*/15 * * * *` is configured; some plans only support daily cron, in which case the admin "Recheck Payment" action is the reliable fallback until a plan upgrade or an alternative trigger (e.g. a lightweight external pinger) is set up.
- **Live Razorpay refund testing was not performed** — no test-mode transaction with a real captured payment was available to refund end-to-end in this environment. See the final validation report for exact scenario-by-scenario status.
