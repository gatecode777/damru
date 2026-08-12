import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICheckoutChargesAudit extends Document {
  action: string;
  actorId?: mongoose.Types.ObjectId;
  actorEmail: string;
  summary: string;
  changes: Record<string, unknown>;
  createdAt: Date;
}

const CheckoutChargesAuditSchema = new Schema<ICheckoutChargesAudit>({
  action: { type: String, required: true, trim: true },
  actorId: { type: Schema.Types.ObjectId, ref: "Admin" },
  actorEmail: { type: String, required: true, trim: true, lowercase: true },
  summary: { type: String, required: true, trim: true },
  changes: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

CheckoutChargesAuditSchema.index({ createdAt: -1 });

const CheckoutChargesAudit: Model<ICheckoutChargesAudit> =
  mongoose.models.CheckoutChargesAudit ||
  mongoose.model<ICheckoutChargesAudit>("CheckoutChargesAudit", CheckoutChargesAuditSchema);

export default CheckoutChargesAudit;
