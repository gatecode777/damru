# Damru Website Toast System

## Architecture

The customer website owns one `WebsiteToastProvider`, mounted once in `app/(website)/layout.tsx`. Website components call `useWebsiteToast()` from `components/website/Toast.tsx`. The admin provider remains separate and the React Native app is outside this system.

The provider supports at most four visible toasts. Passing an `id` replaces an active toast with the same id, preventing duplicate feedback from repeated callbacks or clicks.

## Toast types and timing

| Type | Use | Default duration |
| --- | --- | ---: |
| `success` | Confirmed mutation success | 3.6 seconds |
| `info` | Non-critical progress or informational action | 4 seconds |
| `warning` | Recoverable validation/cancellation state | 5 seconds |
| `error` | Failed mutation or critical action feedback | 5.6 seconds |

All types include an icon, title, optional description, dismiss button, and progress bar.

## Usage

```tsx
import { useWebsiteToast } from "@/components/website/Toast";

const toast = useWebsiteToast();

toast.success("Address updated");
toast.error("Payment failed", "No payment was confirmed. Please retry.");
toast.info("Payment verification pending", "Check My Orders shortly.");
toast.warning("Coupon not applied", "The minimum order value was not met.");

// Repeated callbacks replace the current toast instead of stacking duplicates.
toast.success("Coupon applied", "SAVE20 saved you ₹100.", { id: "coupon-applied" });
```

## Error normalization

`lib/getUserErrorMessage.ts` maps response status and network failures to customer-safe messages:

- `401`: session expired
- `403`: permission denied
- `404`: information not found
- `409`: already completed/unavailable
- `429`: rate limited
- `500+`: generic retry message
- network failure: connection guidance

Safe API validation messages may be shown for `400`, `409`, and `422`. Known database, stack, Axios, and React Query error strings are suppressed.

## Mutation and query rules

- Toast only after a user-triggered mutation result is known.
- Payment success is shown only after backend signature verification or backend zero-payable finalization.
- Query/read failures keep their local section states and do not globally toast on every retry.
- Inline field validation and persistent order/payment states remain visible.
- Destructive actions retain confirmation dialogs; the toast reports the result after the API call.
- Use stable IDs for mutation callbacks that may fire more than once.

## Accessibility and responsive behavior

- The stack uses `aria-live="polite"`.
- Errors use `role="alert"`; other types use `role="status"`.
- Icons and text supplement color.
- Dismiss buttons are keyboard accessible with visible focus styling.
- Reduced-motion preference disables animations.
- Desktop placement is top-right below the site header.
- At 600 px and below, cards use safe-area-aware top-center full-width placement with 12 px margins.
- Long content wraps and the stack is capped at four cards.

## Website mutation audit

| Module | Existing action feedback | Global toast | Inline state | Confirmation | Status |
| --- | --- | --- | --- | --- | --- |
| Authentication | Inline auth errors/success | Login, register, OTP, password reset, logout | Kept | N/A | Migrated |
| Reservations | Custom fixed success/error box | Create success/failure | Booking state kept | N/A | Migrated; custom toast removed |
| Banquet requests | Persistent result/inline errors and one non-persisted alert form | Submit success/failure | Result and field errors kept | N/A | Migrated |
| Profile | Page-local toast | Profile/photo/password/date actions | Field errors kept | Sensitive actions kept | Migrated; local toast removed |
| Address book | Page-local feedback | Add/update/delete/failure | Field errors kept | Delete confirmation kept | Migrated |
| Rewards | Page-local feedback | Birthday, anniversary, referral/coupon copy, checkout redemption | Reward state kept | N/A | Migrated |
| Daily check-in | No manual customer check-in mutation exists | None | Existing reward dashboard only | N/A | Not required |
| Coupons | Inline coupon result | Apply/remove/invalid/network feedback | Coupon error kept | N/A | Migrated |
| Cart/menu | Custom fixed add-to-cart box | Add/remove/clear feedback | Quantity controls remain inline | N/A | Migrated; custom toast removed |
| Checkout | Inline errors and result screens | Address, Damru, order and payment feedback | Payment/order screens kept | Address delete confirmation kept | Migrated |
| Razorpay | Inline pending/failed screens | Preparing/cancel/fail/pending/verified success | Retry state kept | Razorpay UI retained | Migrated |
| Orders | Page-local feedback | Cancellation success/failure | Status pipeline kept | Cancellation dialog kept | Migrated |
| Refunds | No customer refund mutation exists | None | Existing refund status remains | N/A | Not required |
| Notifications | Silent mutation | Mark read/all read and preference save/failure | Notification center retained | N/A | Migrated |
| Payment methods | Website section is currently non-functional/static | None | Existing placeholder retained | N/A | Not required |
| Complaints/support | Page-local generic feedback | Complaint submit/upload success/failure | Field errors and complaint history kept | N/A | Migrated |
| Blog comments | Temporary success banner/silent reply failure | Comment/reply success/failure | Comment field error kept | N/A | Migrated; success banner removed |
| Contact page | No website mutation endpoint/form handler exists | None | Static contact information retained | N/A | Not required |

## Confirmation rules

Toasts never replace confirmation for order cancellation, address deletion, account-sensitive operations, or other destructive actions. The sequence is confirmation, API request, then success/error toast.

## Admin and mobile boundaries

The admin continues using `components/admin/Toast.tsx` and its own provider in `app/admin/layout.tsx`. No admin toast architecture was merged into the website implementation. The React Native application does not import or mount the website provider.
