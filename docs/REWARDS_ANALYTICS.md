# Rewards Analytics

The admin dashboard at `/admin/rewards/analytics` is a read-only reporting surface protected by the existing `rewards.view` permission. Its API is `GET /api/admin/rewards/analytics`.

## Definitions

- **Issued**: credit ledger entries from reward-producing categories. Refund restorations and legacy opening balances are excluded.
- **Redeemed**: `redemption` debit entries.
- **Expired**: `expiry` debit entries.
- **Restored**: `refund_restore` credit entries, reported independently.
- **Outstanding**: sum of current non-negative `User.damruBalance` values. The user wallet is authoritative for current liability.
- **Liability**: outstanding Damru multiplied by the configured rupees-per-Damru redemption rate.
- **Redemption rate**: redeemed divided by issued for the selected period.
- **Breakage rate**: expired divided by issued for the selected period.

All date boundaries and chart buckets use `Asia/Kolkata`. Supported filters are today, 7/30 days, current month, 3/6 months, current year, and inclusive custom dates.

## Data and privacy

The dashboard aggregates the Damru ledger, users, achievements, missions, referrals, loyalty tiers, and private/reward coupons. Customer emails are masked. Responses are privately cached for 60 seconds with stale revalidation for two minutes. Top-user queries are paginated and capped at 50 rows.

Expiry forecasts cover only credits with lot tracking (`remainingAmount`). Historical liability is intentionally not reconstructed because current balances can include legacy history without lot data. No snapshot or scheduled write job is introduced.

## Operations

The ledger has a compound `{ createdAt, type, category }` analytics index. Deployments should allow normal Mongoose index synchronization or create the equivalent index through the production database process. The dashboard never writes balances, transactions, eligibility, progress, rewards, coupons, or configuration.
