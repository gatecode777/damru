<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Damru Development Rules

## Architecture
- Next.js website + shared backend
- React Native/Expo mobile app
- MongoDB/Mongoose
- Reuse existing authentication and API patterns

## Rewards
- DamruTransaction is the financial ledger.
- Never directly modify Damru balance.
- All rewards must use the existing Reward Engine.
- Every reward-producing action must be idempotent.
- Backend is authoritative for eligibility, progress, and redemption.
- Do not duplicate order-delivery business logic.

## Existing Completed Modules
- Core Rewards
- Customer Rewards UI
- Daily Streak
- Achievements
- Missions
- Referrals

## Repository Safety
- Do not reset existing uncommitted changes.
- Do not modify unrelated files.
- Do not scan generated directories.
- Do not install dependencies unless required.

## Validation
- Run targeted TypeScript and lint.
- Mobile Expo lint currently has a known eslint-config-expo/flat environment issue.
