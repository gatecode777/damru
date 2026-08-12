import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TaxCalculationType = "PERCENTAGE" | "FIXED";
export type TaxApplyOn = "MERCHANDISE_SUBTOTAL" | "AFTER_DISCOUNTS";
export type DeliveryMode = "FLAT" | "ORDER_VALUE" | "DISTANCE" | "BRANCH_BASED";

export interface IValueSlab {
  min: number;
  max: number | null;
  fee: number;
}

export interface IBranchDeliveryRule {
  branchId: mongoose.Types.ObjectId;
  fee: number;
  freeDeliveryThreshold: number | null;
}

export interface ICheckoutChargesConfig extends Document {
  tax: {
    enabled: boolean;
    name: string;
    code: string;
    calculationType: TaxCalculationType;
    rate: number;
    fixedAmount: number;
    applyOn: TaxApplyOn;
    taxDeliveryFee: boolean;
  };
  delivery: {
    enabled: boolean;
    mode: DeliveryMode;
    flatFee: number;
    freeDeliveryThreshold: number | null;
    minimumOrder: number;
    maximumDistanceKm: number | null;
    orderValueSlabs: IValueSlab[];
    distanceSlabs: IValueSlab[];
    branchRules: IBranchDeliveryRule[];
  };
  currency: "INR";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ValueSlabSchema = new Schema<IValueSlab>({
  min: { type: Number, required: true, min: 0 },
  max: { type: Number, default: null, min: 0 },
  fee: { type: Number, required: true, min: 0 },
}, { _id: false });

const BranchRuleSchema = new Schema<IBranchDeliveryRule>({
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  fee: { type: Number, required: true, min: 0 },
  freeDeliveryThreshold: { type: Number, default: null, min: 0 },
}, { _id: false });

const CheckoutChargesConfigSchema = new Schema<ICheckoutChargesConfig>({
  tax: {
    enabled: { type: Boolean, default: true },
    name: { type: String, default: "GST", trim: true, maxlength: 40 },
    code: { type: String, default: "GST", trim: true, uppercase: true, maxlength: 20 },
    calculationType: { type: String, enum: ["PERCENTAGE", "FIXED"], default: "PERCENTAGE" },
    rate: { type: Number, default: 5, min: 0, max: 100 },
    fixedAmount: { type: Number, default: 0, min: 0 },
    applyOn: { type: String, enum: ["MERCHANDISE_SUBTOTAL", "AFTER_DISCOUNTS"], default: "AFTER_DISCOUNTS" },
    taxDeliveryFee: { type: Boolean, default: false },
  },
  delivery: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, enum: ["FLAT", "ORDER_VALUE", "DISTANCE", "BRANCH_BASED"], default: "FLAT" },
    flatFee: { type: Number, default: 50, min: 0 },
    freeDeliveryThreshold: { type: Number, default: 500, min: 0 },
    minimumOrder: { type: Number, default: 0, min: 0 },
    maximumDistanceKm: { type: Number, default: 10, min: 0 },
    orderValueSlabs: { type: [ValueSlabSchema], default: [] },
    distanceSlabs: { type: [ValueSlabSchema], default: [] },
    branchRules: { type: [BranchRuleSchema], default: [] },
  },
  currency: { type: String, enum: ["INR"], default: "INR" },
  createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

const CheckoutChargesConfig: Model<ICheckoutChargesConfig> =
  mongoose.models.CheckoutChargesConfig ||
  mongoose.model<ICheckoutChargesConfig>("CheckoutChargesConfig", CheckoutChargesConfigSchema);

export default CheckoutChargesConfig;
