# DAMRU

## Developer Technical Documentation

Website + Backend + React Native  
Version 1.0 · 7 August 2026  
Scope: current repository implementation

---

## 1. Project Overview

Damru is a TypeScript monorepository-style project containing a Next.js website, Next.js route-handler backend, administration interface, Expo/React Native mobile application, Mongoose models, and business services. MongoDB is the persistent store. Web and mobile clients share backend endpoints; the backend owns authentication, commerce validation, reward eligibility, progress, and redemption.

## 2. Technology Stack

| Layer | Technology | Repository version | Purpose |
|---|---|---:|---|
| Web/backend | Next.js | 16.2.4 | App Router, server actions, route handlers |
| Web UI | React / React DOM | 19.2.4 | Website and admin rendering |
| Language | TypeScript | 5.x root / 6.0 mobile | Static typing |
| Database | MongoDB + Mongoose | Mongoose 9.5.0 | Persistence and schemas |
| Authentication | NextAuth beta + custom customer sessions | 5.0.0-beta.31 | Admin and customer authentication patterns |
| Mobile | Expo | 57.0.10 | React Native application runtime |
| Mobile UI | React Native | 0.86.2 | Native screens |
| Mobile routing | Expo Router | 57.0.10 | File-based navigation |
| Mobile data | TanStack Query | 5.101.4 | Query caching and retry policy |
| Email | Nodemailer / Resend | 7.0.13 / 6.18.1 | Transactional messages |
| Passwords | bcryptjs | 3.0.3 | Password hashing |
| Tokens | jsonwebtoken | 9.0.3 | Signed token support |

## 3. Repository Structure

```text
damru/
├── app/                    Next.js pages, admin, APIs, server actions
├── components/             Website and admin components
├── lib/                    Database, auth, rewards, and business services
├── models/                 Mongoose models
├── public/                 Static website assets
├── scripts/                Seeds, schedulers, reconciliation utilities
├── styles/                 Website stylesheets
├── docs/source/            Documentation sources
├── mobile-app/
│   └── src/
│       ├── app/            Expo Router screens
│       ├── components/     Mobile UI
│       ├── lib/            API/query/analytics helpers
│       ├── services/       Backend API clients
│       └── types/          Mobile response types
├── auth.ts                 Admin authentication integration
├── proxy.ts                Request proxy/middleware behaviour
├── next.config.ts
├── package.json
└── tsconfig.json
```

Generated directories such as `node_modules`, `.next`, native build output, and Git internals are not part of the maintained source inventory.

## 4. Runtime Architecture

```text
Next.js Website ─┐
                 ├─> Next.js Route Handlers / Server Actions
React Native App ┘                 │
                                   ├─> Auth and validation
Admin UI ──────────────────────────┤
                                   ├─> Business engines
                                   └─> Mongoose models ─> MongoDB
```

The mobile app calls the same `/api/...` surface exposed to the website. Server-only modules connect to MongoDB through `lib/mongodb.ts`. Business engines sit between event sources and models so reward rules are not duplicated in clients.

## 5. Authentication Architecture

Customer endpoints cover registration, OTP sending and verification, login, logout, current-user lookup/update, and password reset. Customer route handlers obtain the authenticated user through the established customer-session helper and return `401` when absent. Admin authentication uses the project’s NextAuth configuration and permission helpers. Password and verification flows must remain server-owned; secrets must never be returned to clients.

Relevant routes:

- `/api/user/register`, `/login`, `/logout`, `/me`
- `/api/user/send-otp`, `/verify-otp`, `/reset-password`
- `/api/auth/[...nextauth]`

## 6. Core Data Models

| Model | Responsibility | Important constraints/indexes |
|---|---|---|
| User | Identity, profile, wallet totals, occasions, streak, referral, loyalty state | Unique email; sparse unique referral code; loyalty tier reference |
| Order | Items, totals, payment and fulfilment state | Unique human order ID; user/status/date indexes |
| Cart | Customer cart state | Customer association |
| MenuItem / Category | Sellable menu and grouping | Application-level validation |
| Coupon | Public/private discounts and reward coupons | Code and customer eligibility constraints |
| DamruTransaction | Financial reward ledger | Unique idempotency key; user/date index |
| RewardRule | Configured base rewards | Category configuration |
| DamruConfig | Redemption and legacy reward settings | Singleton-style access service |
| DailyStreakConfig | Daily reward sequence and recovery policy | Normalised configuration |
| Achievement / UserAchievement | Achievement definitions and per-user state | Definition code and user progress uniqueness |
| Mission / UserMission / MissionEvent | Mission definitions, user state, event deduplication | Deterministic period/event identity |
| ReferralConfig / Referral | Referral policy and lifecycle | Referral identity/status controls |
| LoyaltyTier | Configurable tier ladder | Unique code and rank; validated ranges |
| Address | Saved customer delivery addresses | User ownership |
| Admin | Staff identity, role, permissions | Administrative authentication fields |
| Branch / Table | Restaurant locations and table operations | Operational identifiers |
| Reservation / BanquetBooking | Booking requests | Lifecycle fields |
| Blog / BlogCategory / BlogComment | Content publishing | Slug/category relationships |
| GalleryTab / SiteSettings | Site-managed content | Configuration records |
| Complaint | Customer support cases | Customer ownership/status |

## 7. API Inventory

### Customer and commerce

| Method family | Endpoint | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/address` | Saved-address operations |
| GET/POST/PATCH/DELETE | `/api/cart`, `/api/cart/item` | Cart state and items |
| GET/POST | `/api/orders` | Customer order list and creation |
| GET | `/api/menu`, `/api/home-menu`, `/api/menu/suggestions` | Menu discovery |
| GET | `/api/search` | Site search |
| GET/POST | `/api/coupons` | Coupon validation/listing patterns |
| GET/POST/PATCH | `/api/reservations`, `/api/reservations/[id]` | Reservations |
| GET/POST | `/api/banquet-bookings` | Banquet enquiries |
| GET/POST/PATCH | `/api/complaints`, `/api/complaints/[id]` | Support complaints |

### Content

`/api/branches`, `/api/blogs/[slug]`, `/api/blog-search`, `/api/blog-categories`, `/api/blog-comments`, `/api/gallery`, `/api/homepage-blogs`, and `/api/upload` support published content and media workflows.

### Customer rewards

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/rewards/dashboard` | Lightweight wallet and programme summaries |
| GET | `/api/rewards/history` | Paginated ledger history |
| GET | `/api/rewards/coupons` | Eligible reward coupons |
| GET | `/api/rewards/upcoming` | Occasion and legacy summary data |
| POST | `/api/rewards/redeem` | Order-bound Damru redemption |
| GET | `/api/rewards/achievements` | Authoritative progress |
| GET | `/api/rewards/missions` | Authoritative mission state |
| GET | `/api/rewards/referrals` | Referral code, summary, and history |
| GET | `/api/rewards/loyalty` | Current tier, progress, benefits, ladder |

### Rewards administration

Administration routes under `/api/admin/rewards` cover rules, global configuration, daily rewards, achievements, missions, referral configuration/history, loyalty tiers, user search/detail, occasion unlocks, and reason-recorded adjustments. They call `checkApiPerm("rewards", "view" | "edit")` rather than creating a separate authorisation mechanism.

## 8. Validation and Error Handling

Validation is layered:

1. Route handlers validate request shapes, numeric ranges, enum membership, dates, and object identity.
2. Authentication helpers establish customer/admin identity.
3. Permission helpers authorise administrative capabilities.
4. Business services recompute eligibility and do not trust frontend progress.
5. Mongoose schemas enforce required values, enums, bounds, and unique indexes.
6. Conditional atomic updates and unique idempotency keys protect financial operations.

Route handlers generally return JSON errors with appropriate `400`, `401`, `403`, `404`, or `500` status codes. Website and mobile callers show safe messages. TanStack Query retries transient failures once but avoids retrying 4xx failures.

## 9. Damru Reward Architecture

```text
Business Event
    ↓
Backend Eligibility / Configuration
    ↓
awardDamru()
    ↓
Unique Idempotency Key
    ↓
DamruTransaction Credit
    ↓
Atomic User Wallet Increment
```

`lib/rewardEngine.ts` is the central issuer. `awardDamru()` creates the ledger record, atomically increments `damruBalance` and `damruTotalEarned`, patches `balanceAfter`, optionally creates a private coupon, and attempts a notification email. Duplicate transaction keys return a duplicate result without another balance change.

`redeemDamru()` validates the order and redemption policy, conditionally decrements the wallet, and writes an order-bound debit. `adjustDamru()` records the acting administrator and required reason. Direct wallet writes must not be introduced outside these controlled primitives.

## 10. Reward Event Map

```text
Registration
├── Welcome reward
└── Referral registration association

Login / authenticated activity
├── Daily login reward
├── Streak update
├── Streak achievement evaluation
└── Streak mission evaluation

Profile activity
├── Profile achievement evaluation
└── Profile mission evaluation

Order delivered
├── First-order reward
├── Order/spend achievements
├── Order/spend missions
├── Referral qualification
└── Loyalty tier evaluation and optional upgrade bonus
```

## 11. Daily Streaks

`lib/dailyStreak.ts` contains pure date/projection logic. `getDailyStreakConfig.ts` loads normalised configuration. `checkAndAwardDailyLogin()` uses a server date string, conditional user update, and `daily-login:{userId}:{date}` transaction key. Cycle and grace-period decisions remain configurable.

## 12. Achievements

`achievementEngine.ts` resolves progress for `ORDER_COUNT`, `LIFETIME_SPEND`, `LOGIN_STREAK`, `PROFILE_COMPLETE`, and `ACCOUNT_AGE_DAYS`. Definitions are stored in `Achievement`; user state is stored in `UserAchievement`. Unlock rewards use the central reward engine and deterministic identity.

## 13. Missions

`missionPeriod.ts` calculates period boundaries. `missionEngine.ts` updates applicable missions for `ORDER_COUNT`, `SPENDING_AMOUNT`, `LOGIN_STREAK`, and `PROFILE_COMPLETE`. `MissionEvent` prevents a repeated source event from incrementing progress twice. Supported periods are `ONE_TIME`, `DAILY`, `WEEKLY`, `MONTHLY`, and `CAMPAIGN`.

## 14. Referrals

`referralEngine.ts`, `referralCode.ts`, `ReferralConfig`, and `Referral` implement code generation, registration association, first eligible/delivered order qualification, limits, verification checks, reward delay policy, and duplicate-safe reward issuance. Referral API output masks or omits sensitive referred-user information.

## 15. Loyalty Tiers

`LoyaltyTier` stores name, code, rank, qualification type, min/max range, multiplier, benefits, badge, optional upgrade bonus, and activation. Active tiers must share a qualification type; invalid and overlapping ranges are rejected. Only the highest tier may omit a maximum.

`loyaltyEngine.ts` loads the active ladder, calculates trusted qualification from delivered orders or lifetime Damru totals, resolves the current and next tier, returns progress and benefits, persists tier identity, and optionally issues an upgrade bonus through `awardDamru()` with `loyalty-tier:{userId}:{tierId}`.

Multipliers are centralised in `getLoyaltyRewardMultiplier()` and currently apply only when the caller explicitly identifies `ORDER_REWARD`. `applyLoyaltyMultiplier()` uses integer rounding. Birthday, anniversaries, login, achievements, missions, referrals, adjustments, and redemption are not multiplied by default.

The reconciliation script `scripts/recalculate-loyalty-tiers.ts` is rerunnable, reports only aggregate counts, and deliberately sets `issueBonus: false`.

## 16. Checkout and Order Lifecycle

The customer flow is Cart → Address → Coupon/Damru → Payment selection → Order. Backend routes validate ownership and sensitive totals. Order states are `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, and `cancelled`; payment states are `pending`, `paid`, and `failed`. The trusted delivered transition in `app/actions/orders.ts` invokes reward engines. Individual engines remain idempotent so replay does not duplicate financial rewards.

## 17. Website Architecture

The App Router website is under `app/(website)`. Customer rewards are integrated into `my-profile/page.tsx` and supported by `lib/rewards` types, API wrappers, provider state, and analytics event names. CSS lives under `styles/website`. Client components handle browser interaction while route handlers and server actions retain protected logic.

## 18. Mobile Architecture

The Expo app uses `mobile-app/src/app` for routes. `services/rewardsApi.ts` wraps shared endpoints; `types/rewards.ts` defines response contracts; `queryClient.ts` owns retry/cache defaults. Rewards include dashboard/profile integration and dedicated history, achievement, mission, referral, and loyalty screens with loading, retry, error, and refresh handling.

## 19. Admin Architecture and Permissions

Admin routes and pages are grouped under `app/admin`. The rewards page contains tabs for reward rules, Damru config, daily rewards, achievements, missions, referrals, loyalty tiers, and individual customer rewards. `getAdminPerms()` supports server actions and `checkApiPerm()` protects route handlers. Manager role/permission editing reuses the same permission model.

## 20. Email and Scheduled Work

`lib/email.ts` centralises transactional email behaviour. The rewards scheduler endpoint is `/api/internal/rewards/run-scheduler`; its deployment schedule is configured in `vercel.json`. Scheduler access must remain secret-protected. The code supports verification/reset and reward-related message flows without placing provider secrets in client code.

## 21. Security Properties

- Hashed passwords and protected verification/token material
- Authenticated customer APIs and ownership checks
- Permission-gated administrative routes
- Unique reward idempotency keys
- Atomic wallet updates and ledger history
- Order-bound redemption protection
- Private coupon customer isolation
- Backend-authoritative reward and loyalty progress
- Safe reconciliation output without personal data

## 22. Environment Variables

Variable names must be taken from code and deployment configuration before production setup. Expected categories include MongoDB connection, authentication/session secrets, public application URL, mobile API URL, email provider credentials, scheduler protection, and any payment credentials used by the deployed environment. Never copy values from `.env.local` into documentation, commits, logs, or client bundles.

## 23. Local Development

```bash
# Website/backend
npm install
npm run dev

# Static validation
npx tsc --noEmit
npm run lint

# Mobile
cd mobile-app
npm install
npm start
npm run android
npm run typecheck
```

Configure required environment variables locally before starting. The root `seed` script runs `npx tsx scripts/seed.ts`. Do not point seed or reconciliation commands at production without explicit operational review.

## 24. Build and Deployment

The website uses `npm run build` and `npm start`. `vercel.json` supplies discovered deployment scheduling configuration; hosting assumptions beyond committed configuration are not confirmed. Expo/EAS configuration under `mobile-app` governs native build profiles. Production requires a reachable API URL, database, authentication secrets, email setup, scheduler secret, configured admin permissions, and seeded reward/tier configuration.

## 25. Testing and Known Issues

Confirmed validation status on 7 August 2026:

- Root `npx tsc --noEmit`: passes.
- Mobile `npx tsc --noEmit`: passes.
- Targeted lint exposes existing strict-rule issues in large rewards/profile files and `any` cleanup in new admin handlers.
- Mobile Expo lint has a known environment/configuration issue involving `eslint-config-expo/flat`; no unrelated dependency was installed to mask it.
- A database-backed integration test harness was not found.
- A pure loyalty helper runner was blocked/hung during Mongoose module initialisation in the current execution environment; no database write occurred.

## 26. Common Extension Workflows

### Add an API

Create a route handler under `app/api`, authenticate first, validate input, call an existing service/model pattern, return safe JSON, and add web/mobile types where consumed.

### Add a reward safely

1. Define the trusted backend trigger.
2. Load server-side configuration and validate eligibility.
3. Generate a deterministic idempotency key.
4. Call `awardDamru()`; never increment balance directly.
5. Attach useful non-sensitive transaction metadata.
6. Add administration configuration only if required.
7. Extend API and client display types.
8. Test the same event twice.

### Add an achievement or mission

Extend the model enum and engine calculation, integrate only at an existing trusted event, add admin/customer labels, and verify progress plus duplicate-event behaviour.

### Add a mobile rewards screen

Add an Expo Router file, typed service function, loading/error/retry/refresh states, query invalidation where mutations occur, and a navigation entry from the rewards profile section.

## 27. Troubleshooting

| Symptom | Checks |
|---|---|
| Database connection failure | Confirm Mongo URI name/value locally, network access, and database availability |
| Customer appears logged out | Inspect customer session cookie/token expiry and `/api/user/me` response |
| Admin receives forbidden response | Inspect assigned rewards/resource permissions and `checkApiPerm` action |
| Damru not credited | Inspect rule activation, event eligibility, idempotency key, and ledger record |
| Duplicate reward skipped | Expected when the same deterministic key already exists |
| Loyalty tier absent | Configure at least one valid active tier and run reconciliation for existing users |
| Wrong loyalty progress | Confirm all active tiers share qualification type and delivered-order data is correct |
| Coupon unavailable | Check activation window, usage limits, ownership, and minimum order value |
| Mobile API failure | Confirm mobile API base URL, device network reachability, and authentication state |
| Expo lint failure | Verify the known `eslint-config-expo/flat` environment issue before changing app code |

## 28. Production Checklist

- [ ] Production environment variable names and values configured securely
- [ ] Production MongoDB indexes created and reviewed
- [ ] Customer and admin authentication verified
- [ ] Email sender/domain verified
- [ ] Payment behaviour tested with production-safe credentials
- [ ] Reward rules, streaks, achievements, missions, referrals, and loyalty tiers reviewed
- [ ] Scheduler endpoint protected and schedule verified
- [ ] Admin permissions assigned by least privilege
- [ ] Website build and both TypeScript checks pass
- [ ] Mobile API URL and native build profiles verified
- [ ] Reward replay/idempotency scenarios tested against a staging database
- [ ] Backup, monitoring, and incident ownership established

## 29. Developer Onboarding Checklist

- [ ] Clone and install root/mobile dependencies
- [ ] Configure local environment without committing secrets
- [ ] Run website and mobile applications
- [ ] Test customer and admin login
- [ ] Review `Order`, `User`, `DamruTransaction`, and `rewardEngine.ts`
- [ ] Trace the delivered-order reward event map
- [ ] Review admin permission checks
- [ ] Run root and mobile TypeScript
- [ ] Read known lint/test limitations
- [ ] Use deterministic keys for every new reward-producing event

---

*This document describes confirmed repository structure and implementation as of 7 August 2026. Where operational deployment details are not committed, they are explicitly not assumed. No secret values or customer records are included.*
