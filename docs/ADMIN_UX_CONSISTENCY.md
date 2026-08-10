# Admin UX Consistency

## Shared toast architecture

Admin feedback is provided by `components/admin/Toast.tsx`. `ToastProvider` is mounted once in `app/admin/layout.tsx`; admin client components call `useToast()` and must not add page-local toast markup or install another notification package. The provider displays at most five visible notifications, uses the existing top-right placement, and announces errors as alerts while success and information messages use polite status announcements.

## Usage

```ts
const toast = useToast();

try {
  const response = await save();
  if (!response.ok) {
    toast.error("Unable to save settings", await getAdminResponseError(response, "Please try again."));
    return;
  }
  toast.success("Settings saved successfully");
} catch (error) {
  toast.error("Unable to save settings", getAdminErrorMessage(error));
}
```

Success messages are short, action-specific, and emitted only after backend confirmation. Background work describes the confirmed state (for example, “Campaign queued for sending”). Error details must be safe for end users; raw gateway, database, stack, network, and framework errors are not rendered. `lib/admin-error.ts` normalizes common HTTP failures, including session expiry, denied permission, missing resources, conflicts, rate limits, and server errors.

## Forms, confirmations, and loading

Field validation remains beside or above the relevant form. A toast may summarize invalid input but does not replace field feedback. Delete, cancellation, refund, Damru debit, campaign send/cancel, deactivation, and comparable destructive actions retain their confirmation step.

Mutation controls must be disabled and display their existing pending label while a request is active. Frontend pending state prevents accidental repeated clicks but does not replace backend idempotency. Wallet adjustments, refunds, payment reconciliation, and campaign dispatch remain backend-authoritative and are never presented as complete before the backend confirms that state.

## Module audit and migration

| Module | Result | Notes |
| --- | --- | --- |
| Dashboard / Analytics | No mutations | Read-only views. |
| Users | Pass | Create, update, status, bulk status, and delete audited. |
| Orders | Pass | Status, COD payment status, cancellation, refund, and reconciliation audited. |
| Reservations | Pass | Status and delete audited. |
| Complaints | Pass | Status, note, and delete audited. |
| Categories / Menu Items | Pass | Create, update, enable/disable, and delete audited. |
| Tables & QR | Pass | Existing integration retained and regression-checked. |
| Gallery | Pass | Upload, create/update/delete, and publish/unpublish audited. |
| Rewards | Pass | Rules, configuration, daily rewards, achievements, missions, referrals, loyalty, adjustments, and occasion unlocks audited. |
| Notifications | Pass | Campaign draft/schedule/send/cancel and templates audited. |
| Coupons | Pass | Create, update, enable/disable, and delete audited. |
| Managers | Pass | Existing integration retained and regression-checked. |
| Settings | Pass | Save audited. |
| Blogs / Blog Categories | Pass | Create, update, publish/enable, and delete audited. |
| Branches / Banquet Bookings | Pass | Create/update, activation/status, and delete audited; legacy toast clones removed. |

## Deferred modules

None. Authentication login validation remains inline because it is not an authenticated admin-dashboard mutation.
