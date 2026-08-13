import mongoose, { Schema, Document, Model } from "mongoose";

export type MissionType = "ORDER_COUNT" | "SPENDING_AMOUNT" | "LOGIN_STREAK" | "PROFILE_COMPLETE";
export type MissionPeriodType = "ONE_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" | "CAMPAIGN";

export interface IMissionEligibility {
  minAccountAgeDays?: number;
  minCompletedOrders?: number;
}

export interface IMission extends Document {
  name: string;
  code: string;
  description: string;
  missionType: MissionType;
  periodType: MissionPeriodType;
  targetValue: number;
  rewardDamruAmount: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  priority: number;
  isActive: boolean;
  /** When true, a completed+claimed reward for this mission may be reversed
   *  if the underlying qualifying event is later invalidated (e.g. a refund).
   *  Defaults true for ORDER_COUNT and SPENDING_AMOUNT mission types;
   *  defaults false for LOGIN_STREAK and PROFILE_COMPLETE. */
  isReversible: boolean;
  eligibility?: IMissionEligibility;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MissionEligibilitySchema = new Schema<IMissionEligibility>(
  {
    minAccountAgeDays: { type: Number, default: 0 },
    minCompletedOrders: { type: Number, default: 0 },
  },
  { _id: false }
);

const MissionSchema = new Schema<IMission>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    missionType: {
      type: String,
      enum: ["ORDER_COUNT", "SPENDING_AMOUNT", "LOGIN_STREAK", "PROFILE_COMPLETE"],
      required: true,
    },
    periodType: {
      type: String,
      enum: ["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "CAMPAIGN"],
      required: true,
    },
    targetValue: { type: Number, required: true, min: 1 },
    rewardDamruAmount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isReversible: { type: Boolean, default: true },
    eligibility: { type: MissionEligibilitySchema, default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

MissionSchema.index({ isActive: 1, missionType: 1 });

const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>("Mission", MissionSchema);

export default Mission;
