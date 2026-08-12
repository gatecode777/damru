# Reward Campaigns

Reward campaigns are modifiers layered on the existing Reward Engine. Base rewards and campaign bonuses are separate `DamruTransaction` credits; balances are changed only through `awardDamru()`.

## Order policy

The base order reward is `floor(eligible amount / ₹10)`. Eligible amount is merchandise subtotal after coupon discount, before tax, shipping, and Damru redemption. It is snapshotted on new orders. Each order line snapshots its trusted menu category. Branch filters require a trusted `branchId`; branchless and legacy orders never qualify for branch campaigns.

## Types and modes

Initial types cover orders, category bonuses, referrals, missions, new users, loyalty audiences, and seasonal campaigns. Modes are fixed Damru, multiplier (bonus is `(multiplier - 1) × base`), and percent bonus. Per-event caps apply after flooring.

## Eligibility and stacking

Server time and stored order/user data determine eligibility. Dynamic active lookup includes ACTIVE or SCHEDULED campaigns inside their absolute time window; PAUSED, ENDED, and CANCELLED campaigns never qualify. BEST_ONLY is the default. When any applicable campaign is not stackable, the highest bonus wins, then priority, then campaign code. Campaigns combine only when every selected campaign explicitly uses STACK_ALLOWED.

## Financial safety

Each source event uses `campaign:{campaignId}:{userId}:{sourceId}`. A unique usage record prevents duplicates. The global counter and per-user counter are reserved through conditional MongoDB updates before award, then released if award fails. Activation requires a global budget. Award transactions include an immutable calculation snapshot and use standard Damru expiry.

## Admin workflow and integrations

Create campaigns under Admin → Rewards → Reward Campaigns. Creation always produces DRAFT. Activation asks for budget confirmation. Pause, resume, cancellation, and edits are audited. Reward/eligibility fields lock after issuance. An existing notification campaign may be linked; notification creation/sending stays decoupled. Public eligible offers are exposed through `/api/rewards/campaigns` to website and mobile without budget, priority, or selected-user data. PRD 4C counts campaign credits as an issuance source.

## Limitations and troubleshooting

Campaign rewards are not clawed back on refund/cancellation in this release; PRD 4E owns reversal policy. Legacy order category data and branchless orders cannot qualify for those filters. If a campaign does not award, verify status/time window, global and per-user limits, trusted order snapshots, audience, and the unique source event.
