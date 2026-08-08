# Damru Production Readiness & Security Hardening

Date: 2026-08-08
Scope: the production-risk items deferred by `docs/CONSISTENCY_AUDIT.md` — reward date-policy inconsistency, admin blanket permission bypass, hardcoded JWT fallback secret, mobile checkout hardcoded preview values, admin-adjustment idempotency, plus rate limiting, security headers, environment validation, audit logging, authorization regression, error-response safety, and a minimal regression test harness. No general refactor was performed; behaviour outside these areas is unchanged.

## Security Changes

- **Hardcoded JWT/session fallback secrets removed.** `lib/env.ts` adds `getRequiredSecret(name)`: in production a missing secret throws (fails the request/startup) instead of silently falling back to a guessable string; in development it logs a warning and returns a clearly-marked `dev-only-insecure-*` placeholder. Replaces the old `process.env.X || "hardcoded-string"` pattern in `lib/otp.ts`, `lib/userSession.ts`, `lib/tableAuth.ts`, and the table QR-token signing in `app/api/admin/tables/route.ts` / `app/api/admin/tables/[id]/route.ts`. Secrets are read lazily at the point of use (never at module import time), so a missing dev secret can't break `next build`.
- **Security headers** added in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` (camera/microphone/geolocation/browsing-topics off), and `Strict-Transport-Security` (production only, since HTTPS termination can't be assumed in local dev). No Content-Security-Policy was added — see Known Deferred Risks.
- **Production responses no longer leak internals.** Several admin and one public route (`app/api/banquet-bookings` POST) returned raw `err.message` on failure, which could surface Mongoose validation text or MongoDB internals (collection/index names via `E11000` errors). All affected catch blocks now log the real error server-side (`console.error`) and return a fixed, safe message to the client. No route returns a raw error object or stack trace.
- **Rate limiting** added for high-risk endpoints — see Rate Limits below.
- **Audit logging** added for admin actions that previously had no attribution trail — see Authorization Model below.

## Environment Requirements

`.env.example` (repo root) documents every variable name the app reads — no values, safe to commit. Categories: Database (`MONGODB_URI`), Admin session/NextAuth (`AUTH_SECRET`, `NEXTAUTH_URL`), Customer session/OTP signing (`JWT_SECRET`), Internal scheduler (`CRON_SECRET`), Email/SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`), Media/ImageKit, Mobile app (`EXPO_PUBLIC_API_URL`), Payment gateway (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — see `docs/RAZORPAY_INTEGRATION.md`).

`lib/env.ts`'s `validateProductionEnv()` is the central startup check: in production it returns the names (never values) of any required variable that's missing. `instrumentation.ts` calls it once at server startup and **throws**, refusing to serve requests with an incomplete production configuration, rather than failing unpredictably later on the first request that needs the missing secret.

Required in production: `MONGODB_URI`, `AUTH_SECRET`, `NEXTAUTH_URL`, `JWT_SECRET`, `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

**Conditionally required:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — the app stays COD-only and startup succeeds if none of the three are set. Once any one is set, all three become required (a half-configured gateway — e.g. a key with no way to verify its webhooks — is worse than none).

## Authorization Model

- **Admin bypass is now explicit, not accidental.** `models/Admin.ts` adds `isSuperAdmin: boolean` (default `false`). The shared predicate `adminBypassesPermissions(role, isSuperAdmin)` in `lib/adminPermissions.ts` (used by both `lib/checkApiPerm.ts` and `getAdminPerms()`) resolves to: `super_admin` role always bypasses; `admin` role bypasses **unless** `isSuperAdmin` was explicitly stored as `false`. No new role names were introduced.
- **Backward compatibility is by construction, not migration.** Mongoose schema defaults only apply to newly-created documents, not to existing ones read via `.lean()` — so every pre-existing `role: "admin"` account has `isSuperAdmin: undefined`. The predicate treats `undefined !== false` as "still bypasses," so existing production admins keep exactly the access they had before this change, with zero required migration step. `scripts/migrate-admin-superadmin-flag.ts` is provided to backfill an explicit `true` for those accounts if you want the database state to be self-documenting — it is optional, not required for safety, and safely re-runnable.
- Super-admin status is **never** inferred from email or user ID — only from the stored `role`/`isSuperAdmin` fields.
- `app/admin/managers` (create/edit) exposes an `isSuperAdmin` checkbox, shown only for `role: "admin"` accounts.
- **Admin-adjustment idempotency.** Manual Damru credits/debits (`lib/rewardEngine.ts`'s `adjustDamru`) intentionally allow legitimate repeated adjustments (an admin crediting the same user twice, deliberately, is a valid action) — so deduplication is **not** keyed by `userId + amount + reason`. Instead, the client (`app/admin/rewards/RewardsClient.tsx`) generates a `requestId` (`crypto.randomUUID()`) once per adjustment *attempt* and reuses it across retries of that same click; the server (`app/api/admin/rewards/users/[id]/adjust/route.ts`) derives the ledger idempotency key from it. A retried/double-submitted request is rejected as a duplicate with the balance unchanged; a new deliberate adjustment (new `requestId`) always succeeds. Covered by `tests/adminAdjustIdempotency.test.ts`.
- **Audit logging.** `models/AdminAuditLog.ts` + `lib/auditLog.ts`'s `logAdminAction()` record admin identity, action, target, and (non-secret) details for actions that previously had no attribution: birthday/anniversary unlock, reward-rule edits, referral-config edits, loyalty-tier create/edit, and admin account create/update/delete. Manual Damru credit/debit were already traceable via `DamruTransaction.adjustedBy`/`adjustmentReason` and are unchanged. Logging failures are swallowed (logged, not thrown) so a logging hiccup never blocks the underlying admin action.

## Reward Timezone Policy

**Decision: a deliberate split policy**, not a single blanket timezone, because unifying everything onto one zone would have required migrating already-accruing user state (streaks) for no correctness benefit:

- **Occasion rewards** (birthday, marriage anniversary, account anniversary — `lib/rewardEngine.ts`'s `OCCASION_RULES` / `runOccasionRewards`) are matched against **Asia/Kolkata (IST)** calendar dates, via `istDateParts()` (an `Intl.DateTimeFormat` helper) combined with MongoDB's aggregation `timezone` option on `$month`/`$dayOfMonth`/`$year`. Rationale: these are real-world calendar-date concepts for an India-focused platform — a birthday should unlock on the user's actual IST birthday, not shift by up to 5.5 hours depending on server host timezone or UTC boundary drift. Previously this logic used the server's local time inconsistently mixed with UTC-based Mongo aggregation operators — a real, if narrow, bug window. Covered by `tests/rewardDateBoundary.test.ts` (midnight/year-boundary cases where UTC and IST disagree on "what day it is").
- **Daily Streak** (`lib/dailyStreak.ts`) and **Missions** (`lib/missionPeriod.ts`) intentionally **stay on UTC**, unchanged. Both were already internally consistent with each other before this PRD, and converting them to IST would require a migration decision for every user's in-progress streak (do you preserve the streak across the timezone shift? recompute it? risk of double-awarding or skipping a day at the cutover) — a real product-behavior change with user-facing risk, not a pure bug fix, so it was left as-is per this PRD's "no general refactor, no double-award/skip risk" constraint.
- **Coupon validity boundaries, referral reward delay, and loyalty timestamps** were audited and found to use plain `Date` comparisons with no timezone-sensitive calendar-day logic (they compare instants, not calendar dates), so they're not affected by either policy and needed no change.
- No cutover migration was necessary: this only changes which calendar day a not-yet-awarded occasion reward matches against going forward. No user's already-issued reward or idempotency key is altered retroactively.

## Checkout Calculation Source

- **Backend remains the sole authority** for the actual charged total — `app/api/orders/route.ts` was not modified.
- **New:** `GET /api/checkout/config` (`app/api/checkout/config/route.ts`) — a minimal, read-only, customer-facing endpoint returning only `{ taxRate, freeDeliveryAbove, deliveryCharge }` from `lib/getSettings()`. It deliberately excludes every other field `getSettings()` carries (including SMTP credentials). This is explicitly **not** a second order-calculation engine — it supplies the same inputs the backend already uses so the pre-submit preview stops guessing.
- **Website** (`app/(website)/checkout/page.tsx`) fetches this config on mount; its tax/delivery calculation logic was already correctly wired to the resulting state, it was only missing the live fetch (previously used hardcoded fallback defaults).
- **Mobile** (`mobile-app/src/app/checkout.tsx`) previously hardcoded `deliveryFee = 0` unconditionally and a fixed 5% tax rate — meaning any order below the free-delivery threshold showed an incorrect ₹0 preview that didn't match what would actually be charged. Now fetches the same config via TanStack Query (`queryKeys.checkout.config()`) and computes `tax`/`deliveryFee`/`total` with the identical formula `app/api/orders/route.ts` uses (`Math.round(subtotalAfterDiscount * taxRate / 100)`), falling back to the same defaults (`taxRate: 5`, `freeDeliveryAbove: 500`, `deliveryCharge: 50`) if the fetch fails.
- **Online payment (Razorpay) was subsequently added** — see `docs/RAZORPAY_INTEGRATION.md` for the full design. In short: `POST /api/payments/razorpay/order` computes the actual payable amount server-side (`order.total` net of any Damru redeemed for that order — the ₹ value `order.total` itself never included) and that figure, never a client-supplied one, is what Razorpay charges. Neither website nor mobile calculates a payment amount themselves.

## Rate Limits

No prior rate-limit infrastructure existed. `lib/rateLimit.ts` implements a minimal, server-side, fixed-window counter backed by a single TTL-indexed Mongo collection (`models/RateLimit.ts`) — no Redis/Upstash dependency added. The window boundary is baked into the document key so concurrent `$inc`s are naturally race-safe (with an explicit fallback path for the rare concurrent-upsert duplicate-key race), and expired windows self-clean via the TTL index with no separate sweep job. Exceeding the limit returns `429` with a `Retry-After` header and a generic message — no internal state or secrets in the response or in log keys.

Applied to (`RATE_LIMITS` in `lib/rateLimit.ts`):

| Endpoint | Key | Limit |
|---|---|---|
| `POST /api/user/login` | IP + email | 10 / 10 min |
| `POST /api/user/register` | IP | 5 / hour |
| `POST /api/user/send-otp` | IP + email | 5 / 10 min |
| `POST /api/user/verify-otp` | IP | 10 / 10 min |
| `POST /api/user/reset-password` | IP | 10 / 10 min |
| `POST /api/rewards/redeem` | user id | 10 / 10 min |
| `POST /api/admin/rewards/users/[id]/adjust` | admin id | 30 / 10 min |
| `POST /api/coupons` (validate) | IP | 30 / 10 min |
| `GET /api/search`, `GET /api/blog-search` | IP | 60 / 10 min |
| `POST /api/payments/razorpay/order` | user id | 20 / 10 min |
| `POST /api/payments/razorpay/verify` | user id | 20 / 10 min |
| `POST /api/admin/orders/[id]/refund` | admin id | 20 / 10 min |
| `POST /api/admin/orders/[id]/reconcile-payment` | admin id | 30 / 10 min |

`POST /api/webhooks/razorpay` is deliberately **not** rate-limited by IP — its security is the Razorpay webhook signature, and IP limiting could drop legitimate retry deliveries from Razorpay's servers.

Not blanket-applied to every GET endpoint, per the PRD's explicit scope. Covered by `tests/rateLimit.test.ts` and live-verified against the dev server (11th login attempt in a 10-minute window returns 429; normal single attempts are unaffected).

## Known Deferred Risks

- **No Content-Security-Policy.** The site serves images from several external hosts (Unsplash, ImageKit, Google avatars) plus Razorpay's checkout script/frames; a strict script/connect CSP needs a full audit of every external origin (now including Razorpay's, captured from a real Test Mode transaction) before it can be enabled. See `docs/RAZORPAY_INTEGRATION.md`'s CSP Requirements section.
- **Daily Streak and Missions remain on UTC**, not IST (see Reward Timezone Policy) — an intentional, documented decision, not an oversight.
- **Rate-limit storage is Mongo, not an in-memory/edge store.** Adequate for current traffic; if request volume grows enough that the extra DB round-trip per high-risk request becomes a bottleneck, a dedicated store (e.g. Upstash Redis) would be the next step — no code depends on Mongo specifically, `checkRateLimit()` is the only integration point.
- **CRON_SECRET-gated scheduler (`app/api/internal/rewards/run-scheduler`) has no separate rate limit** — it's not user-reachable (requires the bearer secret) and is intended to be called only by Vercel Cron, so it was judged out of scope for the high-risk endpoint list.
- **Razorpay mobile SDK / New Architecture compatibility is unverified** — `react-native-razorpay` (the official SDK) is flagged by `expo-doctor` as unsupported on the New Architecture, which this app has enabled. No Android SDK/emulator or macOS machine was available to build and test on a real device. A native build and on-device Test Mode payment are required before mobile online payment ships. Full detail in `docs/RAZORPAY_INTEGRATION.md`'s Known Deferred Risks.
- **Refunds, reconciliation, and Damru/coupon restoration are now implemented** — see `docs/PAYMENT_RELIABILITY_REFUNDS.md` for the full state machine, concurrency-safety design, and the deliberate policy decisions (full-refund-only Damru restoration; coupon release on cancellation, not on transient payment failure). This supersedes the earlier "no refund flow" note from the initial Razorpay integration.
- **Partial-refund Damru restoration policy is undefined** — a partial refund updates `refundedAmount`/`paymentStatus` correctly but restores no Damru; a proportional or line-item allocation policy needs an explicit product decision. See `docs/PAYMENT_RELIABILITY_REFUNDS.md`.
- **Live Razorpay refund testing was not performed** — no test-mode captured payment was available to refund end-to-end in this environment.

## Production Deployment Checklist

1. Set every variable listed in `.env.example` in the production environment (see Environment Requirements) — the app will refuse to start if any of the required ones are missing (`instrumentation.ts` + `validateProductionEnv()`).
2. Confirm `NODE_ENV=production` is set — this gates the JWT/secret fallback behavior, HSTS header, and env validation.
3. If you want existing `role: "admin"` accounts to have an explicit (rather than implicit/legacy) `isSuperAdmin: true` in the database, run `scripts/migrate-admin-superadmin-flag.ts` — optional, not required for correct behavior.
4. Run `npx tsc --noEmit` (root) and `cd mobile-app && npx tsc --noEmit` — both must be clean.
5. Run `npm run build` — must succeed with no new warnings.
6. Run `npm test` — all regression tests (`tests/*.test.ts`) must pass; requires `MONGODB_URI` to be reachable (tests create and clean up their own disposable documents).
7. Confirm HTTPS termination is in place before relying on the production-only HSTS header.
8. Re-verify the manual checks below after any further auth/rewards/checkout changes: unauthenticated access to `/api/rewards/*` and `/api/admin/*` returns 401/403; a deactivated admin cannot act; a staff account without a permission gets 403; login/OTP endpoints 429 after their configured limit; a usageLimit=1 coupon under two simultaneous checkout attempts only applies once; website and mobile checkout previews match the backend-authoritative total.
9. Before enabling online payment: set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`, complete the Test Mode checklist in `docs/RAZORPAY_INTEGRATION.md`, confirm Auto Capture is enabled on the Razorpay Dashboard, and — for mobile specifically — perform a real device/emulator build and test payment before shipping (New Architecture compatibility is unverified; see that doc).
10. Confirm the Vercel project's cron plan supports the `*/15 * * * *` schedule on `/api/internal/payments/reconcile` (`vercel.json`) — if the plan only allows daily cron, the admin "Recheck Payment" action is the reliable fallback in the meantime. Complete the refund/reconciliation Test Scenarios in `docs/PAYMENT_RELIABILITY_REFUNDS.md` with a real captured Test Mode payment before enabling refunds in production.
