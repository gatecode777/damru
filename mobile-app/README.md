# Damru mobile app

Native iOS and Android client for the Damru Next.js backend. Built with Expo SDK 57, React Native 0.86, TypeScript, and Expo Router.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the deployed Next.js origin. Do not include a trailing slash.
3. Run `npm install`.
4. Start with `npm run android`, `npm run ios`, or `npm start`.

The Android emulator can reach a local Next.js server at `http://10.0.2.2:3000`. A physical phone needs an HTTPS deployment or a reachable LAN address.

## Backend contract

The app calls the existing `/api` routes for user sessions, menu search, carts, coupons, addresses, orders, reservations, banquet enquiries, branches, gallery, blogs, and profile history. Native fetch uses `credentials: include` so the backend's `damru_user_session` HTTP-only cookie is retained.

The current website exposes menu content through `/api/search` rather than a list endpoint. The mobile menu therefore uses live search, matching the website header search contract without adding or changing website code.

## Quality checks

```sh
npm run typecheck
npm run lint
```

## Release

Configure the EAS project and store credentials, then run:

```sh
npx eas-cli build --platform all --profile production
```

Before release, replace the generated Expo icons in `assets/` with final Damru brand artwork and update `com.damru.app` if another bundle identifier is required.
