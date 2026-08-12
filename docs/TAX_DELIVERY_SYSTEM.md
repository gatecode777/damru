# Damru Tax, Delivery Fee, and Checkout Charges

## Architecture

`CheckoutChargesConfig` is the single active checkout-charges configuration. The admin module lives at `/admin/checkout-charges` and uses the existing `settings` permission. Website and mobile request server quotes from `POST /api/checkout/quote`; neither client calculates tax, delivery, coupon, Damru, or final payable independently.

Final order creation always recalculates from current server state. A quote is display guidance, not authority. Menu prices are resolved from active `MenuItem` documents, coupons are revalidated, address serviceability is checked, and the current charges configuration is loaded once for the calculation.

## Calculation Order

The authoritative formula is:

1. Canonical menu prices × quantities = merchandise subtotal.
2. Eligible coupon discount is subtracted.
3. The discounted merchandise subtotal determines minimum-order and free-delivery eligibility.
4. The selected delivery rule determines delivery fee.
5. Tax is calculated on the configured basis, optionally including delivery.
6. Existing Reward Engine redemption supplies the Damru discount.
7. Final payable = discounted merchandise + delivery + tax − Damru discount.

All money is converted to integer paise for arithmetic and returned in rupees rounded to two decimal places.

## Tax Rules

The MVP has one deterministic active default rule. Tax can be disabled, percentage-based, or fixed per order. Its basis is either `MERCHANDISE_SUBTOTAL` or `AFTER_DISCOUNTS`. `taxDeliveryFee` explicitly controls whether delivery enters the taxable base. The configured tax name, rate/type, basis, and resulting amount are snapshotted on every new order.

Tax rates are configuration, not legal advice. Applicable GST and invoicing requirements must be reviewed by the business and its tax adviser.

## Delivery Rules

Supported modes:

- `FLAT`: the configured default fee.
- `ORDER_VALUE`: one matching, non-overlapping order-value slab.
- `BRANCH_BASED`: a rule for the verified nearest `branchId`, with the flat fee as explicit fallback.
- `DISTANCE`: a rule for a verified coordinate-based distance.

Delivery is always zero for the existing dine-in order type. The system does not invent pickup or other unsupported order types.

## Free Delivery and Minimum Order

Both use merchandise subtotal after coupon discount and before Damru redemption. The free-delivery threshold is inclusive: a threshold of ₹499 is free at ₹499 and above. Minimum delivery order is also inclusive; lower values are rejected by the backend.

## Order-Value Slabs

Slab bounds are inclusive and support paise precision. For contiguous monetary slabs, configure `0–299.99`, `300–499.99`, and `500–No Limit`. Slabs are sorted and validated; gaps and overlaps are rejected.

## Branch Mode

Branch rules apply only when delivery serviceability produced a trusted nearest `branchId`. An unmatched verified branch uses the configured flat fallback and records `BRANCH_DEFAULT` in the snapshot. The system never guesses a branch from customer text.

## Distance Mode and Infrastructure

Distance mode is enabled because the current delivery serviceability layer geocodes an address and calculates Haversine distance against active branches with stored latitude/longitude. It does not estimate kilometres directly from address text. An address without a verified result is not deliverable. `maximumDistanceKm` remains an authoritative hard boundary.

## Coupons

The existing coupon types remain flat and percentage. Coupons discount merchandise only; free-delivery coupons were not invented. Validation and order creation load the server cart and canonical menu prices. Order creation atomically reserves limited coupon usage.

## Damru

Wallet balance is never edited by the checkout calculator. The existing Reward Engine performs the idempotent debit after the order record exists. The resulting rupee discount is then written into the financial snapshot and used identically by COD and Razorpay. Eligibility and balance are rechecked at order creation, so a quote cannot reserve or guarantee wallet funds.

## Razorpay and COD

Both payment methods use the same stored `finalAmount`. Razorpay receives that backend amount converted to paise. It never accepts a client amount. COD displays and stores the same payable; only payment handling differs. Legacy orders without `finalAmount` retain the previous redemption-transaction fallback.

## Order Snapshot

New orders retain:

- `subtotal`
- `couponDiscount` and coupon code
- `deliveryFee`
- `taxAmount`
- `damruDiscount`
- `finalAmount`
- a `chargesSnapshot` containing configuration ID/version, currency, tax metadata, delivery mode, applied delivery rule, and free-delivery status

Legacy aliases (`discount`, `shipping`, `tax`, and `total`) remain populated for compatibility. Changing configuration affects new calculations only and never recalculates an existing order.

## Security

The backend ignores client-supplied subtotal, tax, delivery fee, discount, and total fields. Menu IDs, active state, variant labels, quantities, and database prices are validated. Customer checkout config exposes labels and safe display metadata only. Admin configuration APIs require the existing `settings` view/edit permission, including explicit super-admin handling.

## Validation

Server validation rejects negative, non-finite, excessive, overlapping, or gapped values. Percentage tax is constrained to 0–100. Branch IDs must be valid and unique. Only the final slab may be open-ended. Final payable cannot be negative.

## Admin Configuration and Preview

The admin page contains Tax Rules, Delivery Rules, General Configuration, and Change History tabs. Save actions use the existing admin Toast provider. The preview calculator calls a protected backend endpoint that uses the same calculation function and does not create an order.

## Audit Logs

Every successful configuration update records the actor, timestamp, summary, and before/after tax and delivery settings in `CheckoutChargesAudit`. No SMTP credentials, payment keys, or other secrets are logged.

## Examples

With subtotal ₹500, coupon ₹50, flat delivery ₹50, 5% tax after discount excluding delivery, and Damru discount ₹50:

- Eligible merchandise: ₹450
- Delivery: ₹50
- Tax: ₹22.50
- Final payable: ₹472.50

If tax-on-delivery is enabled, tax becomes ₹25 and final payable becomes ₹475.

## Troubleshooting

- “Minimum delivery order”: raise eligible merchandise to the configured minimum.
- “Delivery unavailable”: verify address geocoding, active branch coordinates, maximum distance, and the selected mode's rules.
- Quote differs after submit: server state changed (menu price, coupon availability, wallet balance, or configuration); the order creation result is authoritative.
- Admin cannot edit: grant the existing Settings edit permission or use an explicitly configured super admin.
- Historical order lacks snapshot: it predates this rollout and continues to use its stored legacy totals.
