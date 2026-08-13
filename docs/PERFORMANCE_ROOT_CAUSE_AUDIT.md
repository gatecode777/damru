# Damru Website Performance Root-Cause Audit

## Executive Summary

This diagnostic audit documents the exact reasons why the Damru website is experiencing slow load times. 

Through live network timing, database schema inspections, route analysis, and client-side code investigation, we have identified that the slow performance is **not** caused by large database sizes (the database currently holds under 500 documents total). Instead, the performance degradation is driven by **architectural overhead, cross-region network latency, redundant database read chains, render-blocking CSS bundling, and client-side memory/event listener leaks**.

### Major Diagnostic Findings
1. **Cross-Region Database Latency**: The Next.js website server (hosted on Vercel Anycast edge routing) invokes serverless functions close to the client (e.g., in Mumbai/`bom1` for India-based users), but connects to a MongoDB Atlas cluster hosted globally (e.g., AWS `us-east-1` in N. Virginia). This creates a minimum round-trip time (RTT) of **~250ms** per query.
2. **Eager Connection Blocking Cold Starts**: The startup registration hook (`instrumentation.ts` [register()](file:///r:/damru/instrumentation.ts#L8-L25)) eagerly imports the database connection helper. On serverless cold starts, this network handshake blocks the entire boot process, causing basic requests to hang for **2–10 seconds** before the serverless container can even respond.
3. **Unnecessary Authenticated Requests**: The client-side global `RewardsProvider` ([RewardsProvider.tsx](file:///r:/damru/lib/rewards/RewardsProvider.tsx#L38-L48)) calls `/api/rewards/dashboard` unconditionally on mount. This means **anonymous/logged-out visitors** trigger a heavy 16-query dashboard API fetch only to receive a `401 Unauthorized` response.
4. **Redundant & Sequential DB Reads**: The `/api/rewards/dashboard` route wraps 16 queries in a `Promise.all`, but several of these queries execute nested sequential reads (such as `getLoyaltySummary()` which makes a query to `LoyaltyTier` first, then sequentially queries `User` or `Order`). Additionally, `getOrCreateReferralCode()` fires a duplicate `User.findById` fetch for `referralCode` instead of reusing the user query already present in the main promise block. Static configurations (`DailyStreakConfig`, `DamruConfig`) are also queried from the database on every single route invocation rather than cached.
5. **Render-Blocking CSS Imports**: The main website layout ([layout.tsx](file:///r:/damru/app/%28website%29/layout.tsx#L12-L31)) imports all 20 individual page stylesheets globally. This forces Next.js to inject 20 render-blocking CSS links on the homepage, causing bloated initial payloads and poor FCP/LCP scores.
6. **Cumulative Event Listener Leaks**: The client layout script ([main.js](file:///r:/damru/public/js/main.js#L194-L210)) intercepts Next.js soft route changes via a `history.pushState` patch to re-initialize page scroll-reveals and slider event handlers. Because it never cleans up existing event listeners, every page transition leaks new click and scroll handlers onto `window` and `document`, leading to memory accumulation and scrolling jank over time.
7. **Lack of Next.js Image Optimization**: The website utilizes raw HTML `<img>` tags rather than optimized `next/image` components, bypassing modern format compression (AVIF/WebP), viewport resizing, and default lazy loading.

---

## 1. Measured Performance Metrics

| Page/Endpoint | Metric | Local Production (Port 3002) | Live Production (`damrurestro.com`) | Notes / Diagnostics |
| :--- | :--- | :--- | :--- | :--- |
| **Ping Latency** | Network RTT | `< 1 ms` (Localhost) | `8–10 ms` (Delhi/Mumbai edge CDN) | Vercel CDN routing is fast, but serverless origin execution blocks it. |
| **Homepage `/` (HTML)** | TTFB / Load | `~20–50 ms` (Cached ISR) | **`10.3–15.1 s`** (Cold start / Origin load) | Homepage should be edge-served. Slow load proves cache misses or origin-blocking database handshakes on cold routes. |
| **`/api/user/me` (Unauthenticated)** | Response Time | `~5–10 ms` | **`2.1 s`** | Cold start forces eager DB connection handshake inside `instrumentation.ts` even when returning 401. |
| **Database Document Counts** | Total Size | `N/A` | **519 total documents** | Extremely small database footprint; rules out heavy index scan/collection volume issues. |

---

## 2. Core Bottlenecks & Code-Level Evidence

### A. Eager DB Boot blocking Serverless Cold Starts
* **Evidence**: In [instrumentation.ts](file:///r:/damru/instrumentation.ts#L8-L25), `register()` imports and executes `connectDB` eagerly.
* **Impact**: Under serverless environments, Next.js starts a new container on demand. If the container startup imports `@/lib/mongodb`, the TCP and SSL connection handshakes to MongoDB Atlas are established before the request can progress. This turns a simple unauthenticated check (like `/api/user/me` returning 401) into a blocking network transaction that takes seconds.
* **Remediation**: Remove the eager DB load from `instrumentation.ts`. Mongoose connection should be handled lazily inside the route handlers, allowing non-DB routes to respond instantly.

### B. Global Client Fetch Leaks for Anonymous Users
* **Evidence**: In [RewardsProvider.tsx](file:///r:/damru/lib/rewards/RewardsProvider.tsx#L38-L48):
  ```typescript
  useEffect(() => {
    Promise.resolve().then(refresh); // Calls /api/rewards/dashboard
  ```
* **Impact**: Every first-time visitor or anonymous customer loading the website fires a request to `/api/rewards/dashboard`. This request must execute the database connection check, decode cookies, and return a `401`.
* **Remediation**: Set a lightweight, client-readable non-httpOnly cookie (such as `damru_logged_in=true`) upon user login. The `RewardsProvider` must check this client-side state before dispatching the dashboard fetch.

### C. Sequential & Redundant Reads in Rewards Dashboard
* **Evidence 1**: The `/api/rewards/dashboard` route ([route.ts](file:///r:/damru/app/api/rewards/dashboard/route.ts#L44-L61)) uses `Promise.all` to parallelize queries. However, inside the promise array, it calls `getLoyaltySummary(sessionUser.id)`. In [loyaltyEngine.ts](file:///r:/damru/lib/loyaltyEngine.ts#L43-L57):
  ```typescript
  export async function getLoyaltySummary(userId: string | mongoose.Types.ObjectId) {
    const tiers = await getActiveLoyaltyTiers(); // Query 1
    ...
    const currentValue = await qualificationValue(userId, type); // Query 2 (Sequential)
  ```
  This creates nested sequential database queries that multiply the cross-region network latency penalty (making the promise batch take longer).
* **Evidence 2**: In `getOrCreateReferralCode()` ([referralEngine.ts](file:///r:/damru/lib/referralEngine.ts#L17)):
  ```typescript
  const user = await User.findById(userId).select("referralCode").lean<{ referralCode?: string }>();
  ```
  This reads the `User` collection a second time for the same `userId` in the same route invocation. The main dashboard query ([route.ts](file:///r:/damru/app/api/rewards/dashboard/route.ts#L62-L64)) already queries `User` but omits `referralCode` from the projection:
  ```typescript
  User.findById(sessionUser.id)
    .select("damruBalance damruTotalEarned damruTotalRedeemed rewardDebt loyaltyLevel currentStreak longestStreak lastEligibleActivityDate")
  ```
* **Evidence 3**: [getDamruConfig()](file:///r:/damru/lib/getDamruConfig.ts#L27-L41) and [getDailyStreakConfig()](file:///r:/damru/lib/getDailyStreakConfig.ts#L28-L39) execute queries to MongoDB on every execution to read static system configuration data.
* **Remediation**: 
  1. Flatten nested sequential calls in the dashboard pipeline.
  2. Add `referralCode` to the main user projection and pass it to `getOrCreateReferralCode` to eliminate the duplicate user query.
  3. Implement in-memory caching (e.g., using a global cache with a short TTL) for the administrative configs.

### D. Missing Database Indexes
* **Evidence 1**: `MenuItem` collection is queried on every menu view via `isActive: true` and sorted by `sortOrder`. In [MenuItem.ts](file:///r:/damru/models/MenuItem.ts#L71-L72), the model defines indexes for `{isActive: 1, isFeatured: 1}` and `{category: 1, isActive: 1}`, but **lacks** a compound index for `{isActive: 1, sortOrder: 1}`.
* **Evidence 2**: `Blog` collection is queried via status and sorted by published/creation date:
  ```typescript
  Blog.find({ status: "published" }).sort({ publishedAt: -1, createdAt: -1 })
  ```
  The indexes in [Blog.ts](file:///r:/damru/models/Blog.ts#L115-L119) cover `{ status: 1 }` and `{ publishedAt: -1 }` separately, but **lack** the compound index `{ status: 1, publishedAt: -1, createdAt: -1 }`.
* **Remediation**: Add the missing compound indexes to allow index-only scans and avoid in-memory collation sorts:
  - `MenuItemSchema.index({ isActive: 1, sortOrder: 1 });`
  - `BlogSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });`

### E. Client-Side Event Listener Leaks (`main.js`)
* **Evidence**: In [main.js](file:///r:/damru/public/js/main.js#L194-L210), Next.js route navigation is intercepted:
  ```javascript
  const _origPush = history.pushState.bind(history);
  history.pushState = function (...args) {
    _origPush(...args);
    checkRouteChange();
  };
  ```
  Upon routing, `checkRouteChange` triggers `initAll()`, which registers event listeners:
  ```javascript
  window.addEventListener("scroll", runAll, { passive: true });
  document.addEventListener("click", e => { ... });
  ```
  There is no cleanup code to call `removeEventListener` for previous pages.
* **Impact**: As the user browses, duplicate scroll and click handlers compile. Every scroll action runs dozens of stale callbacks, consuming CPU resources and resulting in scroll jank.
* **Remediation**: Convert these event bindings into localized React `useEffect` hooks inside layout components (or proper ref callbacks), ensuring listeners are destroyed on cleanups.

### F. Render-Blocking CSS Bundling
* **Evidence**: [layout.tsx](file:///r:/damru/app/%28website%29/layout.tsx#L12-L31) includes global imports for stylesheets representing checkout, profile, cart, and blog details.
* **Impact**: Homepage visitors download and parse unused page styles, slowing down layout rendering and blocking First Contentful Paint.
* **Remediation**: Localize page stylesheets by importing them strictly inside their respective Next.js page components or sub-layouts, rather than the root layout.

---

## 3. Recommendations & Proposed Solutions

### Phase 1: High Impact, Low Risk Fixes
1. **Lazy DB Connection**: Remove eager DB import inside `instrumentation.ts` to allow fast cold starts on Edge/Serverless functions.
2. **Logged-In Cookie Guard**: Set a lightweight cookie upon user login and guard the client-side `/api/rewards/dashboard` fetch behind it.
3. **Additive Indexes**: Add `MenuItemSchema.index({ isActive: 1, sortOrder: 1 })` and `BlogSchema.index({ status: 1, publishedAt: -1, createdAt: -1 })`.
4. **Config caching**: Add basic memory caching with a short TTL (e.g., 60 seconds) for global site settings.

### Phase 2: Code Refactoring
1. **Consolidate Dashboard Queries**: Modify the dashboard route to pass the user's `referralCode` directly to `getOrCreateReferralCode()` instead of running a redundant `User.findById()`.
2. **Move CSS to Sub-Layouts/Pages**: Remove page-specific CSS imports from the website root layout, importing them strictly inside the layout/pages that need them.
3. **Clean Up Client Animations**: Migrate scroll and slider bindings in `main.js` into clean React hook lifecycles.
