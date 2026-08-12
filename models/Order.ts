import mongoose, { Schema, Document, Model } from "mongoose";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
// Legacy `upi`/`card` values remain readable. New orders use only COD/Razorpay.
export type PaymentMethod = "cod" | "razorpay" | "upi" | "card";
// "refund_pending" | "partially_refunded" | "refunded" are Razorpay-only —
// see docs/PAYMENT_RELIABILITY_REFUNDS.md for the full state machine. A COD
// order's paymentStatus never leaves "pending"/"paid"/"failed".
export type PaymentStatus = "pending" | "paid" | "failed" | "refund_pending" | "partially_refunded" | "refunded";
export type OrderCancelledBy = "customer" | "admin" | "system";

export interface IOrderItem {
  menuItemId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  name:        string;
  image?:      string;
  variantType: string;
  custom:      string;
  price:       number;
  qty:         number;
}

export interface IDeliveryAddress {
  label:    string;
  fullName: string;
  phone:    string;
  house:    string;
  area:     string;
  city:     string;
  state:    string;
  pincode:  string;
}

export interface IOrderChargesSnapshot {
  configId?: mongoose.Types.ObjectId;
  configVersion: string;
  currency: "INR";
  taxName: string;
  taxRate: number | null;
  taxCalculationType: "PERCENTAGE" | "FIXED" | null;
  taxApplyOn: "MERCHANDISE_SUBTOTAL" | "AFTER_DISCOUNTS" | null;
  taxDeliveryFee: boolean;
  deliveryMode: "FLAT" | "ORDER_VALUE" | "DISTANCE" | "BRANCH_BASED" | null;
  appliedDeliveryRule: string;
  freeDeliveryApplied: boolean;
}

export interface IOrder extends Document {
  orderId:         string;           // human-readable: DMR-20260427-XXXX
  userId?:         mongoose.Types.ObjectId;
  userName:        string;
  userEmail?:      string;
  userPhone:       string;
  tableId?:        mongoose.Types.ObjectId;
  tableNumber?:    string;
  branchId?:       mongoose.Types.ObjectId;
  deliveryDistanceKm?: number;
  items:           IOrderItem[];
  deliveryAddress?: IDeliveryAddress;
  subtotal:        number;
  discount:        number;
  couponDiscount?: number;
  couponCode:      string;
  tax:             number;
  taxAmount?:      number;
  shipping:        number;
  deliveryFee?:    number;
  damruDiscount?:  number;
  finalAmount?:    number;
  total:           number;
  chargesSnapshot?: IOrderChargesSnapshot;
  eligibleRewardAmount: number;
  paymentMethod:   PaymentMethod;
  paymentStatus:   PaymentStatus;
  status:          OrderStatus;
  notes:           string;
  cancellationReason?: string;
  cancelledBy?: OrderCancelledBy;
  cancelledAt?: Date;
  // Razorpay — all optional; only ever set for non-COD payment methods.
  razorpayOrderId?:   string;
  razorpayPaymentId?: string;
  // Frozen at Razorpay-order-creation time: order.total net of any Damru
  // discount already redeemed for this order. This — not order.total — is
  // the amount actually charged/verified through the gateway. COD orders
  // never set this; their existing behavior (full order.total collected,
  // Damru shown as a separately-recorded rebate) is unchanged.
  paymentAmount?:     number;
  paymentVerifiedAt?: Date;
  paymentFailedAt?:   Date;
  paidAt?:            Date;
  // Refunds — see docs/PAYMENT_RELIABILITY_REFUNDS.md. `refundedAmount` only
  // ever counts refunds that have actually reached PaymentRefund's "processed"
  // state; `pendingRefundAmount` is a reservation held while exactly one
  // refund is in flight (a second refund request is rejected while it's > 0),
  // preventing two concurrent admin refund clicks from both claiming the same
  // remaining balance.
  refundedAmount:        number;
  pendingRefundAmount:   number;
  createdAt:       Date;
  updatedAt:       Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId:  { type: Schema.Types.ObjectId, ref: "MenuItem" },
    categoryId:  { type: Schema.Types.ObjectId, ref: "Category" },
    name:        { type: String, required: true },
    image:       { type: String },
    variantType: { type: String, default: "none" },
    custom:      { type: String, default: "" },
    price:       { type: Number, required: true },
    qty:         { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    label:    { type: String, default: "Home" },
    fullName: { type: String, required: true },
    phone:    { type: String, required: true },
    house:    { type: String, required: true },
    area:     { type: String, default: "" },
    city:     { type: String, required: true },
    state:    { type: String, required: true },
    pincode:  { type: String, required: true },
  },
  { _id: false }
);

const OrderChargesSnapshotSchema = new Schema<IOrderChargesSnapshot>({
  configId: { type: Schema.Types.ObjectId, ref: "CheckoutChargesConfig" },
  configVersion: { type: String, required: true },
  currency: { type: String, enum: ["INR"], default: "INR" },
  taxName: { type: String, default: "" },
  taxRate: { type: Number, default: null },
  taxCalculationType: { type: String, enum: ["PERCENTAGE", "FIXED", null], default: null },
  taxApplyOn: { type: String, enum: ["MERCHANDISE_SUBTOTAL", "AFTER_DISCOUNTS", null], default: null },
  taxDeliveryFee: { type: Boolean, default: false },
  deliveryMode: { type: String, enum: ["FLAT", "ORDER_VALUE", "DISTANCE", "BRANCH_BASED", null], default: null },
  appliedDeliveryRule: { type: String, default: "" },
  freeDeliveryApplied: { type: Boolean, default: false },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    orderId:         { type: String, required: true, unique: true },
    userId:          { type: Schema.Types.ObjectId, ref: "User" },
    userName:        { type: String, required: true },
    userEmail:       { type: String },
    userPhone:       { type: String, default: "" },
    tableId:         { type: Schema.Types.ObjectId, ref: "Table" },
    tableNumber:     { type: String },
    branchId:        { type: Schema.Types.ObjectId, ref: "Branch" },
    deliveryDistanceKm: { type: Number, min: 0 },
    items:           { type: [OrderItemSchema], required: true },
    deliveryAddress: { type: DeliveryAddressSchema },
    subtotal:        { type: Number, required: true },
    discount:        { type: Number, default: 0 },
    couponDiscount:  { type: Number, default: 0 },
    couponCode:      { type: String, default: "" },
    tax:             { type: Number, default: 0 },
    taxAmount:       { type: Number, default: 0 },
    shipping:        { type: Number, default: 0 },
    deliveryFee:     { type: Number, default: 0 },
    damruDiscount:   { type: Number, default: 0 },
    finalAmount:     { type: Number },
    total:           { type: Number, required: true },
    chargesSnapshot: { type: OrderChargesSnapshotSchema },
    eligibleRewardAmount: { type: Number, default: 0, min: 0 },
    paymentMethod:   { type: String, enum: ["cod", "razorpay", "upi", "card"], default: "cod" },
    paymentStatus:   { type: String, enum: ["pending", "paid", "failed", "refund_pending", "partially_refunded", "refunded"], default: "pending" },
    status:          { type: String, enum: ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"], default: "pending" },
    notes:           { type: String, default: "" },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    cancelledBy: { type: String, enum: ["customer", "admin", "system"] },
    cancelledAt: { type: Date },
    razorpayOrderId:    { type: String },
    razorpayPaymentId:  { type: String },
    paymentAmount:      { type: Number },
    paymentVerifiedAt:  { type: Date },
    paymentFailedAt:    { type: Date },
    paidAt:             { type: Date },
    refundedAmount:      { type: Number, default: 0 },
    pendingRefundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
// Reconciliation scheduler's query shape: stale, gateway-paid, still-pending orders.
OrderSchema.index({ paymentStatus: 1, paymentMethod: 1, createdAt: 1 });

// Force delete any cached (stale) model to ensure new schema is always used
if (mongoose.models.Order) { delete (mongoose.models as Record<string, unknown>).Order; }
const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
