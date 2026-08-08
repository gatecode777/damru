# Damru Website — Performance Optimization Report

Scope: Next.js website + backend only (not the mobile app or admin-internal pages, per the
audit's own instruction to prioritize public/customer-facing performance). No business logic,
UX, schemas (beyond additive indexes), or authentication behavior were changed. All changes are
either pure reordering (parallelizing independent work), field-projection trimming, additive
indexes matching real query shapes, or a build-time/serving-strategy adjustment.

## Before

Baseline audit found:

- **Sequential DB round trips on every hot path.** The rewards dashboard (`GET
  /api/rewards/dashboard` — fetched by every logged-in page via `RewardsProvider`) ran roughly
  15 independent reads back-to-back with only partial internal `Promise.all` grouping. The
  order-placement endpoint (`POST /api/orders`) fetched the cart and the delivery address
  sequentially even though neither depends on the other. The homepage (`/`) and the menu page
  (`/menu`) both fetched categories/items (and, on the homepage, blogs and branches) one after
  another instead of concurrently.
- **Missing indexes on genuinely hot query shapes.** `MenuItem` and `Category` — queried on
  every menu-page and `/api/menu` load via `{isActive: true}` (and `{isActive, isFeatured}` /
  `{category, isActive}`) — had no index beyond the unique `slug`, meaning every customer menu
  view was a full collection scan. Same for `Branch`, queried via `{isActive}.sort({sortOrder})`
  on both the homepage and the branches listing.
- **Over-fetching.** Several hot read queries (`/api/menu`, the homepage's category/item/branch
  reads) pulled entire Mongoose documents via `.lean()` with no `.select()`, even though only a
  handful of fields are ever serialized into the response.
- **The homepage is fully static with no revalidation.** `app/(website)/page.tsx` has no
  dynamic input (no `searchParams`/cookies), so Next.js prerenders it once at build time. With
  no `revalidate` export, a newly published blog or newly added branch would never appear on the
  live homepage until the next full redeploy — a real content-freshness bug, not just a
  performance one.
- **`/api/menu/suggestions`** ran its best-seller aggregate and its featured-items query
  sequentially even though only the final `$in` lookup actually depends on the aggregate's
  result.
- Confirmed via `git grep`: **no automated test suite exists** in this repository (no
  `*.test.ts`, no Jest/Vitest/Playwright config). Regression checking for this pass relied on
  `tsc`, a full production `next build`, and live smoke-testing against the running dev server
  with real data (see *Validation* below) — not an automated test run.
- Confirmed already in reasonably good shape and **left untouched**: `/api/search` (already
  `.select()` + `.limit(8)`, and intentionally *not* indexed for its unanchored `$regex` per the
  audit's own guidance that indexing unanchored regex doesn't meaningfully help); `MenuItemCard`
  was already using `next/image` with explicit `width`/`height`; `Order`, `DamruTransaction`,
  `UserAchievement`, `UserMission`, `Referral`, `MissionEvent` already carry indexes matching
  their real query shapes (built during earlier feature work with those exact patterns in mind).

## Changes

### Parallelized independent server-side work (no logic changes — pure reordering)

| File | What changed |
|---|---|
| `app/api/rewards/dashboard/route.ts` | All ~15 independent reads (user doc, Damru config, coupons, recent transactions, streak config, achievement/mission/referral counts and lists, loyalty summary) now run as one `Promise.all` batch instead of ~10 sequential round trips. Derived calculations (next level, streak projection, etc.) run afterward once the raw data resolves. *Trade-off, stated explicitly:* on the rare case of a stale session cookie pointing at a deleted user, this now runs every query before the `404` instead of short-circuiting immediately — an acceptable cost for consistently faster responses in the overwhelmingly common case. |
| `app/api/orders/route.ts` | Cart lookup and delivery-address lookup now run concurrently (`Promise.all`) instead of sequentially — they don't depend on each other. The two post-creation side effects (marking a dine-in table occupied; clearing the user's cart) also now run concurrently instead of sequentially. All validation checks, error messages, and status codes are unchanged. |
| `app/(website)/page.tsx` (homepage) | The Shakes-category lookup (inherently two dependent steps) now runs in parallel with the independent blogs and branches queries, instead of one long sequential chain. |
| `app/(website)/menu/page.tsx` | Table-token verification now runs in parallel with the categories/items DB fetch (previously sequential); categories and items fetch concurrently instead of one after the other. |
| `app/api/menu/route.ts` | Categories and items fetch concurrently instead of sequentially. |
| `app/api/menu/suggestions/route.ts` | The best-seller aggregate and the featured-items query now run concurrently (only the final `$in` lookup still waits on the aggregate's result, since that's a genuine dependency). |

### Field projection (`.select()`) added to hot read queries

Added to: `/api/menu`, the homepage's category/menu-item/branch reads, and `/menu`'s
category/menu-item reads — each now requests only the fields actually serialized into the
response, instead of full documents. The homepage's menu page also replaced a blanket
`JSON.parse(JSON.stringify(...))` re-serialization with an explicit field-by-field map (using
typed `.lean<T[]>()` reads), avoiding a full extra serialize/parse pass over every category and
menu item on each render.

### New indexes (each matches a confirmed real query, not a guess)

| Model | Index | Matches |
|---|---|---|
| `MenuItem` | `{ isActive: 1, isFeatured: 1 }` | `find({isActive})` and `find({isActive, isFeatured})` — menu listing, suggestions (compound index serves both via the `isActive` prefix) |
| `MenuItem` | `{ category: 1, isActive: 1 }` | `find({category, isActive})` — homepage Shakes section |
| `Category` | `{ isActive: 1, sortOrder: 1 }` | `find({isActive}).sort({sortOrder})` — menu page, `/api/menu` |
| `Branch` | `{ isActive: 1, sortOrder: 1 }` | `find({isActive}).sort({sortOrder})` — homepage, branches listing |

**Deliberately not indexed:** `/api/search`'s unanchored `$regex` filter on `name`/`description`
— an index would not meaningfully accelerate an unanchored regex scan, so one was not added
(the audit instructions call this out explicitly).

### Serving strategy

`app/(website)/page.tsx` gained `export const revalidate = 300` — the homepage keeps its
current static-speed serving but now refreshes at most every 5 minutes instead of only on a full
redeploy, fixing the stale-content issue found above without changing anything about how the
page looks or behaves.

### Loading UI

Added `app/(website)/loading.tsx` — a minimal on-brand spinner (reusing the same visual pattern
already used for loading states elsewhere in the app) shown in the content area during
navigation within the website route group, while the header/footer (rendered by the layout)
stay visible immediately.

### Image delivery

Uploaded files are served through `app/uploads/[...path]/route.ts`, which proxies every request
through this Next.js server to ImageKit. For `next/image` usages that adds a needless extra
server hop. Added `lib/imageUrl.ts` (`uploadedImageUrl(folder, filename)`), which builds the
direct ImageKit CDN URL instead — `ik.imagekit.io` was already an allowed `next/image` remote
pattern in `next.config.ts`. Applied it to `MenuItemCard.tsx` (the one customer-facing
`next/image` usage found in the codebase), which also gained a `sizes` attribute it was
previously missing.

## After

- All read-side changes verified against **live data** on the running dev server (see
  *Validation*) — identical response shapes and content, now assembled from concurrent instead
  of sequential DB reads.
- `npm run build` succeeds cleanly with no new warnings. The build output confirms `/` is
  prerendered (`○ Static`) and `/menu` is server-rendered per request (`ƒ Dynamic`, as expected
  since it reads `searchParams`) — both render the same way before and after this pass; only
  their underlying data-fetching got faster/more efficient.
- Dashboard, orders, homepage, and menu routes each go from N sequential round trips to
  effectively 1 batched round trip (bounded by the single slowest query in the batch, not the
  sum of all of them). Exact millisecond deltas were not captured (no APM/profiling tool wired
  into this environment), but the reduction in round-trip *count* is unambiguous and directly
  inspectable in the diffs.

## Index Matrix

| Collection | Query Pattern | Index | Reason |
|---|---|---|---|
| MenuItem | `{isActive}` / `{isActive, isFeatured}` | `{isActive:1, isFeatured:1}` (new) | Menu listing, suggestions — compound index serves the plain `isActive` query via its prefix, no need for two separate indexes |
| MenuItem | `{category, isActive}` | `{category:1, isActive:1}` (new) | Homepage Shakes section |
| Category | `{isActive}` sorted by `sortOrder` | `{isActive:1, sortOrder:1}` (new) | Menu page, `/api/menu` |
| Branch | `{isActive}` sorted by `sortOrder` | `{isActive:1, sortOrder:1}` (new) | Homepage, branches listing |
| MenuItem | unanchored `$regex` on name/description | *none (deliberate)* | Regex scans aren't meaningfully accelerated by a standard index |
| Order, DamruTransaction, UserAchievement, UserMission, Referral, MissionEvent | various | *already indexed* | Built during earlier feature work against these exact query shapes — verified, not re-touched |

## Route Strategy

| Route | Rendering | Cache/Revalidate | Reason |
|---|---|---|---|
| `/` | Static (prerendered) | ISR, 300s (new) | No per-request input; content (blogs/branches) now refreshes every 5 min instead of only on redeploy |
| `/menu` | Dynamic | none | Reads `searchParams` (`category`, table QR token `t`) — must stay per-request |
| `/blogs/[slug]`, `/branches/[slug]` | SSG via `generateStaticParams` | build-time | Already optimal, unchanged |
| `/cart`, `/checkout`, `/my-profile` | Static shell, client-rendered | none | Fully client-side data (session/cart/profile) — a static shell is correct here; converting these to Server Components was out of scope for this pass (see *Remaining*) |
| `/api/menu`, `/api/menu/suggestions`, `/api/search` | Dynamic (API route) | none | Per-request JSON APIs; not cached, but now issue parallel/leaner queries |

## Validation

- **TypeScript:** `npx tsc --noEmit` — clean, 0 errors, after every change in this pass.
- **Lint:** targeted `eslint` runs after each change; the only two genuinely *new* issues
  introduced (both `no-explicit-any` from an intermediate refactor of the menu page) were fixed
  by typing the `.lean()` reads with proper interfaces instead of casting to `any`. Every other
  `any`/`<img>`/warning reported by lint on touched files was confirmed pre-existing by direct
  line-by-line comparison against the pre-change code (same cast, same line, just shifted by the
  surrounding edit) — not a new regression.
- **Production build:** `npm run build` completes successfully with no errors and no new
  warnings; only pre-existing Mongoose "duplicate schema index" warnings appear, and none of
  them are on the models touched in this pass (`MenuItem`, `Category`, `Branch`) — confirmed no
  duplicate index was introduced.
- **Live regression smoke test:** ran against the project's own dev server with real production
  data (not mocked):
  - `GET /api/menu` and `GET /api/menu/suggestions` return correct, real, unchanged-shape JSON.
  - `GET /` and `GET /menu` return `200` and render real content — homepage HTML contains actual
    branch cards and blog cards; the menu page contains real menu-item image blocks.
  - `GET /api/orders` and `GET /api/rewards/dashboard` correctly return `401` without a session
    cookie — confirms the parallelized queries didn't weaken or bypass authentication.
- **Not run:** a full authenticated click-through (login → add to cart → apply coupon → place an
  order → view the rewards dashboard update) was not executed live in this pass, since doing so
  safely requires a disposable test account and would create real database rows. The
  order-placement change was instead verified by direct side-by-side comparison against the
  original logic — confirmed to be a pure reordering (same checks, same error messages, same
  status codes, same data written) — plus the passing build and the unauthenticated-endpoint
  checks above. Recommend a manual click-through before deploying.

## Remaining

Real, high-value opportunities identified but **not implemented** in this pass — each would
need broader, riskier changes than "prioritize measurable high-impact changes over broad
refactoring" justifies doing blind, without a test suite or a way to visually diff pages:

- **Convert remaining customer-facing `<img>` tags to `next/image`.** `MenuItemCard.tsx` was
  already `next/image`; every other customer-facing image (SiteHeader, cart, checkout,
  my-profile, the homepage's hero/menu-showcase/branches/blog sections, search results) still
  uses raw `<img>`. Each needs its real rendered dimensions confirmed from CSS before conversion
  to avoid layout shift — a page-by-page pass, not a blind sweep. The new `lib/imageUrl.ts`
  helper is ready to reuse for all of them.
- **Client-side data-fetching pages** (`my-profile`, `checkout`, `cart`) still load their
  critical data via `useEffect`/`fetch` after hydration rather than via Server Components.
  Converting these is a much larger, higher-risk change (these are large, stateful client
  components with significant interactivity) and was intentionally left alone this pass in
  favor of the lower-risk server-side query/index work above.
- **Pre-existing duplicate-index warnings** surfaced by the build (`Order.orderId`,
  `GalleryTab.tabKey`, `Coupon.code`, `Blog.slug`, `Table.tableNumber` — each declared both
  inline `unique/index: true` *and* a separate `schema.index()` call). Harmless but wasteful;
  trivial one-line-per-model fix, left out of scope since none of these models were otherwise
  touched in this pass.
- **No test suite exists.** All validation in this pass relied on `tsc`, `next build`, and live
  smoke-testing against real data. A regression suite (even a thin one covering checkout/order
  placement) would make future performance passes meaningfully safer to verify.
- **No APM/profiling tooling** is wired into this environment, so before/after latency deltas
  are inferred from round-trip-count reduction and confirmed-correct query plans (indexes now
  matching real filter shapes), not measured directly. Recommend adding basic timing
  instrumentation (dev-only, per Phase 27 of the audit) if precise numbers are needed later.
