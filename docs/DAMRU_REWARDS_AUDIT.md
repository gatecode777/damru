# Damru Coins / Rewards System — Repository Audit & Implementation Readiness

Audit date: 23 September 2026 · Branch: `rahul` @ `332ea71` · Scope: website, backend, admin, Android (Expo) app
Method: read-only source audit. No application code, configuration, schema, or dependency was changed.

> **Naming.** The codebase already calls the currency **"Damru"** (not "Damru Coins"). This report uses
> "Damru" for the existing currency and "coins" only when quoting the request.

---

## 1. Executive Summary

**The rewards system this brief asks for already exists in large part.** The repository contains a
production-grade Damru rewards platform: an append-only ledger (`DamruTransaction`) with unique
idempotency keys, a central issuance engine (`lib/rewardEngine.ts`), FEFO expiry lots, a reversal engine
with Reward Debt, a campaign engine with budgets and stacking, referrals, missions, achievements, loyalty
tiers, a daily streak, a risk engine, admin analytics, and reward screens on both web and mobile.

Building a second "coins" system would duplicate a working ledger and is **not recommended**. The work is
to **extend** the existing engine and fix a small number of integrity defects.

What is **missing** relative to the brief:

| Requested capability | Status today |
|---|---|
| Order-value reward ("spend ₹X → earn Y") | **Partial.** Fixed rule `floor(eligible ₹ / 10)` hard-coded in 3 places; not configurable; no tiers |
| Dish-specific reward ("buy this dish → 20") | **Missing.** Campaigns can target menu items, but only as one bonus per order, not per dish or per unit |
| Category / branch rewards | **Partial**, via time-boxed campaigns only |
| First-order, referral, festival/campaign, bonus, loyalty rewards | **Exist** |
| Review reward | **Missing — no review feature exists at all** |
| "You will earn N Damru" on menu/cart/checkout | **Missing** (no earn-preview API) |
| Coin monetary value | **Exists** as `DamruConfig.redemptionRate` (default `0.1` ₹ per Damru), stored as a float |
| Push notifications | **Missing** (model only; in-app + email work) |

Integrity defects found (details in §24):

1. **The automated test suite was deleted.** 45 test files were removed in commit `8096579`
   (2026-08-21). `npm test` points at `tests/**/*.test.ts`, which no longer exists. The code comments still cite those tests.
2. **Redemption can debit more Damru than the order can absorb.** The discount is capped at the payable amount, but the Damru debit is not, so the customer silently loses the difference.
3. Damru amounts are **not forced to be whole numbers** on the redemption and admin-adjust paths.
4. The standalone `POST /api/rewards/redeem` endpoint **debits Damru against any order the user owns, in
   any state, without applying a discount.**
5. **A COD order whose payment was marked `failed` still earns rewards** on delivery.
6. `dailyEarnLimit` is shown in the admin UI but **is never enforced**.
7. Changes to the coin value (`redemptionRate`) are **not audit-logged**.

**Readiness: READY WITH BUSINESS DECISIONS** to extend the existing engine, after a short hardening
phase. Review rewards are **NOT READY**: that needs a review feature first. See §28.

---

## 2. Existing Architecture

| Concern | Finding | Evidence |
|---|---|---|
| Web framework | Next.js **16.2.4** App Router, React 19.2 | `package.json`; `AGENTS.md` warns this Next version has breaking changes |
| Language | TypeScript 5 | `tsconfig.json` |
| Package manager | npm (`package-lock.json`) — root and `mobile-app/` separately | |
| Backend | Same Next.js app: Route Handlers (`app/api/**/route.ts`) + Server Actions (`app/actions/*.ts`) | |
| Database / ODM | MongoDB via Mongoose 9 | `lib/mongodb.ts`, `models/*.ts` |
| Migrations | No migration framework; one-off scripts | `scripts/migrate-damru-expiry-lots.ts`, `scripts/migrate-admin-superadmin-flag.ts` |
| Multi-document transactions | **Not used**, by design ("insert-first, catch duplicate key, compensate") | `lib/rewards/damruAllocation.ts:22-30` |
| Customer auth | Custom JWT in httpOnly cookie `damru_user_session`, 7-day expiry | `lib/userSession.ts:5-55` |
| Mobile auth | Same cookie (`credentials: "include"`), no token storage | `mobile-app/ARCHITECTURE.md` |
| Admin auth | NextAuth v5 Credentials, JWT session, module×action permissions | `auth.ts`, `lib/adminPermissions.ts`, `lib/checkApiPerm.ts` |
| Admin route guard | `proxy.ts` (Edge) redirects `/admin/*` without session | `proxy.ts` |
| Web state | React Context (`CartContext`, `RewardsProvider`) | `lib/CartContext.tsx`, `lib/rewards/RewardsProvider.tsx` |
| Mobile | Expo SDK 57, RN 0.86, Expo Router, TanStack Query, `AppProvider` context | `mobile-app/package.json`, `mobile-app/ARCHITECTURE.md` |
| Payments | Razorpay (web `razorpay` SDK; mobile `react-native-razorpay`), COD | `lib/payments/*`, `app/api/payments/razorpay/*`, `app/api/webhooks/razorpay/route.ts` |
| Caching | No Redis. In-process TTL caches (e.g. Damru config, 60 s per instance); React Query on mobile | `lib/getDamruConfig.ts:50`, `mobile-app/src/lib/queryClient.ts` |
| Rate limiting | MongoDB TTL collection, fixed window | `lib/rateLimit.ts:13-31` |
| Queue / background jobs | **None.** No queue, no outbox, no worker | — |
| Scheduler | Vercel Cron: rewards scheduler 03:00 UTC daily; payment reconcile 03:30 UTC | `vercel.json`, `app/api/internal/rewards/run-scheduler/route.ts` |
| Notifications | In-app `Notification` + email (nodemailer/Resend). Push **not wired** | `lib/notifications/*`, `models/PushDevice.ts` header comment |
| Storage | Upload route + local `uploads` serving route; ImageKit allowed as a remote image host | `app/api/upload/route.ts`, `app/uploads/[...path]/route.ts`, `next.config.ts` |
| Deployment | Vercel (web/API); EAS for Android (`eas.json`); `Damru.apk` build artifact at the repo root (git-ignored) | `vercel.json`, `mobile-app/eas.json` |
| Env validation | Fails startup in production if required env vars are missing | `instrumentation.ts`, `lib/env.ts` |

### Architecture map

```
                     ┌───────────────────────────── Next.js 16 (Vercel) ─────────────────────────────┐
 Website (App Router)│  app/(website)/*  ──fetch──►  app/api/*  (Route Handlers, cookie JWT)           │
 Admin panel         │  app/admin/*      ──Server Actions (app/actions/*) + app/api/admin/* (NextAuth)│
 Android (Expo)  ────┼──fetch (same cookie)──► app/api/*                                             │
                     │                                                                               │
                     │  lib/rewardEngine.ts ─► lib/rewards/{campaignEngine, reversalEngine,          │
                     │                           damruAllocation, recomputeEntitlements, riskEngine} │
                     │  lib/{missionEngine, achievementEngine, referralEngine, loyaltyEngine}        │
                     │  lib/payments/{finalizePayment, refunds, reconciliation}                      │
                     │  lib/notifications/*                                                          │
                     └──────────────┬──────────────────────────────┬─────────────────────────────────┘
                                    │                              │
                               MongoDB (Mongoose)          Razorpay API + webhook
                                    ▲
                    Vercel Cron ────┘  /api/internal/rewards/run-scheduler, /api/internal/payments/reconcile
```

---

## 3. Repository Findings

### 3.1 Domain inventory

| Domain | Exists? | Location |
|---|---|---|
| Users | Yes | `models/User.ts` (holds `damruBalance`, `damruTotalEarned`, `damruTotalRedeemed`, `rewardDebt`, loyalty and streak fields) |
| Restaurants | **Branches only.** One brand ("Damru By Namo"), several Jaipur branches | `models/Branch.ts` |
| Vendor / restaurant partner panel | **No.** "Managers" are admin users with scoped permissions | `app/admin/managers/*` |
| Dishes | Yes, `MenuItem` (variants/add-ons priced server-side) | `models/MenuItem.ts`, `lib/checkout/resolveOrderItems.ts` |
| Categories | Yes | `models/Category.ts` |
| Cart | Yes (server cart for logged-in users) | `models/Cart.ts`, `app/api/cart/*` |
| Checkout quote | Yes, authoritative | `app/api/checkout/quote/route.ts`, `lib/checkout/checkoutCharges.ts` |
| Orders | Yes (delivery + dine-in via table QR) | `models/Order.ts`, `app/api/orders/route.ts`, `app/actions/orders.ts` |
| Payments | Razorpay + COD; webhook, verify, fail, reconcile | `lib/payments/*` |
| Refunds | Razorpay only; amount-based, **not item-level** | `models/PaymentRefund.ts`, `lib/payments/refunds.ts` |
| Coupons | Yes; also used for private reward coupons | `models/Coupon.ts`, `lib/checkout/couponPricing.ts` |
| Offers page | Placeholder ("coming soon") | `app/(website)/offers/page.tsx` |
| Delivery | Serviceability by distance to nearest branch; fee rules | `lib/delivery/serviceability.ts`, `models/CheckoutChargesConfig.ts` |
| Notifications | In-app + email; campaign/template system | `models/Notification.ts`, `lib/notifications/*` |
| Wallet / ledger | **Yes**: `User.damruBalance` + `DamruTransaction` | see §8–9 |
| Loyalty | Yes: tiers, thresholds, upgrade bonus | `lib/loyaltyEngine.ts`, `models/LoyaltyTier.ts` |
| Referrals | Yes | `lib/referralEngine.ts`, `models/Referral.ts`, `models/ReferralConfig.ts` |
| Missions / achievements / streak | Yes | `lib/missionEngine.ts`, `lib/achievementEngine.ts`, `lib/dailyStreak.ts` |
| Reward campaigns | Yes | `lib/rewards/campaignEngine.ts`, `models/RewardCampaign*.ts` |
| Reversals / Reward Debt | Yes | `lib/rewards/reversalEngine.ts`, `models/RewardReversal.ts` |
| Risk / fraud detection | Yes (detect-and-flag only) | `lib/rewards/riskEngine.ts`, `models/RewardRisk*.ts` |
| Reviews / ratings | **No.** No model, route, or UI | — |
| Admin audit log | Yes, but not applied to every reward route (§16) | `lib/auditLog.ts`, `models/AdminAuditLog.ts` |

### 3.2 Existing rewards documentation

`docs/REWARDS_POLICY_FINALIZATION.md`, `docs/REWARDS_PRODUCTION_READINESS.md`, `docs/REWARD_CAMPAIGNS.md`,
`docs/REWARD_REVERSALS.md`, `docs/REWARDS_RISK_ABUSE.md`, `docs/REWARDS_ANALYTICS.md`,
`docs/PAYMENT_RELIABILITY_REFUNDS.md`.

**Documentation drift:**
- `REWARDS_PRODUCTION_READINESS.md` says partial-refund clawback, first-order requalification, referral clawback,
  mission and achievement revocation, and loyalty downgrade are **"not performed / deferred"**.
  `REWARDS_POLICY_FINALIZATION.md` and the code (`lib/rewards/recomputeEntitlements.ts`) show all of them
  **implemented**. The readiness doc is stale.
- Code references `docs/DAMRU_EXPIRY_SYSTEM.md` and `docs/NOTIFICATION_SYSTEM.md`. **Neither file exists.**

### 3.3 Test suite

`package.json` → `"test": "tsx --test ... tests/**/*.test.ts"`. **The `tests/` directory does not exist.**
`git log --diff-filter=D -- tests` shows 45 files deleted in `8096579 fix: improve admin sessions and
refund handling` (2026-08-21), including `damruExpiryConcurrency.test.ts`, `adminAdjustIdempotency.test.ts`,
and `couponConcurrency.test.ts`. The readiness doc's "144/144 PASS" predates the deletion and no longer holds.

---

## 4. Existing Order Lifecycle

### 4.1 State model (`models/Order.ts:3-10`)

- `status`: `pending | confirmed | preparing | out_for_delivery | delivered | cancelled`. **There is no `completed` state.**
- `paymentStatus`: `pending | paid | failed | refund_pending | partially_refunded | refunded`.
- `paymentMethod`: `cod | razorpay` (legacy `upi`/`card` readable).

### 4.2 Traced flow

```
Menu item ─► Cart (server) ─► POST /api/checkout/quote (authoritative totals, preview only)
   ─► POST /api/orders                                   app/api/orders/route.ts:39
        • prices re-resolved from MenuItem                 :102, lib/checkout/resolveOrderItems.ts
        • coupon priced + usage reserved                   :125
        • eligibleRewardAmount = subtotal − coupon         :127-129
        • Order.create
             COD      → status "confirmed", paymentStatus "pending"      :185
             Razorpay → status "pending",   paymentStatus "pending"
        • optional Damru redemption (ledger debit)         :212-231
   ─► Razorpay: POST /api/payments/razorpay/order  (freezes paymentAmount = finalAmount)
        ─► verify route / webhook payment.captured / reconcile cron
             └─ finalizeRazorpayPayment(): atomic {paymentStatus≠paid} → paid + confirmed   lib/payments/finalizePayment.ts:63-99
        ─► fail route / webhook payment.failed → paymentStatus failed (status pending)       :129
   ─► Admin: updateOrderStatus(): confirmed → preparing → out_for_delivery → delivered       app/actions/orders.ts:32
        • online orders blocked from fulfilment until paid                                  lib/orders/orderPaymentPolicy.ts:21-27
        • on "delivered": base, campaign, first-order rewards; achievements; missions;
          referral qualification; loyalty                                                   app/actions/orders.ts:58-93
   ─► Cancellation: customer (pending/confirmed, unpaid) or admin cancelOrder()
        • coupon release, redeemed-Damru restore, reward reversal                           app/api/orders/[id]/cancel/route.ts, app/actions/orders.ts:146
   ─► Refund (Razorpay only): requestRefund → finalizeRefund → recomputeRewardEntitlements   lib/payments/refunds.ts:159,322
```

### 4.3 Reward trigger: current and recommended

| Candidate | In this codebase | Safe? |
|---|---|---|
| ORDER_CREATED | Order row inserted before payment; COD auto-"confirmed" | **No**: not yet fulfilled or paid |
| PAYMENT_SUCCESS | `finalizeRazorpayPayment` | **No**: COD has no equivalent; order may still be cancelled or refunded |
| ORDER_CONFIRMED | Set at creation for COD | **No** |
| **ORDER_DELIVERED** (+ payment-eligible) | `status: "delivered"` AND (`cod` OR `paid`) | **Yes — current trigger; keep it** |
| ORDER_COMPLETED | Does not exist | n/a |

**Recommendation: keep `ORDER_DELIVERED` + `paymentEligibleOrderFilter()` as the single earn trigger for every
new order-based rule** (dish, tier, category). It is the latest authoritative state, already guarded twice
(`app/actions/orders.ts:41` and `lib/rewardEngine.ts:403`), and the whole reversal pipeline is keyed on it.

**Gap:** `isOrderPaymentEligible` treats *every* COD order as eligible (`lib/orders/orderPaymentPolicy.ts:18`).
An admin can set a COD order's payment to `failed` (`app/actions/orders.ts:128-143`) and then mark it delivered,
and rewards are still issued. See H6.

**Business decision (optional):** a "maturity" hold (Damru visible but not spendable for N days after delivery)
does not exist for order rewards. It does exist for referrals (`ReferralConfig.rewardDelayDays`). The ledger has
no "pending credit" state today.

### 4.4 Edge cases vs rewards

| Case | Current behaviour | Evidence | Assessment |
|---|---|---|---|
| Cancelled before delivery | No reward was issued; redeemed Damru restored; coupon released | `app/api/orders/[id]/cancel/route.ts:38-53`, `app/actions/orders.ts:155-178` | Correct |
| Cancelled after delivery (admin) | Order-linked rewards reversed; referral/mission/achievement/loyalty recomputed | `app/actions/orders.ts:95-108,191-200` | Correct, but see M1 |
| Failed payment | Order stays `pending`; cannot be delivered; no reward | `orderPaymentPolicy.ts:21-27` | Correct |
| Full refund | All order-linked credits reversed; redeemed Damru restored; first-order requalifies next order | `lib/payments/refunds.ts:187-205`, `recomputeEntitlements.ts` | Implemented; policy needs ratification |
| Partial refund | Proportional reversal: `refundedAmount / paymentAmount` applied to `eligibleRewardAmount`; FIXED campaign bonus fully reversed; redeemed Damru **not** restored | `reversalEngine.ts:82-134`, `refunds.ts:187` | Implemented. Proportion is based on payable (includes tax/delivery, excludes Damru), not merchandise. Needs a decision |
| Rejected by restaurant | No "rejected" status; modelled as admin cancel | — | Same as cancel |
| COD order | Earns on delivery | `orderPaymentPolicy.ts:18` | Earns even when COD payment is `failed` (H6) |
| COD refund | No gateway refund; no automated reward reversal | `refunds.ts:337-339` | Needs manual admin reversal (M13) |
| Duplicate orders | Each order is a distinct reward source (`order_reward:{orderId}`) | `rewardEngine.ts:408` | Correct; abuse is left to risk engine and cancellation reversal |
| Repeated payment callbacks | Atomic `paymentStatus≠paid` guard; payment never awards Damru | `finalizePayment.ts:83-99` | Correct |
| Order modification / quantity / price change | **No edit path exists** after creation | — | Safe today. Any future edit feature must re-snapshot `eligibleRewardAmount` |
| Status re-set to delivered | All keys idempotent → no double credit | §10 | Correct |
| Guest dine-in order | No `userId` → no reward, no later claim | `app/api/orders/route.ts:145` | Business decision |

---

## 5. Rewards Requirements (as-is vs requested)

### A. Dish-based reward — **MISSING**
- Nothing credits "N Damru per dish".
- The closest existing feature is `RewardCampaign` with `eligibleMenuItems` / `eligibleCategories`
  (`campaignEngine.ts:25`). It checks whether the order **contains** a matching item and then awards **one** bonus
  per order. That bonus is also subject to stacking (`BEST_ONLY` by default), so a dish campaign competes with a
  festival campaign.
- `OrderItem` already stores `menuItemId`, `categoryId`, `price`, and `qty` (`models/Order.ts:12-21`). The data needed
  for per-dish calculation is snapshotted at order time.
- **UNKNOWN:** per unit vs per line (qty 2 → 20 or 40?), per-line/per-order caps, whether variants/add-ons change the
  reward, and whether a coupon-discounted dish still earns.

### B. Order-value reward — **PARTIAL**
- Today: `amount = floor(eligibleRewardAmount / 10)`, i.e. 1 Damru per ₹10 of merchandise after coupon
  (`lib/rewardEngine.ts:405-406`).
- **Hard-coded in three places** that must stay in sync:
  `lib/rewardEngine.ts:406`, `app/actions/orders.ts:63` (campaign base fallback), and `lib/rewards/reversalEngine.ts:124` (partial reversal).
- Tiers do not exist. They can be approximated with several `ORDER_BONUS` campaigns using `minimumOrderAmount`.
  Under `BEST_ONLY` that gives "highest matching tier", but those tiers then compete with every other campaign,
  and campaigns require an end date.
- **UNKNOWN:** tier semantics for a ₹1,200 order: highest-match (120), cumulative (170), slab, or percentage.
  Also: whether tiers replace or add to the per-₹10 base.

### C. First-order reward — **EXISTS**
- `RewardRule.first_order` (default 500 Damru, `app/api/admin/rewards/rules/route.ts:14-19`), issued when the
  user's **delivered, payment-eligible order count is exactly 1** (`rewardEngine.ts:381-382`). Key `first_order_{userId}`.
- A cancelled or failed first order never counts. Full refund or cancellation reverses the reward and requalifies the next delivered order (`recomputeEntitlements.ts:129-178`).
- Multiple accounts: only per-account protection. **Registration issues the welcome reward before any
  email/phone verification** (`app/api/user/register/route.ts:43-55`). The existing readiness doc lists this as a production blocker.
- Dine-in orders by logged-in users count toward "first order".

### D. Referral reward — **EXISTS**
- `ReferralConfig` defaults: referrer 500, referred 250, `minimumOrderAmount` 999, `rewardDelayDays` 0,
  qualification on first delivered order (`models/ReferralConfig.ts`).
- Self-referral blocked; one referrer per referred user (unique index); clawback and requalification on full loss.

### E. Review reward — **NOT POSSIBLE YET**
- There is no review/rating model, API, or UI. A review feature (verified-purchase binding, moderation,
  edit/delete semantics) must be specified and built first. Suggested key once it exists:
  `review_reward:{orderId}` (one per order) or `review_reward:{orderId}:{menuItemId}` (one per dish).

### F. Promotional / campaign rewards — **EXISTS**
- `RewardCampaign`: types `ORDER_MULTIPLIER | ORDER_BONUS | CATEGORY_BONUS | REFERRAL_BOOST | MISSION_BOOST |
  NEW_USER_BONUS | LOYALTY_EXCLUSIVE | SEASONAL_BONUS`; modes `FIXED_DAMRU | MULTIPLIER | PERCENT_BONUS`;
  audiences; branch/category/item filters; per-event, per-user, and global budget caps; `startsAt`/`endsAt`;
  stacking `NO_STACK | BEST_ONLY | STACK_ALLOWED` (`models/RewardCampaign.ts`).
- "Weekend Food Festival, 2×" = `ORDER_MULTIPLIER`, `MULTIPLIER`, `rewardValue: 2`, Fri 00:00 → Sun 23:59.
  **Caveat:** the multiplier applies only to `baseReward` (the order reward). It does not apply to first-order, dish, or tier rewards.
- Campaign timing is checked **at delivery time**, not at order time (`campaignEngine.ts:18`). An order placed
  Sunday 23:00 and delivered Monday 00:30 gets no weekend bonus. **Decision needed.**
- Coupons are a separate discount system and should **not** be reused for earning. Private reward coupons are
  already issued by occasion rules (`rewardEngine.ts:55-71`).

---

## 6. Proposed Rewards Architecture

Principle: **one engine, one ledger, one trigger.** Every new rule feeds `awardDamru()`
(`lib/rewardEngine.ts:74`). It must not write `damruBalance` itself (per `AGENTS.md`).

```
                           ┌───────────────── Order Reward Evaluator (new, pure) ─────────────────┐
 Order (delivered+eligible)│  inputs: order.items snapshot, eligibleRewardAmount, branchId, user   │
            │              │  rules:  DamruConfig.orderEarn (base)   ← replaces hard-coded /10     │
            ▼              │          EarnRule[ITEM|CATEGORY]        ← new                         │
 app/actions/orders.ts ───►│          EarnRule[ORDER_VALUE_TIER]     ← new                         │
 (delivered branch)        │  output: [{kind, amount, ruleSnapshot}]  (integers, floor)            │
                           └───────────────┬───────────────────────────────────────────────────────┘
                                           ▼
                     awardDamru({ idempotencyKey, category, orderId, ruleSnapshot })   (existing)
                                           ▼
          DamruTransaction (ledger, unique key) → User.damruBalance $inc → lot fields → debt recovery
                                           ▼
                     awardCampaignBonuses(baseReward = <decided components>)          (existing)
                                           ▼
                   notifyRewardEvent (in-app/email) · riskEngine · analytics          (existing)
```

The same pure evaluator also powers **earn previews** in `POST /api/checkout/quote` and in the menu payload, so
the preview and the award can never drift.

---

## 7. Database Changes

Only entities that are actually needed. **No new wallet or ledger collection.**

### 7.1 `EarnRule` (new collection) — needed for dish, category, and order-value tiers

`RewardRule` cannot hold these rules: its `category` is a unique enum of five singleton rules (`models/RewardRule.ts`).
`RewardCampaign` is built for time-boxed promotions with budgets and stacking, not standing rules.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `name`, `code` | String | `code` unique, uppercase |
| `ruleType` | enum `ITEM \| CATEGORY \| ORDER_VALUE_TIER` | |
| `menuItemIds` | ObjectId[] → `MenuItem` | ITEM |
| `categoryIds` | ObjectId[] → `Category` | CATEGORY |
| `branchIds` | ObjectId[] → `Branch` | empty = all branches (dine-in has no branch today; see M11) |
| `basis` | enum `PER_UNIT \| PER_LINE \| PER_ORDER` | **business decision** |
| `damruPerUnit` | Integer ≥ 0 | ITEM/CATEGORY |
| `tiers` | `[{ minAmountPaise: Int, damru: Int }]` | ORDER_VALUE_TIER, sorted, validated |
| `tierMode` | enum `HIGHEST_MATCH \| CUMULATIVE \| SLAB` | **business decision** |
| `maxDamruPerOrder` | Int \| null | cap |
| `stackWithBase` | Boolean | whether it adds to the per-₹ base |
| `includeInCampaignBase` | Boolean | whether multipliers apply to it |
| `startsAt`, `endsAt` | Date \| null | optional; standing rules have none |
| `status` | enum `DRAFT \| ACTIVE \| PAUSED \| ARCHIVED` | soft delete = `ARCHIVED`; never hard-delete (the ledger references `ruleId`) |
| `version` | Int | incremented on edit; snapshotted on credit |
| `createdBy`, `updatedBy` | ObjectId → `Admin` | audit |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `{ code: 1 } unique`; `{ status: 1, ruleType: 1 }`; `{ menuItemIds: 1, status: 1 }`;
`{ categoryIds: 1, status: 1 }`.

### 7.2 Changes to existing models

| Model | Change | Why |
|---|---|---|
| `DamruConfig` | Add `orderEarn: { rupeesPerDamru: Int (default 10), rounding: "FLOOR", enabled: Boolean }` | Removes the three hard-coded `/10` sites |
| `DamruConfig` | Add `paisePerDamru: Int` (e.g. 10) **replacing** float `redemptionRate` (keep reading the old field during migration) | Integer money (§8, §10 of this doc) |
| `DamruConfig` | Optional `maxRedemptionPercent: Int \| null`, `redeemableComponents` | Only if the business requires them (§23) |
| `DamruConfig.dailyEarnLimit` | Enforce in `awardDamru` **or remove** | Currently dead (H7) |
| `DamruTransaction` | Add `ruleSnapshot: Mixed` (rule id, version, basis, inputs) on order-derived credits | Reversal must use the rule **in force at award time**, not today's config |
| `DamruTransaction.category` enum | Add `item_reward`, `tier_reward` (and later `review_reward`) | Analytics and reversal attribution |
| `reversalEngine` `DIRECT_ORDER_CATEGORIES` | Include new order-derived categories | Otherwise they would never be clawed back |

No other new tables are required. `coin_wallets`, `coin_ledger`, `coin_expiry`, `reward_transactions`, and
`reward_redemptions` are **already covered** by `User` wallet fields, `DamruTransaction`, its lot fields, and
`redemption` debits.

---

## 8. Wallet Architecture

**Existing: Option B, hybrid.** `User.damruBalance` is the authoritative spendable balance. `DamruTransaction` is the
immutable ledger. Credits also act as expiry "lots" (`remainingAmount`, `expiresAt`).

| Wallet field | Meaning |
|---|---|
| `damruBalance` | Spendable balance. Never goes negative: debits use a guarded `$gte` update (`damruAllocation.ts:195-199`) |
| `damruTotalEarned` | Lifetime credits; drives legacy `loyaltyLevel` |
| `damruTotalRedeemed` | Lifetime redemptions |
| `rewardDebt` | Clawback shortfall; recovered from future credits (`reversalEngine.ts:413-462`) |

Negative balances are prevented structurally. A clawback larger than the balance becomes **Reward Debt** instead.

**Weakness (H9):** issuance is three separate writes (ledger insert → wallet `$inc` → patch `balanceAfter`,
`rewardEngine.ts:81-113`). A crash between the first two leaves a ledger credit that never reached the wallet. A retry then
hits the duplicate key and returns `duplicate: true` without repairing it. `lib/rewards/walletReconciliation.ts`
detects this but never repairs it. Mitigations: MongoDB transactions if the cluster is a replica set (**UNKNOWN**),
or a `status: PENDING→POSTED` field on the ledger row plus a sweeper.

---

## 9. Ledger Architecture

`DamruTransaction` (`models/DamruTransaction.ts`) compared with the requested fields:

| Requested | Existing field | Note |
|---|---|---|
| transaction_id | `_id` | |
| user_id | `userId` | |
| type | `type` (`credit`/`debit`) + `category` (20 values) | EARN/BONUS/REDEEM/EXPIRE/REVERSAL/ADJUSTMENT all map to categories |
| source / reference_type / reference_id | `orderId`, `ruleId`, `campaignId`, `couponId`, `refundId`, `originalTransactionId`, `sourceType`, `sourceId` | |
| coins | `amount` (min 0, **not integer-enforced**) | H4 |
| balance_before | **absent** | Derivable as `balanceAfter ∓ amount`. Not required |
| balance_after | `balanceAfter` | Patched after the wallet write (non-atomic) |
| monetary_value | **absent** | Recommend `valuePaise` at write time, so later rate changes do not rewrite history |
| description | `description` | |
| metadata | `campaignSnapshot` | Generalise to `ruleSnapshot` (§7.2) |
| status | **absent** | Rows are final on insert. See §8 for the `PENDING` option |
| expires_at | `expiresAt` + `originalAmount`/`remainingAmount`/`expiredAmount` | FEFO lots |
| created_at | `createdAt` | |
| idempotency | `idempotencyKey` **unique** | Core safety mechanism |
| audit | `adjustedBy`, `adjustmentReason`, `reversalReason`, `reversalNote` | |

Transaction-type mapping: EARN → `order_reward` / `first_order` / `mission` / … ; BONUS → `campaign`,
`loyalty_tier`; REDEEM → `redemption`; EXPIRE → `expiry`; REFUND → `refund_restore`; REVERSAL →
`reward_reversal`; ADJUSTMENT → `admin_credit` / `admin_debit`; plus `reward_debt_recovery` and `legacy_opening_balance`.

Ledger rows are never deleted or rewritten, with one deliberate exception: a debt-recovery row is deleted when the
guarded wallet update fails in the same call (`reversalEngine.ts:449-453`).

---

## 10. Reward Rule Engine & Idempotency

### 10.1 Existing idempotency keys (all enforced by the unique `DamruTransaction.idempotencyKey`)

| Event | Key | File |
|---|---|---|
| Welcome | `welcome_registration_{userId}` | `rewardEngine.ts:357` |
| First order | `first_order_{userId}` / `first_order_requalified:{userId}:{triggerId}` | `rewardEngine.ts:385-387` |
| Order reward | `order_reward:{orderId}` | `rewardEngine.ts:408` |
| Campaign | `campaign:{campaignId}:{userId}:{sourceId}` + `RewardCampaignUsage` unique `(campaignId,userId,sourceId)` | `campaignEngine.ts:39`, `models/RewardCampaignUsage.ts` |
| Daily login | `daily-login:{userId}:{YYYY-MM-DD}` + atomic date guard | `rewardEngine.ts:552-566` |
| Occasions | `{category}_{userId}_{year}` | `rewardEngine.ts:491` |
| Referral | `referral:{referralId}:referrer\|referred` | `referralEngine.ts:88,104` |
| Mission | `mission:{userId}:{missionId}:{periodKey}` | `missionEngine.ts:98` |
| Achievement | `achievement:{userId}:{achievementId}` | `achievementEngine.ts:58` |
| Loyalty bonus | `loyalty-tier:{userId}:{tierId}` | `loyaltyEngine.ts:104` |
| Redemption | `redeem_order_{orderId}` | `rewardEngine.ts:177` |
| Admin adjust | `admin_adjust_{client requestId}` | `rewardEngine.ts:253-255` |
| Refund restore | `refund_restore_{refundId \| cancel_<orderId>}` | `refunds.ts:96` |
| Expiry | `damru-expiry:{lotId}` + atomic lot claim | `damruAllocation.ts:363` |
| Reversal | `reward-reversal:{originalTxId}:{triggerId}` + unique on `RewardReversal` | `reversalEngine.ts:138` |
| Debt recovery | `reward-debt-recovery:{creditTxId}` | `reversalEngine.ts:417` |
| Legacy migration | `legacy-opening-balance:{userId}` | `lib/rewards/damruMigration.ts:54` |

### 10.2 Duplicate-award scenarios

| Scenario | Outcome |
|---|---|
| Payment webhook ×2 / verify + webhook race | `finalizeRazorpayPayment` conditional update; payment never awards Damru → **safe** |
| Order set to delivered twice / status toggled back and forth | Every order key is per order → **safe** |
| App refresh / network retry of the delivered action | Same keys → **safe** |
| Cron retried | Occasion keys per year, expiry per lot, referral per side → **safe** |
| Admin double-click on adjust | Same `requestId` → **safe** |
| Two cancellations or refunds for the same trigger | `(originalTxId, triggerId)` unique → **safe** |
| Campaign award throws after reservation | Usage row set `RELEASED` but **not deleted**, so retries find the unique row and skip. **The bonus is permanently lost** (M2) |
| Crash between ledger insert and wallet `$inc` | Ledger credit without wallet credit; retry reports duplicate (H9) |

### 10.3 Keys for new rules

- Base order reward: keep `order_reward:{orderId}`.
- Item rule: `item_reward:{orderId}:{earnRuleId}` (one credit per rule per order; line detail in `ruleSnapshot`).
- Tier rule: `tier_reward:{orderId}:{earnRuleId}`.
- Review (future): `review_reward:{orderId}` or `…:{menuItemId}`, depending on the decision.

Keys must **not** include the amount or the rule version. Otherwise editing a rule would allow a second credit for the same order.

---

## 11. API Requirements

Conventions observed: customer routes under `/api/rewards/*` and `/api/checkout/*` authenticate with
`getUserFromCookie` and scope every query by `userId`. Admin routes under `/api/admin/rewards/*` call
`checkApiPerm("rewards", action)` and should call `logAdminAction`. Errors are `{ error: string }` with 4xx/5xx.
Rate limits use `checkRateLimit(key, RATE_LIMITS.x)`.

### 11.1 Existing reward endpoints (keep)

Customer: `GET /api/rewards/{dashboard,history,coupons,upcoming,achievements,missions,referrals,loyalty,expiry,campaigns}`.
Admin: `/api/admin/rewards/{config,rules,campaigns[/:id],loyalty[/:id],missions[/:id],achievements[/:id],daily,referrals[/config],risk[/:id|/config],analytics,users[/:id|/adjust|/risk|/unlock],transactions/:id/reverse}`.
Internal: `GET /api/internal/rewards/run-scheduler` (Bearer `CRON_SECRET`).

### 11.2 New or changed endpoints

| Method & route | Auth / authz | Request | Response | Validation | Idempotency | Rate limit |
|---|---|---|---|---|---|---|
| `GET /api/admin/rewards/earn-rules` | admin, `rewards.view` | `?status&type&page` | `{ rules, total }` | paging bounds | read | — |
| `POST /api/admin/rewards/earn-rules` | `rewards.create`; `logAdminAction` | rule body (§7.1) | `{ rule }` | integers ≥ 0, sorted non-overlapping tiers, referenced ids exist, `startsAt < endsAt` | unique `code` | adminAdjust-style |
| `PUT /api/admin/rewards/earn-rules/[id]` | `rewards.edit`; audit with before/after | partial body | `{ rule }` | same; bumps `version` | `version` precondition (optimistic lock) | same |
| `DELETE /api/admin/rewards/earn-rules/[id]` | `rewards.delete` | — | `{ success }` | sets `ARCHIVED` only | naturally idempotent | same |
| `POST /api/checkout/quote` (**extend**) | existing | unchanged | adds `estimatedDamru: { total, lines[], isEstimate: true }` | computed by the same server evaluator | read | add a limiter (none today) |
| `GET /api/menu` / `GET /api/home-menu` (**extend**) | public | unchanged | adds `rewardBadge?: { damru, basis }` per item from ACTIVE ITEM/CATEGORY rules | server-only | read; cache with menu | — |
| `GET /api/rewards/history?orderId=` (**extend**) | customer; filter AND `userId` | `orderId` | transactions for that order | valid ObjectId | read | — |
| `GET /api/admin/rewards/transactions?format=csv` | `rewards.view` (+ export permission if added) | date range, category, user | CSV stream | bounded range (e.g. ≤ 366 days) | read | yes |
| `POST /api/rewards/redeem` (**restrict or remove**) | customer | `{orderId, amount}` | — | must require an owned order in `pending`/`confirmed`, unpaid, with no Razorpay order yet, **and** apply the discount to the order; otherwise remove it (no UI calls it) | `redeem_order_{orderId}` | `redeemDamru` limiter exists |

No `POST /rewards/earn` endpoint should exist. Earning must only be a server-side side effect of an authoritative event.

---

## 12. Website Changes

Existing: rewards tab in `app/(website)/my-profile/page.tsx` (history, coupons, upcoming, missions,
achievements, referrals, expiry, `components/rewards/ActiveCampaignOffers.tsx`); checkout redemption input and
server quote (`app/(website)/checkout/page.tsx:53-71,277,402`); `RewardsProvider` mounted in
`app/(website)/layout.tsx:78`.

| Location | Change | File |
|---|---|---|
| Menu card | "Earn N Damru" badge from `rewardBadge` in the menu payload (no extra request) | `app/(website)/menu/MenuItemCard.tsx`, `app/(website)/menu/MenuClient.tsx` |
| Cart | "You'll earn ~N Damru" from quote `estimatedDamru` | `app/(website)/cart/page.tsx` |
| Checkout | Same as cart, updated with every quote; **label as an estimate** (campaign timing uses delivery time) | `app/(website)/checkout/page.tsx` |
| Order success / order details | "Earned on delivery" or actual credited amount via `history?orderId=` | my-profile orders section |
| Wallet | Show `≈ ₹` using server-provided `paisePerDamru` | my-profile rewards |
| Checkout redemption | Client preview (lines 53-71) is display-only and replaced by the server quote. Keep it, but clamp input to whole numbers | same |

SSR/CSR: menu pages are server components with client cards. Badges ride in the existing payload, so there is no hydration mismatch and no extra round trip.
Accessibility: badges need text, not icon-only.

---

## 13. APK (Android / Expo) Changes

Existing: `src/components/profile/RewardsSection.tsx`, `src/app/rewards-{history,achievements,missions,referrals,loyalty}.tsx`,
checkout redemption (`src/app/checkout.tsx:67-113,478-495`), `src/services/rewardsApi.ts`, `src/types/rewards.ts`.

| Item | Current | Required |
|---|---|---|
| Reward API | Same endpoints as web | Consume new `estimatedDamru`, `rewardBadge`, `history?orderId=` |
| Menu cards | No reward display | Badge in `src/components/menu/MenuProductCard.tsx`, `src/components/ui/MenuCard.tsx` |
| Cart / checkout | Redemption only | Earn estimate from quote |
| Order detail | No reward display (`src/app/order/[id].tsx`) | Earned or "earns on delivery" |
| Stale balance | Default `staleTime` 60 s, `refetchOnMount: false` (`src/lib/queryClient.ts`); rewards queries 30 s; `focusManager` wired to `AppState` (`src/app/_layout.tsx:59-64`) | Invalidate `["rewards"]` on order-detail open when the status is `delivered`, and after any cancel or redeem |
| Offline | React Query cache only; no persistence | Show "last updated" if the balance is served from cache after an error |
| Push | None | Needs `expo-notifications` + server sender (§15) |
| Deep links | Notifications route to `/my-profile?tab=rewards` (web path) | Map to the mobile rewards screen |
| Types | Transaction category union updated for campaign/reversal/debt | Add `item_reward`, `tier_reward` |
| Unused code | `redeemDamru()` in `rewardsApi.ts` has no caller | Remove with the endpoint change |
| Lint | Known `eslint-config-expo/flat` issue (`AGENTS.md`) | Use `npx tsc --noEmit` as the gate |

---

## 14. Admin Panel Changes

Existing reusable pieces: `app/admin/rewards/RewardsClient.tsx` (config + rules), `app/admin/rewards/campaigns/CampaignsClient.tsx`
(already has item/category/branch pickers and date ranges), `app/admin/rewards/analytics/*`, `app/admin/rewards/risk/*`,
per-user adjust and reversal routes, and the `confirmAction` dialog.

| # | Brief item | Status |
|---|---|---|
| 1-4 | Create, edit, enable/disable rule; set amount | Exists for the 5 singleton rules and for campaigns. **New:** earn-rules screen (reuse campaign form pickers) |
| 5-7 | Dish, restaurant (branch), category rewards | **New** (EarnRule) |
| 8 | Order-value tiers | **New** |
| 9-10 | Campaigns with dates | Exists |
| 11-12 | Reward caps, user limits | Exist on campaigns; **new** `maxDamruPerOrder` on EarnRule; enforce `dailyEarnLimit` or remove it |
| 13 | Expiry | Exists (default OFF) |
| 14-15 | Transactions; user wallet search | Exists (`/api/admin/rewards/users`) |
| 16-17 | Manual credit/debit | Exists; **add integer validation**, optional per-action cap or second approval |
| 18 | Reverse reward | Exists (`transactions/[id]/reverse`) |
| 19 | Analytics | Exists; **add** per-rule/per-dish breakdown |
| 20 | Export | **Missing** |
| — | Order detail | **Add** a "Damru issued/reversed for this order" panel (`app/admin/orders/[id]/OrderDetailClient.tsx` shows none) |

---

## 15. Notification Changes

| Channel | Status | Evidence |
|---|---|---|
| In-app | Working, deduplicated per source (`dedupKey`) | `lib/notifications/rewardNotificationService.ts:97-113` |
| Email | Working for eligible types, respects `notificationPreferences.rewardUpdates` | same file, lines 118-128 |
| Push | **Not implemented.** `PushDevice` model only; "PUSH intentionally never added" | `rewardNotificationService.ts:130`, `models/PushDevice.ts` |
| SMS | **Not implemented** | — |

Existing reward notification types already cover the examples in the brief: credit ("you earned"), `DAMRU_EXPIRING_SOON`
(30/7/1-day windows), `DAMRU_EXPIRED`, `REWARD_ADJUSTED` (reversal), `DAMRU_RESTORED`, `COUPON_ISSUED`.
New item/tier credits get notifications automatically once `mapCreditCategoryToType` maps the new categories.
To avoid spamming, send **one** notification per order summarising all order credits, not one per rule.

---

## 16. Security Audit

| Threat | Status | Evidence / gap |
|---|---|---|
| Client-side reward calculation | **Safe.** Awards computed server-side only; client redemption preview is replaced by server quote | `checkout/page.tsx:53-71` is display-only |
| Unauthorized balance manipulation | Customer routes cannot credit; admin requires `rewards.edit` | `adjust/route.ts:14` |
| API tampering: prices | Prices re-resolved from `MenuItem` | `resolveOrderItems.ts` |
| API tampering: redemption amount | **Gap.** Non-integer accepted; debit not capped to payable | H4, C2 |
| IDOR | Customer queries scoped by `userId` | e.g. `orders/[id]/cancel/route.ts:24` |
| Forged order IDs on redeem | Ownership checked, but **state is not** | H5 |
| Replay / duplicate requests | Unique idempotency keys (§10) | — |
| Webhook replay | HMAC over raw body + idempotent finalizer + amount check | `webhooks/razorpay/route.ts:41-75` |
| Race conditions | Guarded `$gte` wallet debit, atomic lot claims, campaign budget `$expr` guards | `damruAllocation.ts`, `campaignEngine.ts:31-35` |
| Negative balance | Prevented; shortfall → `rewardDebt` | `reversalEngine.ts:165-175` |
| Privilege escalation | Module×action permissions on every admin route | `lib/checkApiPerm.ts` |
| Admin abuse | Ledger records `adjustedBy` + reason; risk engine scores adjustments. **No per-action cap or dual approval** | M10 |
| Missing audit logs | `logAdminAction` missing on `config` (coin value), `users/[id]/adjust`, `achievements`, `missions`, `daily` routes | H8 |
| Suspended users | Session JWT stays valid up to 7 days; `awardDamru` does not check `User.status` | M5 |
| Server-action state machine | `updateOrderStatus` accepts any status, including `cancelled` and backward moves; the UI hides some, the server does not | M1 |
| Account farming | Welcome reward before verification | H10 |
| Secrets fallback | `AUTH_SECRET \|\| "damru-secret-key"` fallback in `proxy.ts`/`auth.config.ts`. `AUTH_SECRET` is in the production-required list (`lib/env.ts:34`, enforced by `instrumentation.ts`), so the fallback only applies outside production | Low; remove the literal eventually |

---

## 17. Fraud Prevention

Existing `lib/rewards/riskEngine.ts` (detect, score, flag; never auto-mutates) covers earn and redeem velocity, refund and
cancellation abuse, reversals, debt, referral farming, campaign abuse, and admin adjustments. Admin review lives at `app/admin/rewards/risk/*`.

For new rules:
- Rule-level caps (`maxDamruPerOrder`) and enforced `dailyEarnLimit`.
- Dish rewards invite **basket padding + cancellation**. Already neutralised: nothing is awarded before delivery and cancellation reverses.
- High-value dish rewards on COD are exposed if COD failed-payment still earns. Fix H6 first.
- Add a risk signal for "item-reward share of order value above X%".
- Review rewards (future): verified purchase only, one per order, no reward on edit, reversal on moderator removal.

---

## 18. Refund / Reversal Handling

Implemented (`lib/rewards/recomputeEntitlements.ts`, `lib/rewards/reversalEngine.ts`):

| Event | Order reward / campaign | First order | Referral | Missions / achievements | Loyalty | Redeemed Damru |
|---|---|---|---|---|---|---|
| Cancel (any time) | Full reversal | Reverse + requalify next | Clawback + requalify | Recompute; revoke if below target | Re-evaluate (no bonus clawback) | Restored if COD or unpaid |
| Full refund | Full reversal | Same | Same | Same | Same | Restored on full refund |
| Partial refund | Proportional; FIXED campaign fully reversed | — | — | — | Re-evaluated | **Not restored** |
| Chargeback | **No handler** (no Razorpay dispute events processed) | | | | | |
| Coins already spent | Balance → 0, remainder becomes `rewardDebt`; future credits repay it first | | | | | |

**The ₹1,000 / 100-Damru example:** today the full 100 is reversed. If the user has 30 left, the wallet goes to 0 and
`rewardDebt` becomes 70. The balance never goes negative. Future earnings are not blocked; they are **consumed
by debt first**. The business must ratify this (§23 #10-11).

New dish and tier credits must be added to `DIRECT_ORDER_CATEGORIES` and given a partial-refund formula that uses
`ruleSnapshot`. Refunds carry an amount, not item lines, so an item-level clawback is impossible without a decision (§23).

---

## 19. Expiry System

Fully implemented, **disabled by default** (`DamruConfig.expiryEnabled = false`, `expiryDays = null`):
- Per-credit lots with `expiresAt`; FEFO then FIFO consumption (`damruAllocation.ts:107-115`).
- Daily cron claims due lots atomically and writes `expiry` debits (`:350-407`).
- Warnings at 30, 7, and 1 days, deduplicated per lot per window (`:430-462`).
- Refund restores Damru into the **original** lots, keeping the original expiry (`refunds.ts:125-138`).
- The legacy balance migration script exists: `scripts/migrate-damru-expiry-lots.ts`. **UNKNOWN whether it has run in production.**
  `reconcileDamruLots` will report every un-migrated user as a mismatch.

Decisions needed: enable or not, duration, and whether new earn types expire.

---

## 20. Analytics

Existing (`lib/rewards/analyticsService.ts:20-105`): gross, net, and reversed issuance; redeemed; expired; restored; outstanding;
**liability** (outstanding × rate); reward debt; redemption rate; breakage; source breakdown; trends; expiry buckets;
top balances and earners (masked email); streaks, missions, achievements, referrals, loyalty, coupons; risk.

| Brief metric | Available? |
|---|---|
| Issued / redeemed / expired / reversed / liability / active wallets / top users / redemption rate | **Yes** |
| Campaign performance | Partial: `RewardCampaign.issuedDamru`, `qualifyingEvents`, `rewardedUsers` (last counter is heuristic, L2) |
| Average coins per order | Derivable (`order_reward` sum ÷ distinct `orderId`); not shown |
| Reward cost in ₹ | Yes via `calculateLiability`; float rate (M9) |
| Top reward dishes | **No.** Needs `item_reward` + `ruleSnapshot.lines` |
| Export | **No** |

Note: `activeUsers` uses `$addToSet` over the whole period inside a `$facet`. At large volumes this can hit the
16 MB document limit. Replace it with a separate `$group` count before the data grows.

---

## 21. Performance Considerations

- **Delivered action cost:** `updateOrderStatus` runs about 7 reward steps sequentially, each doing several round trips
  (`app/actions/orders.ts:58-93`). It is acceptable for an admin action. New rules should be evaluated in **one**
  query (`EarnRule.find({status:"ACTIVE", $or:[{menuItemIds:{$in}}, {categoryIds:{$in}}, {ruleType:"ORDER_VALUE_TIER"}]})`)
  and credited in one pass.
- **Per-page wallet fetch:** `RewardsProvider` in the website layout calls `/api/rewards/dashboard?view=wallet` on every
  page load for logged-in users. That call makes about 5 DB round trips, including an expiry aggregation. Consider a lighter
  balance-only view, or fetching lazily on checkout/profile.
- **Menu badges:** compute from active EarnRules with a short in-process TTL cache (same pattern as `getDamruConfig`)
  and merge into the existing menu response. **Do not add a per-card request.**
- **Quote:** the evaluator is pure over already-loaded items. Only the cached rules lookup is added.
- **Indexes:** see §7.1. Existing ledger indexes cover history, per-order, lot, expiry, and analytics scans.
- **History pagination** uses `skip`. That is fine at current scale; switch to cursor on `createdAt` later.

---

## 22. Testing Strategy

**Step 0: restore the deleted suite** (`git show 8096579^:tests/...`), adapt it to current code, and make `npm test` green.
Nothing below should start until this is done.

| Layer | Cases |
|---|---|
| Unit (pure) | base earn with configurable ₹ per Damru and floor; per-unit vs per-line dish; category; tier modes (highest, cumulative, slab) at boundaries (₹499.99, ₹500, ₹1,000, ₹1,200); caps; campaign multiplier base selection; paise conversion (no float); partial-reversal formula using `ruleSnapshot`; expiry FEFO |
| Integration | COD delivered → credits; Razorpay paid → delivered → credits; unpaid online blocked; **COD failed → no credit**; cancel after delivery → reversal + debt; full and partial refund; referral qualify and clawback; campaign window at order vs delivery time |
| Idempotency / concurrency | delivered ×N in parallel → one credit per key; redeem ×N parallel → one debit; redemption vs expiry race; campaign budget exhaustion under concurrency; award crash-window simulation |
| Security | redeem with fractional amount (reject); redeem > payable (cap or reject, no silent loss); redeem on delivered/paid/cancelled order (reject); customer calling admin routes (403); permission matrix; IDOR on `history?orderId=` |
| Mobile | Android physical device: slow 3G, offline → online, background → foreground balance refresh, app restart with cached queries, Razorpay return path |
| Web | desktop/tablet/mobile breakpoints; SSR menu with badges (no hydration warnings); checkout quote refresh; accessibility of badges |
| Tooling | `npx tsc --noEmit` (root and `mobile-app`); targeted `npx eslint <files>`; `next build` |

---

## 23. Business Decisions Required

"Today" is what the code does now. That behaviour is **unratified** unless marked otherwise. Nothing below can be safely inferred.

| # | Decision | Today (code default) | Where |
|---|---|---|---|
| 1 | Value of 1 Damru | `redemptionRate` default **₹0.10** (100 = ₹10). **Production DB value UNKNOWN** | `models/DamruConfig.ts`, `lib/getDamruConfig.ts:16` |
| 2 | When coins are awarded | On **delivered** + (COD or paid) | `rewardEngine.ts:403` |
| 3 | Maturity/hold period before spendable | None for orders; referrals have `rewardDelayDays` | — |
| 4 | Base earn rate | **1 Damru per ₹10**, floor, hard-coded | `rewardEngine.ts:406` |
| 5 | Dish reward per unit, per line, or per order | Not supported | — |
| 6 | Order-value tiers: highest match, cumulative, slab, or percent; replaces or adds to base | Not supported | — |
| 7 | Do discounted items earn | Yes, on post-coupon subtotal | `orders/route.ts:127-129` |
| 8 | Taxes included in earn base | No | same |
| 9 | Delivery fee included in earn base | No | same |
| 10 | Reversal after refund | Full: reverse all order-linked credits; partial: proportional to payable | §18 |
| 11 | If reversed coins were already spent | Reward Debt, repaid from future credits; balance never negative | `reversalEngine.ts` |
| 12 | Partial refund: restore redeemed Damru? | No (only on full refund) | `refunds.ts:187` |
| 13 | Coins with coupons | Allowed | `orders/route.ts:216-223` |
| 14 | Max % of order payable with coins | No % cap; limited by `maxRedemptionPerOrder` (default 2000) and payable | `DamruConfig` |
| 15 | Coins pay delivery fee / taxes | **Yes, both.** Damru is applied after tax and delivery. **Needs tax-advisor review** (GST treatment of loyalty redemption) | `checkoutCharges.ts:271-273` |
| 16 | Min redemption | 100 Damru | `DamruConfig` |
| 17 | Redeem more than payable | **Debits all, discounts only up to payable** (defect C2): cap or reject? | §24 |
| 18 | Coins on COD | Allowed | `orders/route.ts:213` |
| 19 | Earn on coin-paid portion | **Yes**: earn base excludes Damru discount | `orders/route.ts:129` |
| 20 | Expiry | Off; duration unset | `DamruConfig` |
| 21 | Max daily earning | Field exists, **not enforced** | H7 |
| 22 | Max monthly earning | None | — |
| 23 | Admin manual adjust | Allowed with reason; no cap or second approval | `adjust/route.ts` |
| 24 | Transferable between users | No (no endpoint) | — |
| 25 | Refundable to cash | No (no endpoint) | — |
| 26 | Promotional stacking | `BEST_ONLY` default; stack only if **all** eligible campaigns allow | `campaignMath.ts` |
| 27 | Multiple rules per order | Base + first-order + campaign(s) + mission/achievement/referral/loyalty can all fire | `orders.ts:58-93` |
| 28 | Campaign multiplier applies to which components | Only base order reward | `orders.ts:66` |
| 29 | Campaign window judged at order time or delivery time | Delivery time | `campaignEngine.ts:18` |
| 30 | Welcome reward before email/phone verification | Issued immediately (blocker per existing readiness doc) | `register/route.ts:52` |
| 31 | COD marked `failed` but delivered: earns? | Earns (defect H6) | `orderPaymentPolicy.ts:18` |
| 32 | Guest dine-in orders | No reward, no claim flow | — |
| 33 | Suspended users earn? | Yes | M5 |
| 34 | Review reward rules (per order or dish, edits, deletions) | No review feature | — |
| 35 | Chargeback handling | Not handled | — |
| 36 | Fractional Damru ever allowed? | Not enforced either way | H4 |
| 37 | Has the legacy expiry-lot migration run in production? | UNKNOWN | `scripts/migrate-damru-expiry-lots.ts` |

---

## 24. Critical Gaps

Format: **location** · current → required · impact · fix · dependencies.

### Critical

**C1. Test suite deleted.** `tests/` (45 files) removed in `8096579`; `npm test` has nothing to run.
→ Restore and re-green before any ledger change. · Impact: every change to a value-bearing ledger is unverified. · Fix: restore from `8096579^`, update to current code. · Deps: none.

**C2. Redemption over-debit.** `app/api/orders/route.ts:212-227` debits `requestedDamru` in full. `calculateOrderTotals`
caps the discount at the payable amount (`lib/checkout/checkoutCharges.ts:271-273`). The quote route does not reject this either (`app/api/checkout/quote/route.ts:68`).
Example: ₹150 payable, 2,000 Damru (₹200) requested → 2,000 debited, ₹150 discount, 500 Damru value lost.
→ Server must cap the Damru to `ceil(payablePaise / paisePerDamru)` (or reject) **before** debiting. · Fix: compute the max redeemable in the quote and order routes; pass the capped amount to `redeemDamru`. · Deps: decision #17.

### High

**H1. Base earn rate hard-coded** in `rewardEngine.ts:406`, `app/actions/orders.ts:63`, `reversalEngine.ts:124`.
→ One config value + `ruleSnapshot`; reversal uses the snapshot. · Deps: decision #4.

**H2. No dish/category per-unit rewards.** → EarnRule ITEM/CATEGORY (§7.1). · Deps: #5.

**H3. No order-value tiers.** → EarnRule ORDER_VALUE_TIER. · Deps: #6.

**H4. Non-integer Damru accepted.** `app/api/orders/route.ts:212`, `app/api/rewards/redeem/route.ts:15-18`,
`app/api/checkout/quote/route.ts:60-68`, `app/api/admin/rewards/users/[id]/adjust/route.ts:19` use `Number()` without `Number.isInteger`.
`allocateDebit` only checks finite and > 0 (`damruAllocation.ts:166`). → Enforce integers at the engine boundary (`redeemDamru`, `adjustDamru`, `awardDamru`, `allocateDebit`).

**H5. Orphan redeem endpoint.** `POST /api/rewards/redeem` → `redeemDamru` checks only ownership and one-per-order
(`rewardEngine.ts:166-182`). It never updates `Order.damruDiscount`/`finalAmount`. It is callable on delivered, paid, or cancelled
orders, and on pending Razorpay orders whose `paymentAmount` is already frozen. No UI calls it. → Remove it (and the client
wrappers `lib/rewards/rewardApi.ts`, `mobile-app/src/services/rewardsApi.ts:26`), or gate it by order state.

**H6. COD with failed payment still earns.** `lib/orders/orderPaymentPolicy.ts:18,30-36`. → Exclude `cod` + `paymentStatus: "failed"` from `paymentEligibleOrderFilter()` and `isOrderPaymentEligible`. · Deps: #31.

**H7. `dailyEarnLimit` is dead config.** Editable in `app/admin/rewards/RewardsClient.tsx:319`; never read by any engine.
→ Enforce in `awardDamru` (define which categories count) or remove it from the UI. · Deps: #21.

**H8. Missing admin audit logs.** `app/api/admin/rewards/config/route.ts` (coin value, redemption limits, expiry),
`users/[id]/adjust`, `achievements`, `missions`, `daily` routes do not call `logAdminAction`. → Add before/after audit entries.

**H9. Non-atomic issuance.** `rewardEngine.ts:81-113` (and `adjustDamru` credit). → Transactions (if replica set) or
ledger `status` + repair sweeper; at minimum schedule `walletReconciliation` with alerting.

**H10. Welcome reward before verification.** `app/api/user/register/route.ts:43-55`. → Gate welcome reward and referral on verification. · Deps: #30.

**H11. No earn preview.** The quote returns no `estimatedDamru`; menu has no badges. → §11.2.

### Medium

- **M1** `app/actions/orders.ts:32-43`: no transition state machine. `status: "cancelled"` via `updateOrderStatus` skips coupon release,
  Damru restoration, and `cancelledBy`/`cancelledAt`. Backward transitions are allowed. → Allowed-transition map; route cancellation through `cancelOrder`.
- **M2** `lib/rewards/campaignEngine.ts:39`: a failed award leaves `RewardCampaignUsage` `RELEASED`, which blocks all retries. → Delete the row or allow re-reserve from `RELEASED`.
- **M3** Failures in the delivered pipeline are only `console.error`-ed (`orders.ts:64-92`). No retry. → Re-runnable "recompute delivered rewards for order" admin action, or an outbox.
- **M4** Missions and referral qualification use `order.total` (`orders.ts:79,84`); base reward uses `eligibleRewardAmount`. → Choose one definition of "spend".
- **M5** Suspended users keep earning and using a valid session. → Check `User.status` in `awardDamru` and redemption.
- **M6** Push notifications absent. → `expo-notifications` + server sender using `PushDevice`.
- **M7** No reward display on menu, cart, or order detail (web and mobile).
- **M8** Documentation drift and missing referenced docs (§3.2).
- **M9** `redemptionRate` is a float ₹/Damru; `Math.round(amount * rate)` (`rewardEngine.ts:206`, `quote/route.ts:71`, `finalizePayment.ts:51`). → Integer `paisePerDamru`.
- **M10** No cap or dual approval on admin credits.
- **M11** Dine-in orders have no `branchId`, so branch rules cannot apply (already recorded in `REWARDS_PRODUCTION_READINESS.md`).
- **M12** No reward export.
- **M13** COD refunds (cash) have no reward-reversal hook other than manual transaction reversal.

### Low

- **L1** First-order `deliveredCount !== 1` (`rewardEngine.ts:381-382`): two deliveries at the same moment → neither qualifies.
- **L2** `rewardedUsers` counter heuristic (`campaignEngine.ts:39`).
- **L3** Config cache is 60 s per serverless instance: rule and rate changes propagate with delay.
- **L4** `skip` pagination on history.
- **L5** Unused `RewardsProvider.redeem` and mobile `redeemDamru`.

---

## 25. Implementation Plan

| Phase | Scope | Files / modules | DB | API | Web | Mobile | Tests | Depends on | Risk |
|---|---|---|---|---|---|---|---|---|---|
| **0. Hardening** | C1, C2, H4-H8, M1, M2 | `tests/**`, `app/api/orders/route.ts`, `app/api/checkout/quote/route.ts`, `lib/rewardEngine.ts`, `lib/rewards/damruAllocation.ts`, `lib/orders/orderPaymentPolicy.ts`, `app/actions/orders.ts`, `lib/rewards/campaignEngine.ts`, admin reward routes | none | redeem endpoint removed/gated | clamp input | remove unused redeem | restored suite + new cases | decisions #17, #21, #31 | Low |
| **1. Money model** | integer `paisePerDamru`, `orderEarn` config, `ruleSnapshot`, `valuePaise` | `models/DamruConfig.ts`, `lib/getDamruConfig.ts`, `models/DamruTransaction.ts`, reversal engine | config migration (one script) | config route + audit | wallet ₹ display | same | unit money tests | #1, #4 | Medium (touches redemption math) |
| **2. Evaluator** | pure `evaluateOrderEarn(order, rules, config)` | new `lib/rewards/orderEarn.ts`; replace the 3 `/10` sites | — | — | — | — | exhaustive unit tests | Phase 1 | Low |
| **3. EarnRule** | model + admin CRUD | `models/EarnRule.ts`, `app/api/admin/rewards/earn-rules/*` | new collection + indexes | §11.2 | — | — | CRUD, validation, permissions | #5, #6 | Low |
| **4. Order integration** | credit item/tier rewards on delivery; reversal support | `app/actions/orders.ts`, `lib/rewards/reversalEngine.ts`, `recomputeEntitlements.ts`, `DamruTransaction.category` enum | enum values | — | — | — | integration + idempotency + refund | Phases 2-3; #10, #28 | **High** (financial path) |
| **5. Previews** | quote `estimatedDamru`; menu `rewardBadge`; `history?orderId=` | `app/api/checkout/quote`, `app/api/menu`, `app/api/home-menu`, `app/api/rewards/history` | — | extend | — | — | contract tests | Phase 2 | Low |
| **6. Admin UI** | earn-rules screen; order-detail Damru panel; export | `app/admin/rewards/*`, `app/admin/orders/[id]/OrderDetailClient.tsx` | — | CSV export | — | — | permission checks | Phases 3-4 | Low |
| **7. Website** | badges, cart/checkout estimate, order earned | §12 files | — | — | yes | — | web matrix | Phase 5 | Low |
| **8. Android** | same surfaces + cache invalidation | §13 files | — | — | — | yes | device matrix | Phase 5 | Medium (release cycle) |
| **9. Notifications** | order-summary credit notice; push (optional) | `lib/notifications/*`, mobile push | `PushDevice` in use | device register | — | `expo-notifications` | dedupe tests | Phase 4 | Medium (new dependency) |
| **10. Analytics & risk** | per-rule/dish metrics; item-reward risk signal; fix `$addToSet` scale issue | `lib/rewards/analyticsService.ts`, `riskEngine.ts` | — | — | admin | — | formula tests | Phase 4 | Low |
| **Later** | Review feature → review reward | new review domain | new | new | new | new | full | #34 | High (new domain) |

---

## 26. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shipping ledger changes without tests | High (suite deleted) | High | Phase 0 gate |
| Rate change silently re-values history / reversals | Medium | High | `ruleSnapshot` + `valuePaise` at write time |
| Double credit after rule edit | Low | High | Keys exclude amount/version (§10.3) |
| Customer value loss on over-redemption | Happens today | Medium | C2 |
| Crash-window wallet drift | Low | Medium | H9 + scheduled reconciliation |
| Multi-account farming (welcome/referral) | Medium | Medium | H10, risk engine |
| Dish-reward basket padding on COD | Medium | Medium | H6, caps, delivery-only trigger |
| Tax treatment of Damru applied to GST | UNKNOWN | High (compliance) | Tax-advisor decision #15 |
| Liability growth with expiry off | Medium | Medium | Decision #20; liability KPI exists |
| Push adds new native dependency to APK | Medium | Low | Separate phase; EAS build test |
| Next.js 16 API differences | Medium | Low | Read `node_modules/next/dist/docs/` per `AGENTS.md` |

---

## 27. Acceptance Criteria

1. `npm test` runs a restored suite, all green; `npx tsc --noEmit` passes at the root and in `mobile-app`; `next build` passes.
2. For any delivered, payment-eligible order, repeated or concurrent delivery transitions produce **exactly one** credit per rule key.
3. No order earns before `delivered`; unpaid online orders and COD orders marked `failed` never earn.
4. A redemption never debits more Damru than the discount it applies; all Damru amounts in the ledger are integers.
5. Base earn rate, dish/category rules, and tiers are configurable in admin, audit-logged, and snapshotted on each credit.
6. Full refund or cancellation reverses every order-derived credit using the snapshot; shortfall becomes Reward Debt; the balance never goes negative.
7. Quote `estimatedDamru` equals the credited amount for the same order when no campaign window or rule changes between checkout and delivery.
8. Menu badges add **zero** extra client requests; the menu p95 response time does not regress by more than 10%.
9. Wallet reconciliation reports zero mismatches for test accounts before and after order → refund → reversal → debt-recovery.
10. Every admin mutation of reward configuration, rules, or balances has an `AdminAuditLog` entry.
11. Android: balance refreshes on foreground and after delivery-status view; no stale balance after redeem or cancel.
12. Every decision in §23 is either ratified in writing or explicitly accepted as the current default.

---

## 28. Final Readiness Assessment

The platform is materially more mature than the brief assumes: ledger, idempotency, expiry, reversals, debt,
campaigns, referral, risk, analytics, and both client surfaces exist and follow sound patterns. The remaining work is
**extension** (configurable earn rate, dish/category/tier rules, previews) plus **hardening** (test suite, redemption cap,
integer enforcement, the orphan redeem endpoint, COD failed payment, dead config, audit logs).

# IMPLEMENTATION READINESS

**Status: READY WITH BUSINESS DECISIONS**
(Review rewards: **NOT READY**, because no review feature exists.)

Exact blockers:
1. **Business decisions** §23 #1, #4, #5, #6, #10–#12, #14, #15, #17, #20, #21, #28, #29, #31 must be ratified before Phases 1–4.
2. **Restore the automated test suite** deleted in `8096579`. No ledger-affecting change should merge without it.
3. **Fix C2 (redemption over-debit) and H4 (non-integer Damru)** before adding any new earning source.
4. **Tax/finance sign-off** on applying Damru to taxes and delivery (§23 #15).
5. Existing blockers carried over from `docs/REWARDS_PRODUCTION_READINESS.md`: registration verification gate (H10),
   Razorpay **test-mode** end-to-end validation, `/api/rewards/campaigns` deployment check, and physical-device testing.
6. Confirm whether the production MongoDB is a replica set (transactions available?) and whether the expiry-lot migration has run.

# RECOMMENDED NEXT STEP

After the business decisions are finalised, develop in this order:

1. **Restore tests.** Recover `tests/` from `8096579^`, fix it for current code, and make `npm test` green in CI.
2. **Phase 0 hardening.** C2 redemption cap → H4 integer enforcement → H5 remove/gate `/api/rewards/redeem` → H6 COD failed-payment
   eligibility → H7 enforce or remove `dailyEarnLimit` → H8 audit logs → M1 order-status state machine → M2 campaign retry. Each with tests.
3. **Phase 1 money model.** Integer `paisePerDamru`, `DamruConfig.orderEarn`, `ruleSnapshot` and `valuePaise` on credits; one-time config migration.
4. **Phase 2 evaluator.** A single pure `evaluateOrderEarn()` that replaces the three hard-coded `/10` sites, reversal included.
5. **Phase 3 `EarnRule`.** Model and admin CRUD with audit logging.
6. **Phase 4 order integration.** Item and tier credits on delivery, reversal and partial-refund support, new ledger categories.
7. **Phase 5 previews.** Quote `estimatedDamru`, menu `rewardBadge`, `history?orderId=`.
8. **Phases 6–8 UI.** Admin earn-rules and order Damru panel → website → Android (with cache invalidation).
9. **Phases 9–10.** Consolidated credit notification (push optional); per-rule analytics, export, item-reward risk signal.
10. **Separately:** specify and build a review feature; only then add a review reward on the same engine.
