# Damru Codebase Consistency Audit

Date: 2026-08-08
Scope: full repository (website, backend/API, admin, mobile app, Mongoose models) — consistency and safe cleanup only. No product behaviour, reward amounts, business rules, or UI design were changed.

## Executive Summary

Two-pass audit (research, then fix) across naming, reward-engine/idempotency, API contracts, authentication/authorization, ownership, website/mobile parity, date/money handling, and dead code. Ownership and reward-engine integrity were the highest priority and came back clean — no customer can reach another customer's data, and no code bypasses the central Damru reward engine. The real, fixable findings were concentrated in **admin authorization gaps** (three routes with missing or wrong permission checks, and a completely unenforced `isActive` flag on admin accounts) plus a **coupon usage-limit race condition** and some **type/index hygiene**. All fixes are small, additive, and preserve existing behaviour for every already-working path.

## Baseline

- `npx tsc --noEmit` (root): clean, 0 errors.
- `cd mobile-app && npx tsc --noEmit`: clean, 0 errors.
- `npm run lint` (root): 4745 pre-existing problems (535 errors / 4210 warnings) — the large majority originates from `mobile-app/` being swept into the root ESLint config (a pre-existing tooling artifact; mobile has its own separate Expo lint environment, which has its own already-known `eslint-config-expo/flat` issue). Not touched — out of scope per the "known Expo ESLint issue" instruction.
- `npm run build`: succeeded. Build log showed Mongoose "duplicate schema index" warnings for `Coupon.code`, `Order.orderId`, `Table.tableNumber`, `GalleryTab.tabKey`, `Blog.slug` — fixed (see below).
- Git baseline: all pre-existing uncommitted work (PRD 3A–3D reward system, performance-optimization changes, documentation PDFs) recorded via `git status` before any edit; nothing reset or discarded.

## P0 Findings (Security / data integrity)

**None confirmed.** Specifically verified clean:
- No direct `damruBalance` mutation exists anywhere outside `lib/rewardEngine.ts`'s three controlled primitives (`awardDamru`, `redeemDamru`, `adjustDamru`).
- Every customer-resource query that accepts a client-supplied id (orders, reward history, redemption's `orderId`, private coupons, addresses, referrals) is correctly scoped by the authenticated session's `userId` before it reads or mutates anything. No cross-user data access path found.
- Order-status wiring for every reward trigger (first-order, achievements, missions, referrals, loyalty) uses the identical `"delivered"` literal, matching `models/Order.ts`'s enum — no drift.

## P1 Findings

1. **`app/api/admin/settings/route.ts` had no permission check at all** — any authenticated admin or manager, even one granted zero permissions, could read and modify site-wide settings (tax rate, delivery charge, free-delivery threshold). Every sibling admin route uses `checkApiPerm`; this one only checked that a session existed. **Fixed.**
2. **Admin `isActive` flag was selected but never enforced** — `lib/checkApiPerm.ts`, `lib/adminPermissions.ts`, and the NextAuth `authorize()` callback in `auth.ts` all fetched `isActive` from the database but never read it. A deactivated admin could still log in and pass every permission check. **Fixed** at all three checkpoints (login, `checkApiPerm`, `getAdminPerms`).
3. **`lib/checkApiPerm.ts` had no null-check on the admin lookup** — if the session's email didn't resolve to an `AdminUser` document (e.g. a stale session for a deleted admin), `admin.role` would throw, crashing the route with an unhandled 500 instead of a clean 401. **Fixed.**
4. **Coupon `usageLimit` enforcement had a check-then-act race** — `app/api/orders/route.ts` read `coupon.usedCount < coupon.usageLimit`, then separately incremented `usedCount` in an unconditional `findByIdAndUpdate`. Two concurrent orders redeeming the same near-limit coupon could both pass the check and both increment, overselling the coupon past its configured limit. **Fixed**: the increment is now a single atomic `findOneAndUpdate` with the limit condition in the filter (`$expr: { $lt: ["$usedCount", "$usageLimit"] }`). If the atomic reservation fails (limit was hit in the race window), the order still succeeds — it just proceeds without the discount, exactly as if the coupon had already been fully used.

## P2 Findings

1. **Three more admin routes had missing or mismatched permission checks**, all fixed to match the established `checkApiPerm(module, action)` pattern used everywhere else:
   - `app/api/banquet-bookings/route.ts` GET — had only a bare session check; sibling PATCH/DELETE already used `checkApiPerm("banquetBookings", ...)`. Now consistent.
   - `app/api/complaints/[id]/route.ts` PATCH/DELETE — staff-only (NextAuth) but ungated; any authenticated staff session, regardless of granted permissions, could edit/delete any complaint. Now gated with `checkApiPerm("complaints", "edit"|"delete")` (module key confirmed from the existing manager-permission list).
   - `app/api/reservations/[id]/route.ts` PATCH/DELETE — same gap, same fix with `checkApiPerm("reservations", ...)`.
2. **`app/api/admin/tables/orders/route.ts` gated on the wrong permission module** — it checked `checkApiPerm("settings", "view")` instead of `"tables"`, meaning a manager granted only "tables" access was incorrectly blocked, while one granted only "settings" got unintended access. **Fixed** to `"tables"`.
3. **`DamruTransactionCategory` type was missing two real enum values** in both `lib/rewards/rewardTypes.ts` (website) and `mobile-app/src/types/rewards.ts` (mobile) — `"loyalty_tier"` and `"order_reward"` exist in the backend `models/DamruTransaction.ts` enum and `loyalty_tier` is actually produced by `lib/loyaltyEngine.ts`, but neither frontend type included them. Currently masked because the UI renders transaction descriptions as plain strings rather than switching on category, so no visible bug today — but any future category-keyed UI (icon map, filter) would silently mishandle loyalty-tier rows. **Fixed** — both type files now match the backend enum exactly.
4. **Damru reward-amount fields accepted decimals with no integer validation** — `app/api/admin/rewards/{rules,daily,achievements,achievements/[id],missions,missions/[id],loyalty}/route.ts` all validated `amount >= 0` but never `Number.isInteger(amount)`, so an admin typo (e.g. `10.5`) would be stored and awarded as a fractional Damru amount, breaking the platform's whole-number Damru policy. **Fixed** — added `Number.isInteger` checks alongside every existing negative-value check, in all 7 call sites across the 5 admin routes.
5. **5 duplicate Mongoose index declarations**, confirmed via the build's own warnings: `Coupon.code`, `Order.orderId`, `Table.tableNumber`, `GalleryTab.tabKey`, `Blog.slug` — each had both a `unique: true` inline field option and a separate, redundant `Schema.index({...})` call for the same field. **Fixed** by removing the redundant explicit `.index()` call in each of the 5 model files; the `unique: true` index (identical semantics) remains. Build log confirms the warnings are gone.

## P3 Findings

- **Occasion rewards use local-server-time date components while Daily Streak and Missions use UTC** — `lib/rewardEngine.ts`'s birthday/marriage-anniversary/account-anniversary matching uses `date.getMonth()`/`getDate()`/`getFullYear()` (local timezone), combined with MongoDB's `$month`/`$dayOfMonth`/`$year` aggregation operators (UTC by default) — while `lib/dailyStreak.ts` and `lib/missionPeriod.ts` both explicitly and consistently use UTC day boundaries. No `TZ` environment variable is set anywhere in the repo. **Not fixed** — see Deferred section.
- **Admin-adjustment idempotency key is non-deterministic by design** (`admin_${adminId}_${Date.now()}_${randomBytes}` in `lib/rewardEngine.ts`'s `adjustDamru`), unlike every other reward path. A double-submitted admin adjustment would create two real balance changes with no dedup. **Not fixed** — see Deferred section (changing this risks blocking legitimate repeated adjustments, which is a product-intent question, not a pure bug).
- **`lib/otp.ts` and `lib/userSession.ts` both fall back to a hardcoded JWT signing secret** (`"damru-otp-secret"`) if `JWT_SECRET` is unset. This is a *consistent* pattern (both files agree), not a divergence — flagged as a security finding to fix in a dedicated pass, not silently changed here since removing the fallback could affect auth uptime in an environment where the var isn't configured (unverifiable from this environment).
- **Mobile checkout hardcodes a 5% tax rate and ₹0 delivery** instead of reading the same `siteSettings` the website and backend use — only affects the pre-submit preview total (the backend always recalculates authoritatively), so no charge is ever wrong, but the preview can be stale if an admin changes tax/delivery settings. Not fixed — touches checkout UI, explicitly restricted.
- **Analytics event naming diverges between platforms for the same action** — website `damru_redeemed` vs mobile's `damru_redemption_started/succeeded/failed`; website `coupon_used` (fires on click-through, arguably misleadingly named) vs mobile `coupon_shop_clicked`. Both are currently no-op/console-only stubs (no analytics SDK wired to either), so no real consumer is affected. Not fixed — renaming is a naming-convention judgment call with no functional benefit given no live consumer.
- **Mobile reward screens use two different data-fetching patterns** — `RewardsSection.tsx` (profile-embedded summary) uses TanStack Query with the shared `queryKeys` factory; the five full-screen reward routes (`rewards-achievements.tsx`, `rewards-missions.tsx`, etc.) use manual `useState`/`useEffect`/fetch instead. Both work correctly and don't collide on cache keys (different screens, no shared key), so this is a maintainability inconsistency, not a bug. Not fixed — converting 5 screens to a different fetching library is a non-trivial refactor outside this pass's scope.
- **`₹` currency formatting is duplicated inline across ~19 website/admin files** rather than through a shared `formatCurrency()` helper — but every instance formats identically (no thousands separators anywhere, consistent rounding), so this is confirmed *behaviourally* consistent, just not DRY. Not touched — a 19-file mechanical refactor for a purely stylistic gain is exactly the "broad speculative refactor" this audit was told to avoid.
- **`app/api/coupons/route.ts` POST uses a different response vocabulary** (`{valid, message}` + implicit 200 for validation failures) than every other route (`{error}` + 400). This is a real, working, already-consumed contract (website cart, mobile checkout both expect this exact shape) — changing it would be an API contract break requiring simultaneous multi-client migration, explicitly out of scope ("do not rename public APIs without migration", "preserve backward compatibility"). Documented only.

## Changes Implemented

### Security / Authorization
- `lib/checkApiPerm.ts` — added null-check on admin lookup (was an unhandled-crash risk) and `isActive` enforcement.
- `lib/adminPermissions.ts` — added `isActive` enforcement (matches the pattern of its existing "not found" branch).
- `auth.ts` — `authorize()` now selects and checks `isActive`, denying login for deactivated admins.
- `app/api/admin/settings/route.ts` — added `checkApiPerm("settings", "view"|"edit")`.
- `app/api/banquet-bookings/route.ts` — GET now uses `checkApiPerm("banquetBookings","view")`, matching its own PATCH/DELETE.
- `app/api/complaints/[id]/route.ts` — PATCH/DELETE now use `checkApiPerm("complaints","edit"|"delete")`.
- `app/api/reservations/[id]/route.ts` — PATCH/DELETE now use `checkApiPerm("reservations","edit"|"delete")`.
- `app/api/admin/tables/orders/route.ts` — corrected permission module from `"settings"` to `"tables"`.

### Backend / Data Integrity
- `app/api/orders/route.ts` — coupon `usedCount` increment converted from a two-step read-then-update into a single atomic conditional `findOneAndUpdate`, closing the usage-limit race. Order creation still succeeds either way; only the discount application is now race-safe.
- `models/Coupon.ts`, `models/Order.ts`, `models/Table.ts`, `models/GalleryTab.ts`, `models/Blog.ts` — removed 5 duplicate index declarations (kept the `unique:true`-derived index in each case; no index behaviour changed).

### APIs / Validation
- `app/api/admin/rewards/rules/route.ts`, `daily/route.ts`, `achievements/route.ts`, `achievements/[id]/route.ts`, `missions/route.ts`, `missions/[id]/route.ts`, `loyalty/route.ts` — added `Number.isInteger` validation alongside every existing non-negative check on Damru reward-amount fields (7 call sites total).

### Types
- `lib/rewards/rewardTypes.ts` (website) and `mobile-app/src/types/rewards.ts` (mobile) — added the missing `"order_reward"` and `"loyalty_tier"` members to `DamruTransactionCategory`, matching the backend enum exactly.

## API Consistency

Response-shape convention across `/api/user`, `/api/menu`, `/api/orders`, `/api/rewards/*`: dominant pattern is a bare object keyed by resource name for reads (`{orders}`, `{coupons}`) and `{success, <resource>}` for mutations — consistent across the large majority of routes. Two confirmed outliers, both left untouched as pre-existing, already-consumed contracts: `/api/coupons` POST (`{valid,message}` instead of `{error}`+400) and a few `dashboard`/`upcoming`/`loyalty` reward routes that flatten fields at the response root instead of wrapping in a named key. Authentication is uniformly via `getUserFromCookie` (customer) or NextAuth `auth()` (staff) — no route independently parses cookies/JWTs. Admin authorization is now uniformly via `checkApiPerm` after this pass's fixes (previously 3 gaps, now 0 confirmed).

## Website / Mobile Parity

Reward type shapes, all 9 reward API endpoints (dashboard/history/coupons/upcoming/redeem/achievements/missions/referrals/loyalty), and every status-enum comparison (Order, UserMission, UserAchievement, Referral) were confirmed to match field-for-field and casing-for-casing between website and mobile, aside from the `DamruTransactionCategory` type gap fixed above. `PROFILE_COMPLETE` logic lives only in `lib/achievementEngine.ts` — not reimplemented on either client. Progress percentages, tier progress, and discount amounts are computed server-side only. Deferred (documented, not fixed): mobile checkout's hardcoded tax/delivery preview, analytics event-name divergence, and the mixed data-fetching pattern across mobile reward screens.

## Reward System Consistency

Every Damru-producing flow (welcome, first order, birthday, anniversary, account anniversary, daily login, achievement, mission, referral, loyalty-tier bonus, redemption, admin adjustment) routes through `awardDamru`/`redeemDamru`/`adjustDamru` with a deterministic idempotency key, except admin adjustments (intentionally ad-hoc, documented above). `DamruTransaction` category strings are used consistently and exactly match the backend enum at every call site. Lifetime-spend computation for `LIFETIME_SPEND` achievements and loyalty-tier qualification independently aggregate `Order.total` for `status:"delivered"` orders identically — confirmed consistent, no fix needed.

## Authentication / Authorization

Customer auth: uniformly `getUserFromCookie`. Admin auth: NextAuth `auth()` + `checkApiPerm`/`getAdminPerms`, now consistently enforcing `isActive` and with the null-check/permission-module gaps closed (see Changes Implemented). The existing `role === "admin" || role === "super_admin"` blanket-bypass in `checkApiPerm`/`getAdminPerms` is unchanged — it's long-standing, intentional-looking design (grants full access to the two highest roles), not touched per the "don't redesign authorization" restriction; still worth a dedicated design review outside this pass.

## Data Validation

Backend remains authoritative everywhere checked (redemption amount, coupon eligibility, order totals, reward eligibility). Newly closed gap: Damru reward-amount fields now reject non-integer input at 7 admin-route call sites.

## Error Handling

`error` is the dominant, consistently-used failure key across nearly every route. One pre-existing, already-consumed outlier (`/api/coupons` POST) documented, not changed.

## Date / Currency Handling

Daily Streak and Mission period boundaries both explicitly use UTC day boundaries (`lib/dailyStreak.ts`, `lib/missionPeriod.ts` — the latter's own comment confirms it deliberately matches Daily Streak's policy). Coupon expiry/start-date comparisons use direct `Date` object comparison, which is timezone-safe regardless of server locale. The one confirmed inconsistency — occasion rewards (birthday/anniversary) using local-time date components — is documented above and in Deferred, not silently changed. Currency formatting (`₹value`) is duplicated across ~19 files but behaviourally identical everywhere; not touched.

## Performance Consistency

No regressions found in the previously-completed performance work (parallelized reads, indexes, `revalidate`). This pass's index-deduplication changes reduce write overhead slightly (one fewer index build per affected collection) without altering any query plan, since the surviving `unique:true` index covers the exact same field/uniqueness guarantee.

## Security Findings

| Finding | Status |
|---|---|
| Missing rate limiting | STILL PRESENT — out of scope (architectural) |
| Admin `role==="admin"` permission bypass | CONFIRMED, unchanged — long-standing intentional-looking design, flagged for a dedicated review |
| Admin `isActive` never enforced | **FIXED this pass** |
| `checkApiPerm` missing null-check on admin lookup | **FIXED this pass** |
| OTP carried in a signed (not encrypted) JWT, hardcoded fallback signing secret | STILL PRESENT — consistent pattern across `lib/otp.ts` and `lib/userSession.ts`, documented, not silently changed (auth-uptime risk unverifiable from this environment) |
| Coupon `usageLimit` concurrency race | **FIXED this pass** |
| Missing automated test / CI infrastructure | STILL PRESENT — out of scope (architectural) |
| No live payment gateway | STILL PRESENT — out of scope, not a consistency defect |
| Sensitive-data logging (passwords/OTP/tokens) | CONFIRMED CLEAN — no `console.*` call logs a raw secret value anywhere in `app/`, `lib/`, or `models/` |
| `NEXT_PUBLIC_` secret exposure | CONFIRMED CLEAN — no public env var name suggests a secret/key |
| 3 admin routes with missing/wrong `checkApiPerm` | **FIXED this pass** (settings, banquet-bookings GET, complaints/[id], reservations/[id], tables/orders module fix) |

## Dead/Duplicate Code

- `models/DamruTransaction.ts`'s `"order_reward"` category and `lib/loyaltyEngine.ts`'s `getLoyaltyRewardMultiplier`/`applyLoyaltyMultiplier`/`LoyaltyRewardSource` are fully scaffolded but never called from any order-reward path — an incomplete feature, not unreachable dead code in the traditional sense (their types are now referenced by the fixed `DamruTransactionCategory`). Left in place; not proven safe to delete and not blocking anything.
- No other confirmed-unused component, API wrapper, or helper was found and independently proven unreferenced (unused by mobile/admin/scripts) within this pass's research budget. Per instruction, nothing was deleted without that proof.

## Deferred High-Risk Changes

1. **Occasion-reward date policy (local vs. UTC)** — real inconsistency vs. Daily Streak/Missions, but fixing it changes which calendar day a birthday/anniversary reward fires on in some server-timezone configurations, and the actual deployment timezone (Vercel functions default to UTC, but this isn't verifiable from source alone) can't be confirmed from this environment. Recommend: explicitly set `TZ=UTC` in the deployment environment, then switch `lib/rewardEngine.ts`'s `OCCASION_RULES` to `getUTCMonth()/getUTCDate()/getUTCFullYear()` to match Daily Streak/Missions, as a dedicated follow-up with its own review.
2. **Admin-adjustment idempotency** — currently allows (by design, it seems) repeated identical adjustments to all succeed, since each gets a unique key. Whether double-submit protection is actually wanted is a product decision, not something to infer. Recommend: if wanted, add a client-generated request nonce rather than deriving a key from adjustment content.
3. **`role==="admin"` blanket permission bypass** — long-standing design across `checkApiPerm` and `getAdminPerms`; changing its scope is an authorization-model redesign, explicitly out of scope for a consistency pass.
4. **Hardcoded JWT fallback secret** (`lib/otp.ts`, `lib/userSession.ts`) — recommend removing the fallback and requiring `JWT_SECRET` to be set in every environment, as a dedicated security follow-up (removing it now, without being able to confirm every environment has the var configured, risks breaking auth availability).
5. **Mobile checkout's hardcoded 5% tax / ₹0 delivery preview** — cosmetic-preview-only (backend is always authoritative), but fixing it touches checkout UI, which is explicitly restricted in this pass.

## Validation Results

- `npx tsc --noEmit` (root): clean, 0 errors — unchanged from baseline.
- `cd mobile-app && npx tsc --noEmit`: clean, 0 errors — unchanged from baseline.
- `npm run build`: succeeds; Mongoose duplicate-index warnings from the baseline build are gone.
- Targeted `npx eslint` on all 22 modified files: 0 new errors/warnings introduced (all remaining flagged lines are pre-existing `@typescript-eslint/no-explicit-any` on lines this pass did not touch, confirmed via line-level diff review).
- Regression smoke test (local dev server): `/api/admin/settings`, `/api/banquet-bookings`, `/api/complaints/[id]`, `/api/reservations/[id]` all correctly return 401 unauthenticated (no regression, no crash); `/api/coupons` and `/api/menu` (unrelated control) still return 200; `/api/orders` POST still returns its normal validation error (401 "Login required") with no 500, confirming the coupon-race code path is syntactically and structurally sound.
- Full end-to-end flows (login, checkout with a real coupon race, admin permission UI) were not exercised against live seeded data in this pass — recommended before deploying, per the existing project checklist.

## Documentation Impact

This pass's changes are additive/internal (permission gates, validation tightening, index cleanup, type completeness, one race-condition fix) and do not invalidate any claim in the previously-generated `docs/Damru_Client_Presentation.pdf` or `docs/Damru_Developer_Documentation.pdf` — both already documented "no rate limiting", "admin role bypasses permission checks", "isActive never enforced", and "coupon usageLimit TOCTOU race" as known findings. Of those, `isActive` enforcement and the coupon race are now fixed; if those PDFs are regenerated in the future, Developer Documentation §19 (Admin Architecture and Permissions), §21 (Security Properties), and §25 would need their wording updated from "STILL PRESENT" to "FIXED" for those two items specifically. Not regenerated in this pass, per instruction.
