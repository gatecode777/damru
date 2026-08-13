# Product Requirement Document (PRD) — Damru Website Performance Remediation

## 1. Overview & Problem Statement

A comprehensive performance audit of the Damru website has identified that despite a very small database footprint (currently 519 total documents across all collections), the live production site experiences severe latency, with homepage load times and Time to First Byte (TTFB) hitting **10.3s to 15.1s** under origin-serving/cold-start conditions, and unauthenticated API endpoints taking upwards of **2.1s** to return `401 Unauthorized` codes. 

The diagnostic audit isolated the root causes to:
1. **Cross-Region Database Latency**: Edge serverless functions invoking queries from Asia (Mumbai/`bom1`) to AWS N. Virginia (`us-east-1`) MongoDB Atlas, adding a high round-trip network latency penalty (~250ms RTT per query).
2. **Eager DB Connection on Cold Boot**: The startup registration hook eagerly imports Mongoose connections, blocking the container initialization process for every cold start.
3. **Global Client-Side Fetch Leaks**: Client-side context providers dispatching queries for dashboard statistics on anonymous page loads.
4. **Redundant & Sequential DB Reads**: Nested sequential queries and duplicate query targets on active API routes.
5. **Bloated CSS Bundle size**: Root layout loading page-specific styles globally.
6. **Cumulative Event Handler Leaks**: Page animations in `main.js` re-binding listener hooks without proper route cleanup.

### Business Impact
* **Conversion Rate**: A 10–15 second load time is a critical barrier to transaction success. Drop-offs during menu loads, checkout processing, and reservations are highly correlated with latency. Remediating response times protects top-line user conversions.
* **SEO & Core Web Vitals**: Google search ranking algorithms penalize sites with poor Core Web Vitals, specifically Largest Contentful Paint (LCP) and Interaction to Next Paint (INP). High TTFB directly damages LCP, reducing local search prominence in Jaipur.
* **Session-Length Reliability**: Cumulative event listener leaks on the window scroll and document click handlers cause progressive CPU saturation and memory leaks during page navigations, resulting in lagging UI interactions and browser crashes.
* **Infrastructure Cost Risk**: Wasteful, un-cached queries and global client-side requests from anonymous users inflate serverless function invocations and database connection pools. During traffic spikes, this risks exceeding Vercel serverless compute limits and Atlas database free tier thresholds, prompting unexpected overage charges or service denial.

---

## 2. Goals & Success Metrics

| Metric | Current Baseline | Target | Source |
| :--- | :--- | :--- | :--- |
| **Homepage TTFB (Cold Start)** | 10.3s – 15.1s | < 500ms | Audit findings (eager DB connection hook) |
| **Homepage TTFB (Warm/Edge)** | ~20ms – 50ms | < 50ms | Audit findings (cached static page serving) |
| **`/api/user/me` Response (401)** | 2.1s | < 150ms | Audit findings (eager connectDB blocking 401) |
| **Cross-Region DB RTT** | ~250ms | < 10ms (or N/A via cache) | Audit findings (Mumbai to N. Virginia RTT) |
| **Global Anonymous API Calls** | 1 heavy dashboard call/load | 0 calls | Audit findings (RewardsProvider mount fetch) |
| **CSS Link Count (Homepage)** | 20 stylesheets | 3 stylesheets | Audit findings (layout.tsx global css imports) |
| **Duplicate DB User Queries** | 1 User.findById duplicate | 0 duplicate queries | Audit findings (referralEngine.ts + dashboard) |
| **Sequential DB Reads (Loyalty)** | 2 sequential reads | 0 sequential reads (parallel) | Audit findings (loyaltyEngine.ts qualification) |
| **Lighthouse Performance Score** | TBD | > 90 | TBD — baseline in Phase 0 |

**The primary success measure of this remediation project is to reduce the Homepage Time to First Byte (TTFB) under normal traffic conditions to below 500ms (representing a 20x improvement) and completely eliminate unauthenticated database cold-start blocking.**

---

## 3. Non-Goals

* **Migrating hosting infrastructure**: We will not migrate the application hosting away from Vercel's Serverless/Edge platform.
* **Implementing new distributed caching layers**: Setting up external distributed caching layers (such as Redis clusters) is out of scope. Caching solutions must reside in serverless runtime memory.
* **Redesigning the database schema**: We will not modify core Mongoose schemas or reorganize MongoDB collections beyond creating performance-optimizing indexes.
* **Mobile App remediation**: The React Native/Expo mobile app is entirely excluded from the scope of this project.
* **Developing new features**: We will not build any new functional features for users or admins during this remediation pass.

---

## 4. Scope & Requirements

### Phase 1: High Impact, Low Risk

| ID | Requirement | Priority | Effort | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-1.1** | Eager DB connection removal (instrumentation.ts) | P0 | Low | Low |
| **REQ-1.2** | Anonymous user cookie guard for dashboard fetch | P0 | Low | Low |
| **REQ-1.3** | Additive database indexes (MenuItem & Blog) | P0 | Low | Low |
| **REQ-1.4** | In-memory config caching (Damru & Streak config) | P1 | Low | Low |

#### REQ-1.1: Eager DB connection removal (instrumentation.ts)
* **Priority/Effort/Risk**: P0 / Low / Low
* **Audit Finding**: A. Eager DB Boot blocking Serverless Cold Starts
* **Problem**: The startup registration hook in `instrumentation.ts` eagerly loads mongoose, forcing serverless boots to block on database handshakes even for lightweight unauthenticated calls.
* **Acceptance Criteria**:
  * Remove the `connectDB` call and mongoose imports from `instrumentation.ts`.
  * Ensure database connection is handled lazily inside individual API route handlers via `connectDB()`.
  * Verify unauthenticated endpoints (`/api/user/me` returning `401`) respond in < 150ms on cold boots.
* **Rollback Plan**: Revert changes to `instrumentation.ts` and rebuild.

#### REQ-1.2: Anonymous user cookie guard for dashboard fetch
* **Priority/Effort/Risk**: P0 / Low / Low
* **Audit Finding**: B. Global Client Fetch Leaks for Anonymous Users
* **Problem**: The client-side `RewardsProvider` fetches `/api/rewards/dashboard` unconditionally on mount, leading to wasteful 401 calls and database boot overhead for all anonymous visitors.
* **Acceptance Criteria**:
  * Set a lightweight client-readable cookie `damru_logged_in=true` on successful user login, and delete it upon logout.
  * Modify `RewardsProvider.tsx` to check for this cookie before executing `getDashboard()`.
  * Confirm anonymous visitors trigger 0 dashboard fetch calls on the homepage.
* **Rollback Plan**: Remove the cookie check in `RewardsProvider.tsx` to retrieve dashboard data unconditionally.

#### REQ-1.3: Additive database indexes (MenuItem & Blog)
* **Priority/Effort/Risk**: P0 / Low / Low
* **Audit Finding**: D. Missing Database Indexes
* **Problem**: `MenuItem` queries sorting by `sortOrder` and `Blog` queries sorting by `publishedAt` and `createdAt` lack compound indexes, triggering in-memory sorts.
* **Acceptance Criteria**:
  * Add `MenuItemSchema.index({ isActive: 1, sortOrder: 1 })` to `MenuItem.ts`.
  * Add `BlogSchema.index({ status: 1, publishedAt: -1, createdAt: -1 })` to `Blog.ts`.
  * Confirm MongoDB query plans (via `explain()`) show `IXSCAN` and index-level sorts for both queries.
* **Rollback Plan**: Remove index declarations from schema definitions.

#### REQ-1.4: In-memory config caching (Damru & Streak config)
* **Priority/Effort/Risk**: P1 / Low / Low
* **Audit Finding**: C. Redundant & Sequential DB Reads (Evidence 3)
* **Problem**: `DailyStreakConfig` and `DamruConfig` query MongoDB on every route execution to retrieve static configurations that rarely change.
* **Acceptance Criteria**:
  * Implement in-memory caching for `getDamruConfig()` and `getDailyStreakConfig()` with a 60-second TTL.
  * Verify configuration settings update within 60 seconds of administrative changes.
  * Ensure no database connection is initiated for consecutive config reads within the TTL window.
* **Rollback Plan**: Disable the caching layer and fetch directly from database on every invocation.

---

### Phase 2: Code Refactoring

| ID | Requirement | Priority | Effort | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-2.1** | Consolidate duplicate User query in Referral / Dashboard | P1 | Low | Low |
| **REQ-2.2** | Parallelize sequential reads in Loyalty Engine | P1 | Low | Low |
| **REQ-2.3** | Move page-specific CSS out of root layout | P1 | Medium | Medium |
| **REQ-2.4** | Clean up client scroll/click listeners and memory leaks in main.js | P1 | Medium | Medium |
| **REQ-2.5** | Image Optimization (Raw `<img>` to `next/image`) | P2 | Medium | Low |

#### REQ-2.1: Consolidate duplicate User query in Referral / Dashboard
* **Priority/Effort/Risk**: P1 / Low / Low
* **Audit Finding**: C. Redundant & Sequential DB Reads (Evidence 2)
* **Problem**: `getOrCreateReferralCode()` executes a separate `User.findById()` query to retrieve the referral code, which is already queried in the dashboard.
* **Acceptance Criteria**:
  * Add `referralCode` to the select projection of the main User query in `/api/rewards/dashboard/route.ts`.
  * Update `getOrCreateReferralCode()` to accept the pre-fetched user object or `referralCode`, bypassing user read if already present.
  * Verify the transaction dashboard log confirms only one User query is run.
* **Rollback Plan**: Roll back the dashboard route file to the original version.

#### REQ-2.2: Parallelize sequential reads in Loyalty Engine
* **Priority/Effort/Risk**: P1 / Low / Low
* **Audit Finding**: C. Redundant & Sequential DB Reads (Evidence 1)
* **Problem**: `getLoyaltySummary()` runs sequential reads: first fetching `LoyaltyTier`, and then fetching `qualificationValue` (`User` or `Order` collection).
* **Acceptance Criteria**:
  * Refactor `getLoyaltySummary()` to run `getActiveLoyaltyTiers()` and `qualificationValue()` in parallel via `Promise.all`.
  * Verify response time of `/api/rewards/loyalty` is reduced by ~200–250ms in cross-region setups.
  * Ensure loyalty calculations remain accurate after refactoring.
* **Rollback Plan**: Revert `loyaltyEngine.ts` to original sequential query structure.

#### REQ-2.3: Move page-specific CSS out of root layout
* **Priority/Effort/Risk**: P1 / Medium / Medium
* **Audit Finding**: F. Render-Blocking CSS Bundling
* **Problem**: The root layout imports all 20 page CSS files globally, causing excessive render-blocking network payloads on the homepage.
* **Acceptance Criteria**:
  * Remove page-specific CSS imports (`myprofile.css`, `cart.css`, `checkout.css`, etc.) from `app/(website)/layout.tsx`.
  * Import stylesheets directly inside their respective sub-layouts or page components.
  * Confirm homepage HTML contains at most 3-4 CSS link tags (global layout styles only).
* **Rollback Plan**: Re-import all page CSS files in `layout.tsx`.

#### REQ-2.4: Clean up client scroll/click listeners and memory leaks in main.js
* **Priority/Effort/Risk**: P1 / Medium / Medium
* **Audit Finding**: E. Client-Side Event Listener Leaks (`main.js`)
* **Problem**: `main.js` intercepts route changes via `pushState` and binds new scroll/click event listeners on every navigation without cleanup, bloating memory.
* **Acceptance Criteria**:
  * Refactor page animations and testimonials script inside `main.js` to remove `pushState` interception.
  * Implement bindings inside React layout/component level `useEffect` hooks with proper cleanup functions.
  * Confirm no duplicate event listeners accumulate in Chrome DevTools performance monitor upon successive page transitions.
* **Rollback Plan**: Restore `main.js` `pushState` route change interceptor.

#### REQ-2.5: Image Optimization (Raw `<img>` to `next/image`)
* **Priority/Effort/Risk**: P2 / Medium / Low
* **Audit Finding**: G. Raw `<img>` vs `next/image` components
* **Problem**: The homepage and branch lists load large un-optimized raw `<img>` elements instead of `next/image`, losing compression and responsive resizing benefits.
* **Acceptance Criteria**:
  * Convert raw `<img>` tags in `page.tsx` and `BranchCard.tsx` to `next/image` components.
  * Configure standard layout dimensions (`width`, `height`, `sizes`) and direct ImageKit CDN URLs.
  * Verify images are served in modern formats (WebP/AVIF) and compressed size decreases by > 50%.
* **Rollback Plan**: Revert `next/image` tags back to raw `<img>` tags.

---

## 5. Phasing / Rollout Plan

### Phasing Timeline
* **Phase 0: Baseline & Instrumentation (1–2 Days)**: Configure a pre-production/staging clone of the current site. Establish performance baseline benchmarks utilizing Lighthouse CLI, PageSpeed Insights, and Web Vitals telemetry. Identify key paths to measure after changes are deployed.
* **Phase 1: Quick Wins (2–3 Days)**: Deploy REQ-1.1, REQ-1.2, REQ-1.3, and REQ-1.4. This phase optimizes startup, anonymous visitors, database indexes, and system configurations. Expected impact: TTFB drops by > 80% on homepage.
* **Phase 2: Code Refactoring (3–5 Days)**: Deploy REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, and REQ-2.5. This phase restructures API routes, cleans up stylesheets, fixes memory leaks, and optimizes image assets.

### Dependencies Summary
1. **Common File Touch**: REQ-1.4 (config caching) and REQ-2.1 (duplicate user query) both touch the rewards dashboard endpoint (`route.ts`). They must be merged sequentially to avoid conflicts.
2. **Caching Pattern**: REQ-1.4 config caching sets the pattern for in-memory serverless cache storage, which will be reused if query/dashboard caching is expanded in the future.

---

## 6. Infrastructure Decisions Requiring Stakeholder Input

### Decision 1: MongoDB Atlas Region Migration
The primary customer base is in Jaipur, India. The MongoDB cluster is currently hosted in N. Virginia (`us-east-1`), causing a high round-trip network latency penalty (~250ms RTT) for serverless functions executing in Asia regions.
* **Option 1 (Remain in us-east-1)**:
  * *Pros*: Zero migration effort, zero cost change.
  * *Cons*: Latency remains high for Indian users.
* **Option 2 (Migrate to AWS ap-south-1 Mumbai)**:
  * *Pros*: Reduces RTT database latency to < 15ms for India edge instances.
  * *Cons*: Requires a planned migration window and updating `MONGODB_URI` in Vercel environment variables.
* **Option 3 (Setup read-replica in Mumbai)**:
  * *Pros*: Speeds up reads in India while keeping master DB in `us-east-1`.
  * *Cons*: Increases database license costs significantly.

### Decision 2: Vercel Function Region Pinning
Serverless functions default to running in regions closest to the visitor (Anycast edge). When the database is in `us-east-1`, serverless functions in Mumbai must travel globally for database queries.
* **Option 1 (Pin Serverless functions to us-east-1)**:
  * *Pros*: Places serverless function execution in the same region as the database, reducing function-to-db latency to < 5ms.
  * *Cons*: Moves the latency boundary to the client (Jaipur user to N. Virginia serverless function), increasing page TTFB.
* **Option 2 (Leave as Default Anycast / Pin to Mumbai ap-south-1)**:
  * *Pros*: Edge serverless function executes close to Indian users.
  * *Cons*: Serverless-to-DB query latency remains high unless MongoDB is migrated to `ap-south-1` (Decision 1).

---

## 7. Testing & Validation Plan

### Per-Requirement Validation
* **REQ-1.1**: Verify server boot log outputs "MongoDB module loaded lazily" and `/api/user/me` returns in < 150ms on cold route simulation.
* **REQ-1.2**: Capture request logs on homepage load with a logged-out browser session to confirm zero calls to `/api/rewards/dashboard`.
* **REQ-1.3**: Run `explain()` in MongoDB Shell on `MenuItem` and `Blog` queries to ensure stage is `IXSCAN` and scan matches targets.
* **REQ-1.4**: Query `/api/checkout/config` consecutively and assert only 1 DB log trace is generated within 60 seconds.

### Pre-Production Gates
* **Lighthouse CI**: Block PR merges if Lighthouse Performance score falls below 90.
* **Load Testing**: Run a 50-concurrent-user simulation over 5 minutes to confirm serverless memory does not leak and connection pools stay within limits.
* **Visual Regression**: Execute automated screenshot diffs on homepage and menu pages to verify layouts are unchanged after CSS and image optimizations.

### Production Validation
* **Canary Rollout**: Deploy Phase 1 changes to 10% of users first and monitor error logs.
* **RUM Comparison**: Monitor real user telemetry (TTFB, FCP) in Vercel Analytics post-deployment.
* **Atlas Monitoring**: Verify average query latency on MongoDB Atlas dashboard decreases by > 50% after indexes are created.

---

## 8. Monitoring & Guardrails

* **TTFB Alert**: Trigger high-priority alert if average Homepage TTFB exceeds 1,000ms over a 5-minute moving window.
* **API Error Rate Guardrail**: Alert if `/api/user/me` or `/api/rewards/dashboard` return 500 status codes for > 1% of requests.
* **Serverless Memory Usage**: Alert if Vercel serverless function execution timeout or memory limit warnings occur in runtime log traces.
* **Connection Pool Alert**: Trigger warning if MongoDB connection pool size exceeds 80% of cluster limits on Atlas.

---

## 9. Open Questions & Risks

* **Configuration Staleness Tolerance**: Is a 60-second TTL cache for `DamruConfig` acceptable, or do administrator changes need to be reflected immediately in real-time?
* **Primary Customer Base Location**: Is the user base strictly localized to India (`ap-south-1`), which warrants migrating our primary database cluster to AWS Mumbai?
* **Test Coverage Gap**: The repository lacks an automated integration test suite, increasing the risk of code regression during sequential loyalty query refactoring.
* **Rollout Ownership**: Who will coordinate the DNS, environment secret migration, and write-lock windows if a database region migration is approved?
