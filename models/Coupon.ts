import mongoose, { Schema, Document, Model } from "mongoose";

export type CouponType = "flat" | "percentage";

export interface ICoupon extends Document {
  code:          string;
  description:   string;
  type:          CouponType;
  value:         number;
  maxDiscount:   number | null;
  minOrderValue: number;
  usageLimit:    number | null;
  usedCount:     number;
  perUserLimit:  number;
  startDate:     Date;
  expiryDate:    Date | null;
  isActive:      boolean;
  usedBy:        mongoose.Types.ObjectId[];
  userId?:       mongoose.Types.ObjectId; // set = private coupon owned by one user (e.g. occasion rewards)
  createdAt:     Date;
  updatedAt:     Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
    description:   { type: String, trim: true, default: "" },
    type:          { type: String, enum: ["flat", "percentage"], required: true },
    value:         { type: Number, required: true, min: 0 },
    maxDiscount:   { type: Number, default: null },
    minOrderValue: { type: Number, default: 0 },
    usageLimit:    { type: Number, default: null },
    usedCount:     { type: Number, default: 0 },
    perUserLimit:  { type: Number, default: 1 },
    startDate:     { type: Date, default: Date.now },
    expiryDate:    { type: Date, default: null },
    isActive:      { type: Boolean, default: true },
    usedBy:        [{ type: Schema.Types.ObjectId, ref: "User" }],
    userId:        { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: is the coupon currently valid?
CouponSchema.virtual("isValid").get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.expiryDate && now > this.expiryDate) return false;
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;
  return true;
});

CouponSchema.index({ isActive: 1 });
CouponSchema.index({ expiryDate: 1 });

const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema);

export default Coupon;