# Razorpay Payment Gateway Integration

Date: 2026-08-08
Scope: adds Razorpay Standard Checkout as an online-payment option alongside the existing Cash on Delivery flow, on both the Next.js website and the Expo/React Native mobile app. No existing order, coupon, Damru, or reward system was rewritten — Razorpay integrates around them.

**Refunds, payment reconciliation, and the extended payment state machine are covered in `docs/PAYMENT_RELIABILITY_REFUNDS.md`, built on top of this integration — this document covers the initial charge/verify/webhook flow only.**

## Architecture

```
Customer Checkout (website / mobile — unchanged UI)
        │
        ▼
POST /api/orders  (existing, unchanged — creates the internal Order,
                    applies coupon discount, sets paymentStatus: "pending")
        │
        ▼
POST /api/rewards/redeem  (existing, unchanged — only if the user
                            requested Damru; debits the wallet, records
                            a redemption transaction against the order)
        │
        ▼  (only for payMethod = "upi" | "card", never for "cod")
POST /api/payments/razorpay/order   { orderId }
        │  computePayableAmount(order):
        │    order.total, minus the ₹ value of any Damru redemption
        │    already recorded for this order (looked up server-side,
        │    never trusted from the client) — this is the amount that
        │    was ALWAYS missing from order.total (see "Damru Interaction"
        │    below), not a new discount rule.
        │  → Razorpay Order created for that amount (or reused if a
        │    retried click already created one for the same amount)
        ▼
Razorpay Standard Checkout (website script / mobile native SDK)
        │
        ▼
POST /api/payments/razorpay/verify   { orderId, razorpay_payment_id,
                                        razorpay_order_id, razorpay_signature }
        │  Signature is verified against the ORDER ID STORED ON THE SERVER
        │  (never the one supplied by the client) using RAZORPAY_KEY_SECRET.
        ▼
finalizeRazorpayPayment()  →  Order.paymentStatus = "paid"
```

In parallel, independent of whether the customer's browser/app ever calls `/verify`:

```
Razorpay  →  POST /api/webhooks/razorpay  →  same finalizeRazorpayPayment()
```

Both the client-verify route and the webhook call the **identical** `finalizeRazorpayPayment()` in `lib/payments/finalizePayment.ts` — there is exactly one place that ever marks an order paid, so the two paths cannot disagree with each other.

## Website Flow

`app/(website)/checkout/page.tsx` — the existing stepper/summary UI is unchanged. The "UPI" and "Card" tabs (previously disabled placeholders reading "integration coming soon") now both call the same `handlePlaceOrder()` → `startRazorpayPayment()` path; Razorpay's own Standard Checkout modal is what actually lets the customer choose UPI, card, netbanking, or wallet — the two site tabs are just an entry point into that single modal, so no separate per-method logic was needed. The Razorpay Checkout script (`checkout.razorpay.com/v1/checkout.js`) is loaded on demand, only when a payment is actually starting, not globally on every page.

Order placement itself is untouched: `POST /api/orders` still runs first, then `POST /api/rewards/redeem` if Damru was requested (both pre-existing, unmodified). Only after those succeed does the new Razorpay order-creation call happen.

Success is only shown once `/verify` confirms the payment — not from the Razorpay popup's own client-side callback alone. A failed or cancelled payment shows a "Retry Payment" screen that reuses the same internal order (no duplicate order is ever created).

## Mobile Flow

`mobile-app/src/app/checkout.tsx` — same sequencing as the website, calling the identical backend endpoints via the new `mobile-app/src/services/paymentApi.ts` (thin wrappers, no separate mobile payment logic or amount math). The native checkout is opened via the official `react-native-razorpay` SDK's `RazorpayCheckout.open()`. The existing single "Pay Now / Place Order" button was already wired to call `placeOrder()` regardless of payment method — only the inside of `placeOrder()` changed.

**Mobile SDK compatibility — see Known Deferred Risks below. This was NOT verified on a real device or emulator in this environment.**

## Environment Variables Required

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — see `.env.example`. All three are optional (the app stays COD-only if none are set); once any one is set, `lib/env.ts`'s `validateProductionEnv()` requires all three in production. There is no separate `NEXT_PUBLIC_RAZORPAY_KEY_ID` — the Key ID reaches the website/mobile client only inside the authenticated `POST /api/payments/razorpay/order` response, so there is nothing client-side to keep in sync.

## Order Creation

`POST /api/payments/razorpay/order` — body `{ orderId }` only, never an amount. Steps: authenticate → rate-limit (`RATE_LIMITS.razorpayOrder`, 20/10min per user) → load the order and verify `order.userId === session user` → reject if `paymentMethod === "cod"` or already `paid` → `computePayableAmount()` → if the payable amount is `₹0` (coupon/Damru covered it entirely), finalize as paid directly without ever opening Razorpay → otherwise create (or reuse, see below) a Razorpay Order for that amount and return `{ razorpayOrderId, amount, currency, keyId }`.

**Duplicate-order prevention:** if the order already has a `razorpayOrderId` and the currently-computed payable amount hasn't changed, the existing Razorpay order is reused instead of creating a new one — this covers double-clicks, refreshes, and retries. If the race is lost (two requests both decide to create a new Razorpay order at the same instant), only one `razorpayOrderId` ends up stored on the order (last DB write wins) — the other Razorpay-side order simply never gets referenced or verified against again. This is a deliberate, documented minimal-footprint tradeoff rather than a distributed lock; it never causes a double charge or double fulfillment.

## Payment Verification

`POST /api/payments/razorpay/verify` — body `{ orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature }`. **The signature is verified using the `razorpayOrderId` already stored on the order document, not the value in the request body** — the body's `razorpay_order_id` is only used for an equality sanity-check against that stored value. `lib/payments/razorpay.ts`'s `verifyPaymentSignature()` wraps the official Razorpay SDK's `validatePaymentVerification` (HMAC-SHA256 over `order_id|payment_id`, keyed by `RAZORPAY_KEY_SECRET`, compared inside the SDK's own timing-safe check). An invalid signature returns 400 and never touches the order.

## Webhook

`POST /api/webhooks/razorpay` — no customer authentication (server-to-server); security is entirely the webhook signature (`RAZORPAY_WEBHOOK_SECRET`, verified against the **raw** request body via `req.text()` before any JSON parsing, using the SDK's `validateWebhookSignature`). Deliberately **not** rate-limited by IP — that could drop legitimate Razorpay retries.

Handles `payment.captured` (the single canonical success event — calls `finalizeRazorpayPayment()`, with an amount cross-check against the order's frozen `paymentAmount` as a free extra safety net) and `payment.failed` (marks the order failed, but never overwrites an order that's already paid). Other events (e.g. `order.paid`) are intentionally ignored to avoid two different "success" code paths.

**Idempotency:** `finalizeRazorpayPayment()`'s atomic conditional update (`findOneAndUpdate({..., paymentStatus: {$ne:"paid"}}, {$set:{paymentStatus:"paid",...}})`) already makes repeated/duplicate webhook deliveries — or a webhook landing at the same time as the client's own `/verify` call — a safe no-op. No separate event-id dedup table was needed.

This is also the reconciliation path for "customer paid but the browser/app never called `/verify`" (closed tab, lost connection): the webhook still arrives and finalizes the order independently.

## Capture Policy

This integration assumes **Auto Capture** is configured on the Razorpay Dashboard (Settings → Payment Capture). With auto-capture, `payment.captured` fires immediately after a successful payment with no separate manual-capture step — treating `payment.captured` as "paid" is correct under this policy. If capture policy is ever changed to manual, the webhook handling would need to additionally listen for the capture step, not just the initial payment — not implemented here since manual capture is not the current policy.

## Payment Statuses

Reused the existing `Order.paymentStatus` enum (`"pending" | "paid" | "failed"`) — no new states were added. `Order.status` (the fulfillment pipeline: pending → confirmed → preparing → out_for_delivery → delivered/cancelled) is a completely separate field and was not touched by this integration.

## Damru Interaction — the pre-existing gap this closes for online payments

`redeemDamru()` (`lib/rewardEngine.ts`, unmodified) debits the customer's Damru wallet and returns a ₹ discount **without ever writing that discount back onto `Order.total`** — `order.total` in the database has only ever reflected the coupon discount. For Cash on Delivery this was already the existing, intentional behavior: the delivery agent collects the full `order.total`, and the Damru discount is shown to the customer as a separately-recorded rebate rather than a reduction in what's collected. That COD behavior is completely unchanged by this integration.

Online payment, however, must charge a real, correct amount — `computePayableAmount()` (`lib/payments/finalizePayment.ts`) looks up whether a Damru redemption transaction exists for the order (`DamruTransaction` with `idempotencyKey: redeem_order_<orderId>`) and, if so, nets its ₹ value out of `order.total` before that amount is ever sent to Razorpay. This is purely additive — it does not change `redeemDamru()`, the redemption rate, min/max redemption rules, or idempotency, and it has zero effect on COD orders.

**Failure safety:** Damru is only ever debited by the existing, unmodified `redeemDamru()` call, which happens *before* the Razorpay order is created. If the subsequent payment fails or is cancelled, the Damru debit is **not** automatically rolled back — the customer keeps the order (retryable) and the redemption transaction stands, matching how COD already behaves today (Damru redemption has never been coupled to payment success, even for cash orders). This was a deliberate choice to avoid inventing new wallet-rollback machinery for a case that doesn't exist in the current system; it is called out explicitly here as a known, accepted behavior rather than a defect.

## Coupon Interaction

The existing atomic coupon usage-limit fix (`app/api/orders/route.ts`'s atomic `findOneAndUpdate` reservation) was not touched. Coupon usage is reserved at order-creation time, before payment is even attempted — a failed or cancelled Razorpay payment does **not** release the reserved coupon usage, again matching existing, unmodified order semantics (the same would already be true of a COD order that's later cancelled).

## Zero-Payable Orders

If `computePayableAmount()` returns `₹0` (coupon and/or Damru covered the order entirely), `POST /api/payments/razorpay/order` finalizes the order as paid directly and returns `{ zeroPayable: true }` — neither the website nor mobile client ever opens a Razorpay popup for a ₹0 charge.

## Rate Limiting

Reuses the existing Mongo-backed rate limiter (`lib/rateLimit.ts`, built during Production Hardening). Two new entries: `razorpayOrder` (20/10min per user) and `razorpayVerify` (20/10min per user). The webhook is intentionally excluded from rate limiting — see Webhook section above.

## CSP Requirements (deferred, tracked)

No Content-Security-Policy exists yet (deferred during Production Hardening pending exactly this kind of external-origin audit). Razorpay Standard Checkout requires, at minimum:
- `script-src`: `https://checkout.razorpay.com`
- `frame-src` / `connect-src`: Razorpay's checkout and API origins (`https://api.razorpay.com`, `https://checkout.razorpay.com`, and UPI-app-specific redirect origins used during the actual payment flow)

These must be captured from a real Test Mode transaction's network activity (not guessed) before any CSP is enabled — this integration does not add a CSP, it only documents what one will need to allow once the deferred CSP work happens.

## Test Mode Setup

Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` to Test Mode credentials from the Razorpay Dashboard, and `RAZORPAY_WEBHOOK_SECRET` to the secret configured against a webhook pointed at `<your-domain>/api/webhooks/razorpay` subscribed to at least `payment.captured` and `payment.failed`. Never use Live Mode credentials during development.

## Test Mode Checklist

- [ ] Place an order with `payMethod: "upi"` or `"card"`, confirm a Razorpay Order is created for the correct backend-computed amount
- [ ] Complete a test payment, confirm `/verify` marks the order paid and the success screen shows only after that
- [ ] Confirm the Razorpay Dashboard shows a matching order + captured payment for the correct amount, referencing the internal order's `orderId` as the receipt
- [ ] Cancel a Razorpay Checkout popup, confirm the order stays retryable and Damru wasn't debited a second time on retry
- [ ] Fail a test payment (Razorpay test card declines), confirm `paymentStatus` becomes `"failed"`, not `"paid"`
- [ ] Redeem Damru + pay online, confirm the Razorpay amount is `order.total` minus the Damru discount
- [ ] Trigger the same payment's webhook twice (Razorpay Dashboard → Webhooks → resend), confirm no duplicate effect

## Live Mode Checklist (do not perform until Test Mode fully passes)

- [ ] Replace `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` with Live Mode values in the production environment only
- [ ] Re-point the Razorpay webhook to the production domain
- [ ] Confirm Auto Capture is enabled in Live Mode settings (same as Test Mode)
- [ ] Perform one real low-value transaction end-to-end before wider rollout

## Troubleshooting

- **"Online payment is not available right now" (503)** — one or more of the three `RAZORPAY_*` env vars is missing; check `.env.local`/production env, not logs (values are never logged).
- **"Payment verification failed"** — either a tampered/incorrect signature, or the client's `razorpay_order_id` doesn't match what the server generated for that internal order (e.g. a stale/cached checkout session). The order stays unpaid; safe to retry from scratch.
- **Order stuck "pending" after a successful-looking payment** — check the webhook is configured and reachable; the webhook is the reconciliation path for exactly this case (browser closed before `/verify` ran).
- **Webhook returns 400** — signature mismatch; confirm `RAZORPAY_WEBHOOK_SECRET` matches the secret configured on the Razorpay Dashboard's webhook, not the Key Secret.

## Known Deferred Risks

- **Mobile native SDK compatibility with the New Architecture is UNVERIFIED.** `npx expo-doctor` flags `react-native-razorpay` (the official Razorpay React Native SDK — there is no viable alternative package) as "Unsupported on New Architecture" per React Native Directory's compatibility metadata, and this app has `newArchEnabled=true` (Expo SDK 57's default). The package was updated recently and this flag may be stale community metadata rather than a confirmed current incompatibility, but this was **not verified** — no Android SDK/emulator/device was available in the environment this integration was built in, and no macOS machine exists for an iOS prebuild at all. **A real native build (`npx expo prebuild` + `expo run:android`, or an EAS development build) and an actual on-device test payment are required before this ships to users.** If the native module proves incompatible, the fallback is a WebView-based Razorpay Standard Checkout (the same script the website uses) via `expo-web-browser` or `react-native-webview` — not implemented here, since the native SDK is the correct first choice and this fallback should only be built if actually needed.
- **No Content-Security-Policy** — unchanged from before this integration; see CSP Requirements above for what a future CSP must allow.
- **Damru is not automatically rolled back merely on payment failure** — only on actual order cancellation (or a full refund). See `docs/PAYMENT_RELIABILITY_REFUNDS.md`'s Damru Restoration Policy for the full, now-implemented rules; this was updated by that later PRD and superseded the original "not implemented" note here.
- **Coupon usage is not released on payment failure alone** — same update as above; released on cancellation, per `docs/PAYMENT_RELIABILITY_REFUNDS.md`'s Coupon Restoration Policy.
- **Refunds are now implemented** — see `docs/PAYMENT_RELIABILITY_REFUNDS.md`. The original "no refund flow" note here is superseded.
- **Zero live Razorpay Test Mode transaction was performed** — no Razorpay account/API credentials were available in this environment. See the final validation report's "Razorpay Test Mode" section for exact PASS/FAIL/BLOCKED status per item.
