import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentRefundStatus = "pending" | "processed" | "failed";

/**
 * One document per refund attempt against a Razorpay-paid order. Deliberately
 * NOT reused for COD "refunds" (returning cash) — those have no gateway
 * counterpart and are out of this model's scope; see
 * docs/PAYMENT_RELIABILITY_REFUNDS.md.
 */
export interface IPaymentRefund extends Document {
  orderId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  gateway: "razorpay";
  gatewayPaymentId: string;
  gatewayRefundId?: string;
  amount: number;
  currency: string;
  status: PaymentRefundStatus;
  reason: string;
  note?: string;
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  refundRequestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRefundSchema = new Schema<IPaymentRefund>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    gateway: { type: String, enum: ["razorpay"], required: true, default: "razorpay" },
    gatewayPaymentId: { type: String, required: true },
    gatewayRefundId: { type: String },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    status: { type: String, enum: ["pending", "processed", "failed"], required: true, default: "pending" },
    reason: { type: String, required: true },
    note: { type: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    failedAt: { type: Date },
    // Client-generated per-attempt id (mirrors adjustDamru's requestId pattern)
    // — the idempotency boundary for "same click retried" vs "a genuinely new
    // refund request".
    refundRequestId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

PaymentRefundSchema.index({ orderId: 1, createdAt: -1 });
PaymentRefundSchema.index({ gatewayRefundId: 1 });

const PaymentRefund: Model<IPaymentRefund> =
  mongoose.models.PaymentRefund || mongoose.model<IPaymentRefund>("PaymentRefund", PaymentRefundSchema);

export default PaymentRefund;
