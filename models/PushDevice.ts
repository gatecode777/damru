import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Device registration schema for future push delivery (PRD 4B v2 section 41).
 * No push provider is wired up yet — see docs/NOTIFICATION_SYSTEM.md's Push
 * section — this model exists so the mobile-ready structure is in place
 * without installing a push SDK/sending capability prematurely (section 26).
 */
export interface IPushDevice extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: "android" | "ios";
  deviceId?: string;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PushDeviceSchema = new Schema<IPushDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    deviceId: { type: String },
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

PushDeviceSchema.index({ userId: 1, isActive: 1 });

const PushDevice: Model<IPushDevice> =
  mongoose.models.PushDevice || mongoose.model<IPushDevice>("PushDevice", PushDeviceSchema);

export default PushDevice;
