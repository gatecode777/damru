# Damru Mobile App — Architecture

This document maps how the mobile app's modules fit together: where things live, why they're
split the way they are, and the non-obvious decisions a new contributor would otherwise have to
reverse-engineer from the code. It does not enumerate every file — see the folder itself for that.

## Stack

- **Expo SDK 57** / **React Native 0.86** with the **New Architecture** enabled
  (`newArchEnabled=true` in `android/gradle.properties`) and **Hermes** as the JS engine.
- **Expo Router** for file-based navigation (`src/app/`).
- **TanStack Query** (`@tanstack/react-query`) for all server state.
- **React Context** (`AppProvider`) for the small amount of true client state: current user, cart.
- **React Native Reanimated** for animation, **react-native-svg** for vector graphics.
- **Razorpay** (`react-native-razorpay`) for payment collection, against the same backend
  endpoints the website uses.

## Startup flow

`src/app/_layout.tsx` is the root. On module load it calls
`SplashScreen.preventAutoHideAsync()`, then renders (in order) `QueryClientProvider` →
`SafeAreaProvider` → `AppProvider` → `RootLayoutContent`.

`RootLayoutContent` gates the real app behind two independent conditions:

1. `minimumSplashElapsed` — a hardcoded 1200ms floor, so the splash never flashes by too fast
   even on a warm start.
2. `startupReady` — `(fontsLoaded || fontError) && ready`, with a 4000ms `startupTimeoutElapsed`
   fallback so a slow font load or a stuck `AppProvider` can't strand the user on the splash
   screen forever.

While either condition is false, it renders `<BrandSplash>` (`src/components/splash/`) instead of
the `<Stack>`. Splash is a **two-stage** handoff:

- **Native stage** (before any JS runs): configured via the `expo-splash-screen` plugin in
  `app.json` — a static maroon background + a gold monogram image
  (`assets/images/splash-mark.png`), no animation possible at this stage since it's pure OS
  rendering.
- **JS stage** (`BrandSplash` component): mounts immediately underneath the native splash,
  replicates the same colors/mark so the handoff is seamless, then layers on the actual
  animation — an orbiting SVG ring, entrance choreography via Reanimated, wordmark/tagline text
  gated on `fontsLoaded` specifically to avoid a flash-of-unstyled-text.

`_layout.tsx` calls `SplashScreen.hideAsync()` as soon as fonts resolve, which reveals the
already-mounted `BrandSplash` — there's no gap between native and JS splash.

## Routing (`src/app/`)

Expo Router: file paths are routes. Conventions in use here:

- `(tabs)/` — the bottom-tab group (`index` = Home, `menu`, `branches`, `gallery`, `profile`).
  `(tabs)/_layout.tsx` wires up the tab bar.
- `[slug].tsx` / `[id].tsx` — dynamic routes (`branches/[slug]`, `blog/[slug]`, `order/[id]`).
  Prefer the object form of `router.push`/`Link` for these
  (`{ pathname: "/order/[id]", params: { id } }`) over template-literal strings — typed routes
  don't reliably resolve string interpolation.
- Screens outside `(tabs)/` (`cart`, `checkout`, `address-list`, `rewards-*`, `notifications`,
  etc.) are pushed on top of the tab stack — standalone screens with their own header, not part
  of the tab bar.
- `auth.tsx` is presented as a `transparentModal` (see the `Stack.Screen` options in
  `_layout.tsx`), not a full-screen push.

Two navigation bars coexist and are **not** interchangeable:
`components/navigation/GlobalBottomBar.tsx` (rendered once, globally, in `_layout.tsx`) is the
real bottom tab bar. `PremiumBottomTabBar.tsx` is a separate component — check which one a screen
actually renders before assuming "the bottom bar" means either one.

## State management

There are exactly two places app state lives, and they're deliberately not merged:

### `AppProvider` (`src/providers/AppProvider.tsx`)

Holds `user`, `cart`, and `ready`. This is the *only* global client state in the app — everything
else is either server state (React Query) or local to a screen.

- **Auth is cookie-based**, not token-based (`fetch(..., { credentials: "include" })` in
  `lib/api.ts`). There is no token stored in `AsyncStorage`/`SecureStore` to inspect — the browser
  cookie jar is the source of truth, and `refreshUser()` is how the client finds out whether it's
  logged in.
- `refreshUser()` only clears `user` on an actual `401`. Any other failure (timeout, network,
  5xx) leaves the last-known session alone and just warns in `__DEV__` — a transient network blip
  must never look like a logout.
- **Cart has two modes**: guest cart lives in `AsyncStorage` (key `damru.mobile.guest-cart.v1`)
  and is synced only on the client. Logged-in cart is server-authoritative — `syncCart()` pulls
  it from `/api/cart`, and local mutations (`addItem`/`setQuantity`) are debounced (500ms) into a
  diff-based `runSync()` that reconciles adds/removes/qty-changes against the server rather than
  re-sending the whole cart.
- The context `value` is `useMemo`'d — don't add anything to it that isn't itself referentially
  stable, or every consumer app-wide re-renders.

### TanStack Query

Everything that comes from the backend goes through React Query, configured once in
`src/lib/queryClient.ts`:

- `retry`: never retries a 4xx (auth/validation errors won't fix themselves by retrying —
  it just doubles failed traffic and delays the error UI). Retries once for anything else.
  `mutations.retry: 0` — always, since a retried mutation could double-submit an order or payment.
  - `refetchOnMount: false` — screens trust the cache instead of re-fetching every mount;
    combined with `refetchOnReconnect: true`, so staleness resolves on reconnect instead of on
    every navigation.
- `queryKeys` (also in `queryClient.ts`) is the single registry of every query key used in the
  app — add new keys here rather than inlining ad-hoc key arrays, so invalidation stays
  discoverable.

## Data layer

Three layers, each with one job:

1. **`src/lib/api.ts`** — the only place that calls `fetch`. Exports `get`/`post`/`patch`/`del`/
   `publicGet` (the last omits credentials, for endpoints that must work logged-out) and throws
   `ApiRequestError` (carries `.status`) on any non-2xx response, plus a 15s default timeout via
   `AbortController`. `getApiErrorMessage()` turns that error into user-facing copy, with
   specific wording for 401/403/404/429/5xx — reuse it rather than reading `error.message`
   directly in a screen.
2. **`src/services/*Api.ts`** — thin, typed wrappers per backend domain (`rewardsApi.ts`,
   `notificationsApi.ts`, `paymentApi.ts`, `paymentMethodsApi.ts`). No React here — just
   functions that call `lib/api.ts` and return typed data. `paymentApi.ts` calls the *same*
   Razorpay endpoints the website uses (`/api/payments/razorpay/*`) — there is no separate mobile
   payment/amount-calculation logic to keep in sync.
3. **`src/hooks/use*.ts`** — wraps a service call in `useQuery`/`useMutation` and shapes the
   result for screens (typically `{ data, loading, error, reload }`). `useCancelOrder.ts` is the
   one that does real optimistic-update work: it flips the order to `cancelled` in the shared
   `queryKeys.profile.orders()` cache immediately, rolls back on error, and is shared by both the
   orders list and the order detail screen so they can't drift out of sync with each other.

Screens that don't need a dedicated hook call `services/` directly inside `useQuery` — see
`address-list.tsx` or `orders.tsx`. Reach for a dedicated `hooks/use*.ts` file when more than one
screen needs the same query, or when it needs mutation/optimistic-update logic worth naming.

## Types (`src/types.ts` + `src/types/`)

`src/types.ts` (a single file, not a folder — don't confuse it with the `types/` folder next to
it) holds the core domain types used everywhere: `User`, `MenuItem`, `CartItem`, `Branch`, `Order`,
`Address`, `Coupon`, `Complaint`, `GalleryItem`/`GalleryTab`. Imported as `@/types`.

`src/types/` holds larger domain-specific type sets that would clutter the core file:
`rewards.ts` (dashboard/history/achievements/missions/referrals/loyalty response shapes) and
`notifications.ts`. Imported as `@/types/rewards`, `@/types/notifications`.

## Components (`src/components/`)

Organized by domain, mirroring the screens that consume them:

- `home/` — every section of the home screen (`HeroSection`, `MenuSection`,
  `BranchesSection`, `BlogsSection`, `ReservationSection`, etc.), one file per section, composed
  in `(tabs)/index.tsx`.
- `profile/` — cards and sections for the Profile tab's sub-tabs (`UserProfileCard`,
  `AddressBookCard`, `OrdersCard`, `RewardsSection`, `PaymentMethodsSection`,
  `HelpSupportSection`). The Profile screen itself (`(tabs)/profile.tsx`) also renders some list
  items inline rather than via these components — when touching spacing/layout there, check
  whether the fix belongs in the shared component or in `profile.tsx`'s own styles.
- `menu/`, `branches/`, `orders/`, `blog/`, `auth/`, `navigation/`, `splash/` — one per domain,
  same pattern.
- `ui/` and `ui.tsx` (note: both exist — `components/ui.tsx` is a single file exporting small
  shared primitives (`Button`, `Field`, `ScreenTitle`, `EmptyState`); `components/ui/` is a
  folder of larger shared pieces (`Image`, `Skeleton`, `AnimatedIcon`, `NavMenu`, card
  components)). Check which one a symbol comes from — the import paths look similar
  (`@/components/ui` vs `@/components/ui/Skeleton`) but resolve to different things.

### Skeleton loading

`components/ui/Skeleton.tsx` exports the shared `Skeleton`/`SkeletonLines` primitives (a
pulsing-opacity block via Reanimated) — this is what most screens use for loading states now.
Some older components (`MenuProductSkeleton`, `BranchCardSkeleton` in `(tabs)/branches.tsx`,
`BlogCardSkeleton`) predate the shared primitive and build their own static (non-animated) gray
blocks instead — functionally fine, just visually slightly different from the shared one. Prefer
`Skeleton`/`SkeletonLines` for anything new. Small inline spinners (submit buttons, "load more"
pagination footers) intentionally still use plain `ActivityIndicator` — that's correct; only
full-screen/full-section content loading should be a skeleton.

## Styling

Two parallel design-token systems coexist — know which file you're in:

- **`src/config.ts`**'s `colors` object (`colors.orange`, `colors.ink`, `colors.paper`, etc.) is
  the one used almost everywhere: profile, orders, rewards, checkout, cart, auth.
- **`src/constants/theme.ts`**'s `Colors`/`Typography`/`Layout` is used specifically by the home
  hero/menu area (`HeroSection`, `MenuSection`, `HomeHeader`, `FoodThumbnailSelector`,
  `HeroActions`, `(tabs)/index.tsx`, and the `ui/MenuCard`-family components). Its color values
  don't exactly match `config.ts`'s (e.g. `primaryOrange: '#e67e22'` vs `colors.orange:
  '#e57922'` — close but not identical).

Don't assume one token system when editing a file — grep for which `colors`/`Colors` import it
actually uses before changing a value.

Fonts are loaded once via `useFonts()` in `_layout.tsx`: **Playfair Display** (700/800 weights +
400 regular + 500 italic — the italic is used only by `BrandSplash`) for display/headings,
**Poppins** (400/500/600/700) for body text, **Montserrat** (400/600/700) for a handful of
labels. Only load a new weight if something actually renders it — unused weights were
specifically trimmed for bundle size (see the size-optimization history in git log if curious).

## Rewards & payments

Rewards are **backend-authoritative** — the app only ever displays what `/api/rewards/*` returns
and never computes balances, eligibility, or redemption client-side (`rewardsApi.ts` is read-only
except for `redeemDamru`, which still just calls the backend and trusts its response). If a
screen needs a number to "look right" it should be re-fetching, not calculating.

Payments go through Razorpay: `paymentApi.ts` creates a Razorpay order via the backend, the
native `react-native-razorpay` SDK handles card entry, and the result is verified server-side
(`/api/payments/razorpay/verify`) — the client never has enough information to fake a successful
payment.

## Native / build layer

- **Hermes** and **New Architecture** are both on. `android/app/proguard-rules.pro` carries keep
  rules for Reanimated, Worklets, Fabric, and Razorpay specifically — Razorpay's SDK ships no
  ProGuard rules of its own, so removing that block will break checkout the moment release
  minification is enabled without anyone noticing until a real payment is attempted.
- `android/` is **gitignored and regenerated** via `npx expo prebuild --clean` — it is not the
  source of truth for anything; `app.json` + installed packages are. If a `prebuild --clean` is
  ever re-run, both the ProGuard additions above and the `android.enableMinifyInReleaseBuilds` /
  `android.enableShrinkResourcesInReleaseBuilds` gradle properties get reset and need re-adding.
- Images are WebP (converted from PNG/JPG for size; originals kept in `assets-originals/` outside
  the bundled `assets/` folder). Native-required assets (`icon.png`, `android-icon-foreground.png`,
  `favicon.png`) stay PNG because the OS/Play Store pipeline expects it.
