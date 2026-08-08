# DAMRU

## Digital Commerce & Rewards Platform

**Project Overview & Feature Documentation**  
Website + Mobile Application + Admin Platform  
Version 1.0 · 7 August 2026

---

## 1. Executive Summary

Damru is an integrated restaurant commerce and customer-engagement platform. Customers can discover menus and branches, maintain a cart, place orders, manage their profile, and use a rewards experience from the website or mobile application. Staff operate the business through a permission-controlled administration platform.

The rewards programme combines a Damru wallet and transaction history with coupons, daily login streaks, achievements, missions, referrals, and configurable loyalty tiers. Eligibility and reward issuance are controlled by the backend so the website and mobile application show the same authoritative state.

## 2. Platform Overview

```text
                         DAMRU
            ┌──────────────┼──────────────┐
            │              │              │
         Website       Mobile App       Admin
            └──────────────┼──────────────┘
                           │
                  Next.js API & Services
                           │
                        MongoDB
```

## 3. Customer Journey

1. Discover the menu, offers, branches, blogs, gallery, and banquet services.
2. Register or sign in with verified customer credentials.
3. Add menu items to the cart and manage quantities.
4. Select an address, validate a coupon or Damru redemption, and place an order.
5. Follow order history and delivery status from the customer profile.
6. Earn rewards through configured activities and delivered-order events.
7. Track loyalty progress, missions, achievements, referrals, coupons, and reward history.

## 4. Website Experience

The responsive website includes home, menu, branches, gallery, offers, blogs, about, contact, banquet, cart, checkout, legal-policy, and customer-profile experiences. The profile centralises account details, addresses, orders, payments, offers, support, and Damru Rewards.

## 5. Mobile Experience

The Expo/React Native application provides tab-based access to home, menu, branches, gallery, and profile. Dedicated screens cover authentication, cart, checkout, orders, addresses, payments, reservations, offers, search, blogs, and all major rewards features. Rewards lists support loading, retry, and pull-to-refresh patterns.

## 6. Commerce

Customers can browse menu items, choose product variants, maintain a cart, select delivery details, apply eligible coupons, redeem Damru, select a payment method, and submit an order. The backend recalculates and validates sensitive checkout values. Delivered orders act as trusted business events for reward evaluation.

## 7. Customer Account

Customer accounts support registration, email/OTP verification flows, login, logout, password reset, profile data, saved addresses, order history, occasion dates, and reward state. Birthday and marriage-anniversary dates become protected after being set and require authorised support intervention to unlock.

## 8. Damru Rewards

Damru uses a ledger-backed wallet. Every credit and debit is recorded as a transaction with a deterministic key where repeat execution is possible. Customers can see available Damru, lifetime earnings, redemption totals, active coupons, recent activity, and upcoming rewards.

Implemented reward sources include registration, first delivered order, configured occasions, daily login, achievements, missions, referrals, loyalty-tier upgrades, administration adjustments, and checkout redemption.

## 9. Daily Streaks

Daily check-ins can award different amounts by day. Administration controls the reward sequence, cycle behaviour, grace-period policy, and activation status. Customers see their current and longest streak, today’s state, and the next reward.

## 10. Achievements

Achievements provide longer-term goals across shopping, spending, engagement, profile completion, loyalty, referrals, and special campaigns. Supported measurements include delivered-order count, lifetime spend, login streak, profile completion, and account age. Progress and unlocking are backend-controlled.

## 11. Missions

Missions provide time-bound or one-time challenges. Supported periods include daily, weekly, monthly, campaign, and one-time missions. Order count, spending, login streak, and profile completion can drive progress. Duplicate events are prevented from incrementing a mission twice.

## 12. Referrals

Customers receive a reusable referral code and sharing message. A referred account progresses through registration, qualification, and reward states. Configuration controls eligibility, minimum order amount, optional verification requirements, reward values, limits, and delays. Both parties’ rewards use duplicate-safe issuance.

## 13. Loyalty Tiers

Loyalty tiers are configured by administration rather than hardcoded into customer interfaces. A tier can define its name, code, rank, qualification range, badge, benefits, eligible-order reward multiplier, and optional upgrade bonus. The active ladder uses one qualification method: lifetime delivered spend, completed delivered orders, or lifetime Damru earned.

Customers see their current tier, qualification value, next tier, percentage progress, remaining value, benefits, and the complete active ladder. Tier changes are evaluated from trusted backend data when an order is delivered. Existing accounts can be safely reconciled without issuing historical bonuses.

## 14. Coupons and Offers

The platform supports public and customer-specific coupons, flat or percentage reductions, minimum order values, usage limits, validity windows, and reward-generated private coupons. Coupon eligibility is validated by the backend and private coupons remain scoped to their assigned customer.

## 15. Branches, Reservations, and Banquets

Customers can explore restaurant branches, request reservations, and submit banquet enquiries. Administration provides corresponding operational views for branches, tables, reservations, and banquet bookings.

## 16. Content and Engagement

Damru includes editable menu categories and items, blogs and blog categories, blog comments, gallery content, homepage content, offers, search, contact information, and site settings.

## 17. Administration

The administration platform covers dashboards, orders, users, managers, permissions, menu, categories, coupons, branches, tables, reservations, banquet bookings, complaints, blogs, galleries, rewards, notifications, analytics, and settings. Permission checks protect sensitive read and edit operations.

## 18. Rewards Administration

Rewards administration includes Reward Rules, Damru Configuration, Daily Rewards, Achievements, Missions, Referrals, Loyalty Tiers, and User Rewards. Authorised staff can configure programmes, inspect customer ledgers, unlock protected occasion fields, and perform reason-recorded balance adjustments.

## 19. Customer Trust and Safety

- Reward balances are backed by an auditable transaction ledger.
- Repeat reward events use deterministic duplicate protection.
- Eligibility, progress, coupon access, and redemption are validated by the backend.
- Passwords and verification data are protected rather than stored as readable credentials.
- Customer-specific coupons and order data are ownership checked.
- Administration actions are permission controlled.

## 20. Business Benefits

- One customer experience across web and mobile
- Centralised commerce and administration
- Repeat-purchase and retention programmes
- Configurable campaigns without frontend releases
- Auditable customer reward balances
- Loyalty progression and VIP benefits
- Referral-led acquisition
- Actionable order, customer, and engagement records

## 21. Current Implementation Status

| Module | Website | Mobile | Admin | Status |
|---|---:|---:|---:|---|
| Authentication and profile | Yes | Yes | Yes | Implemented |
| Menu, branches, and discovery | Yes | Yes | Yes | Implemented |
| Cart and checkout | Yes | Yes | Operational views | Implemented |
| Orders | Yes | Yes | Yes | Implemented |
| Coupons | Yes | Yes | Yes | Implemented |
| Core Damru wallet | Yes | Yes | Yes | Implemented |
| Daily streaks | Yes | Yes | Yes | Implemented |
| Achievements | Yes | Yes | Yes | Implemented |
| Missions | Yes | Yes | Yes | Implemented |
| Referrals | Yes | Yes | Yes | Implemented |
| Loyalty tiers | Yes | Yes | Yes | Implemented; tier data requires admin configuration |
| Reservations and banquets | Yes | Yes | Yes | Implemented |
| Blogs and gallery | Yes | Yes | Yes | Implemented |

## 22. Future Opportunities

Possible future work includes production analytics integration, broader automated integration testing, richer notification delivery, more loyalty-benefit fulfilment types, and additional payment-provider automation. These are opportunities, not claims about the current implementation.

---

*Prepared from the Damru repository implementation as of 7 August 2026. Secrets and personal customer data are intentionally excluded.*
