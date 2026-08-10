# Deployment Release Checklist

Production domain: `https://damrurestro.com`  
Production branch: `main`  
Hosting: Vercel, deployed automatically from GitHub

## Before deployment

- Confirm `git status`, current branch, and the intended release commit.
- Confirm no APK/AAB or unrelated generated artifacts are tracked.
- Run `npx tsc --noEmit`, `npm test`, and `npm run build`.
- Confirm the health route returns only status, short commit SHA, and timestamp.
- Review required environment variable names without printing their values.
- Confirm MongoDB points to the intended production database; never print its URI.
- Confirm schema changes remain backward-compatible and do not require destructive migration.
- Confirm new indexes do not duplicate or replace production indexes.
- Confirm `CRON_SECRET` exists and internal scheduler routes reject unauthenticated requests.
- Confirm every configured cron cadence is supported by the active Vercel plan.
- Record the previous known-good deployment and commit before releasing.

## Environment categories

- MongoDB: `MONGODB_URI`
- Authentication/session: `AUTH_SECRET`, `NEXTAUTH_URL`, `JWT_SECRET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; optional Resend configuration where used
- Razorpay (all-or-none): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Scheduler: `CRON_SECRET`
- Site URL, image/media, and notification variables used by the current source

Never copy secret values into release notes, logs, screenshots, or issue comments.

## Production verification

- Check `/api/health` and record its version.
- Verify Rewards and Notifications APIs exist; an expected `401` proves a protected route is deployed.
- Smoke-test homepage, login, profile, rewards, orders, checkout, and notifications.
- Verify Admin Rewards, Campaigns, Templates, Super Admin access, and staff permission persistence.
- Use only an approved test user for state-changing reward or notification checks.
- Never send an `ALL_USERS` campaign during release verification.
- Verify Razorpay order, verification, webhook, refund, and reconciliation route availability without a real-money test.
- Confirm the scheduled reconciliation job ran successfully after its next scheduled invocation.
- Verify the installed mobile app against production on a real device; do not infer mobile PASS from API checks.
- Check cold/warm start and slow-network behavior so optional Rewards/Notifications calls cannot block startup.

## Rollback

1. Stop verification if authentication, orders, checkout, or payments regress.
2. In Vercel, use Instant Rollback to promote the recorded previous known-good deployment, or redeploy its Git commit from `main`.
3. Recheck the production domain, `/api/health`, authentication, orders, checkout, and payments.
4. Verify cron configuration separately after rollback; do not assume a deployment rollback restored scheduled-job settings.
5. Record the rollback deployment identifier, commit, timestamp, reason, and verification outcome.

Do not reset the database, delete users or financial ledger entries, or run destructive migrations as part of rollback.
