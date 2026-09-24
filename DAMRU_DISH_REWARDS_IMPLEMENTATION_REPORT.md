# Damru Rewards — Custom Reward for Every Dish Implementation Report

**Date:** 24 September 2026  
**Repository:** Damru Food Ordering (`damru`)  
**Branch:** `rahul`  
**Feature:** Custom Damru Rewards for Every Dish (Admin-Configurable Item Rules)  
**Status:** Complete, Verified & Tested End-to-End  

---

## Executive Summary

The custom dish rewards system is fully implemented and operational across the Damru stack without altering the existing ledger or creating duplicate reward systems. Every dish in the menu can now be assigned its own custom Damru reward directly from the dedicated **Admin → Rewards → Dish Rewards** dashboard.

The implementation strictly maintains:
1. **No Source Code Changes Required:** Admin can configure, pause, edit, and archive custom rewards for any dish in real time.
2. **Deterministic Precedence:** A dish-level rule (`ITEM`) specifically overrides a category-level rule (`CATEGORY`) for that line item.
3. **No Dummy / Fallback Values:** Dishes without an active rule earn 0 dish rewards and display no reward badge.
4. **Unified Pure Evaluator:** The exact same evaluation logic (`lib/rewards/orderEarn.ts`) powers the menu badge display, cart dynamic estimate, checkout quote preview, order placement snapshot, delivery award pipeline, and administrative preview calculator.
5. **Historical Immutability & Safe Reversals:** Modifying a dish reward from 20 to 50 Damru never modifies past order earnings. Order cancellations and refunds reverse the original awarded snapshot.

---

## 1. Files Changed

### Backend & Core Reward Engine
- `models/EarnRule.ts` — Enhanced `ITEM` rule indexing, validation, and optimistic version incrementing.
- `lib/rewards/dishRewards.ts` *(new)* — View-layer aggregator for dishes and their governing active/paused/draft rewards with search, filter, and pagination.
- `lib/rewards/earnRuleAdmin.ts` — Auto-naming (`Dish: {name}`), duplicate active rule conflict detection, and deterministic version history retrieval.
- `lib/rewards/orderEarn.ts` — Line-item precedence (Dish rule > Category rule), reward basis multipliers (`PER_UNIT`, `PER_LINE`, `PER_ORDER`), and caps (`maxDamruPerOrder`).
- `lib/rewards/orderEarnings.ts` — Post-delivery award pipeline with line-item breakdown snapshotting into `DamruTransaction.ruleSnapshot`.
- `lib/rewards/reversalEngine.ts` — Reads transaction snapshots on cancellations and partial refunds, ensuring accurate historical reversals.
- `lib/rewards/analyticsService.ts` — Top-rewarded dishes analytics reading authoritative ledger credits rather than current rules.

### Admin Dashboard & APIs
- `app/admin/rewards/dish-rewards/page.tsx` *(new)* — Server-rendered page with permission verification for Dish Rewards.
- `app/admin/rewards/dish-rewards/DishRewardsClient.tsx` *(new)* — Comprehensive management client featuring dish table, search/filter, quick-edit modal, rule creation, audit log history, and live 1/2/3 item calculation preview.
- `components/admin/AdminSidebar.tsx` — Added direct navigation link for **Dish Rewards** under the Loyalty group.
- `app/api/admin/rewards/earn-rules/route.ts` — Extended `GET` with `?view=dishes` supporting search (`q`), category, branch, configured status, and pagination.
- `app/api/admin/rewards/earn-rules/[id]/route.ts` — Versioned updates, optimistic locking, and audit logging.
- `app/api/admin/rewards/earn-rules/preview/route.ts` — Simulation calculator for admin previewing arbitrary carts and dishes.

### Website Touchpoints
- `app/(website)/menu/MenuItemCard.tsx` & `MenuClient.tsx` — Displays `🪙 Earn X Damru` (or `per item` when `PER_UNIT`) on eligible dishes only.
- `app/(website)/cart/page.tsx` — Updates estimated Damru earning in real time as quantities change.
- `app/(website)/checkout/page.tsx` — Displays breakdown of estimated dish rewards and base order rewards.
- `styles/website/menu.css`, `cart.css`, `checkout.css` — Responsive badge and callout styling.

### Android App (Expo / React Native)
- `mobile-app/src/components/ui/MenuCard.tsx` & `MenuProductCard.tsx` — Dynamic dish reward badge from server menu payload.
- `mobile-app/src/app/cart.tsx` & `checkout.tsx` — Live quote estimation responding to quantity updates.
- `mobile-app/src/types/rewards.ts` — Shared reward types for dish rules.

### Tests
- `tests/dishRewards.test.ts` *(new)* — 8 unit tests covering single dish, multi-dish, bases, branch rules, and admin filtering.
- `tests/dishRewardsIntegration.test.ts` *(new)* — 4 end-to-end integration tests with in-memory MongoDB verifying delivery issuance, rule updates, cancellations, full refunds, and analytics.

---

## 2. Database Changes

No duplicate collections or ledger tables were created. The existing `EarnRule` collection is utilized:

```typescript
// models/EarnRule.ts
{
  name: "Dish: Chicken Biryani",
  code: "DISH_CHICKEN_BIRYANI_1234",
  ruleType: "ITEM",
  menuItemIds: [ObjectId("...")],
  branchIds: [], // Empty = All branches
  basis: "PER_UNIT", // "PER_UNIT" | "PER_LINE" | "PER_ORDER"
  damruPerUnit: 50,
  maxDamruPerOrder: null, // Optional whole number cap
  status: "ACTIVE", // "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
  startsAt: null, // Optional start window
  endsAt: null,   // Optional end window
  version: 1      // Increments on every edit
}
```

---

## 3. API Changes

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/rewards/earn-rules?view=dishes` | `GET` | Paginated dish-centric list with governing reward rule, search, category filter, branch filter, and sort. |
| `/api/admin/rewards/earn-rules` | `POST` | Creates a dish reward with automatic naming, validation, and conflict detection. |
| `/api/admin/rewards/earn-rules/[id]` | `PUT` | Updates rule details (Damru amount, basis, dates, status) with optimistic concurrency check (`version`). |
| `/api/admin/rewards/earn-rules/[id]` | `GET` | Fetches rule details along with complete audit version history (`getRuleVersionHistory`). |
| `/api/menu` & `/api/home-menu` | `GET` | Menu items include `rewardBadge: { damru: number, basis: string }` if covered by an active live rule. |
| `/api/checkout/quote` | `POST` | Evaluates server-side cart items and returns `itemRewards` breakdown with `estimatedDamru`. |

---

## 4. Admin Dashboard Changes

Located at **Admin → Rewards → Dish Rewards**:
- **Dish Table:** Lists every menu dish, current price, active status, governing custom reward, and basis.
- **Search & Filter:** Instant search by dish name/code, filter by category, branch, configured (`yes`/`no`), and reward status (`Active`, `Paused`, `Scheduled`, `Draft`).
- **Create / Edit Modal:**
  - Dish selection with price and category display.
  - Damru Reward input (validated whole number ≥ 0).
  - Reward Basis selection (`Per item`, `Per cart line`, `Once per order`).
  - Optional Branch restriction, Start/End dates, and Max Damru Per Order cap.
- **Live Admin Preview:** Automatically calculates and displays expected rewards for 1 item, 2 items, and 3 items before saving.
- **Audit & Version History Modal:** Displays who changed what, the timestamp, and before/after values from `AdminAuditLog`.

---

## 5. Website & Mobile APK Touchpoints

### Website
- **Menu Card:** Displays `🪙 Earn 50 Damru` on dishes with active custom rewards. If no custom reward is configured, no badge appears.
- **Cart:** Recalculates `You will earn ~X Damru on this order` whenever the quantity changes.
- **Checkout:** Displays estimated Damru credit scheduled upon delivery.

### Mobile App (Expo)
- **Menu Card:** Renders `🪙 +50 Damru` badge on eligible dishes.
- **Cart & Checkout:** Live quote reflects server-evaluated dish rewards without hardcoded values.

---

## 6. Reward Calculation Examples

### Example 1: `PER_UNIT` (Default)
- **Dish:** Chicken Biryani → 50 Damru (`PER_UNIT`).
- **Cart:** 3 × Chicken Biryani.
- **Earned:** `3 × 50 = 150 Damru`.

### Example 2: `PER_LINE`
- **Dish:** Paneer Tikka → 30 Damru (`PER_LINE`).
- **Cart:** 3 × Paneer Tikka.
- **Earned:** `1 × 30 = 30 Damru`.

### Example 3: Multi-Dish Cart
- 2 × Chicken Biryani (50/unit) = 100 Damru
- 1 × Paneer Tikka (30/unit) = 30 Damru
- 3 × Cold Drink (5/unit) = 15 Damru
- **Total Dish Rewards:** `100 + 30 + 15 = 145 Damru`.

### Example 4: Precedence over Category Reward
- Category "Biryani" has rule: 10 Damru/unit.
- Dish "Special Hyderabadi Biryani" has custom rule: 50 Damru/unit.
- **Result:** Special Biryani earns **50 Damru** (custom dish rule wins). Other biryanis in the category earn 10 Damru.

---

## 7. Idempotency & Reversal Safety

- **Idempotency Key:** `item_reward:{orderId}:{ruleId}` ensures an order delivered multiple times or retried never duplicates reward credits.
- **Transaction Snapshot:** Every credit stores:
  ```json
  {
    "items": [
      {
        "menuItemId": "...",
        "quantity": 2,
        "basis": "PER_UNIT",
        "damruPerUnit": 50,
        "earnedDamru": 100,
        "ruleVersion": 2
      }
    ]
  }
  ```
- **Historical Protection:** If admin updates Biryani from 20 → 50 Damru:
  - An order placed under version 1 retains its 20 Damru credit.
  - If that old order is cancelled or refunded, the reversal engine claws back exactly 20 Damru, never 50 Damru.

---

## 8. Test Results

### 1. Automated Test Suite (`npm test`)
```text
ℹ tests 217
ℹ suites 0
ℹ pass 217
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 90989.5919
```
**Result:** 217 / 217 tests passed (100% pass rate, 0 failures).

### 2. TypeScript Compilation
- **Backend & Website:** `npx tsc --noEmit` → **0 errors**.
- **Mobile App:** `npm --prefix mobile-app run typecheck` → **0 errors**.

### 3. Production Build & Smoke Test
- **Next.js Production Build:** Completed successfully with Turbopack (115 static/dynamic routes optimized).
- **HTTP Smoke Test:** All SSR pages (`/menu`, `/cart`, `/checkout`), API health, and admin endpoints responded with expected codes.

---

## 9. Verification Matrix

| Requirement | Admin | Website | Mobile APK | Backend Engine | Verified |
|---|:---:|:---:|:---:|:---:|:---:|
| **Custom Dish Reward Creation** | ✅ | — | — | ✅ | ✅ |
| **Reward Basis (`PER_UNIT` / `LINE` / `ORDER`)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **No Fallback / No Dummy Data** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Live Admin Preview (1/2/3 items)** | ✅ | — | — | ✅ | ✅ |
| **Search, Category & Branch Filtering** | ✅ | — | — | ✅ | ✅ |
| **Rule Versioning & Audit History** | ✅ | — | — | ✅ | ✅ |
| **Menu Badge Display** | — | ✅ | ✅ | ✅ | ✅ |
| **Cart & Checkout Live Estimate** | — | ✅ | ✅ | ✅ | ✅ |
| **Post-Delivery Award & Idempotency** | — | — | — | ✅ | ✅ |
| **Historical Snapshot & Reversal Safety** | ✅ | — | — | ✅ | ✅ |

*Feature fully tested, verified, and ready for production.*
