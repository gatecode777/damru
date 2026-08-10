import mongoose, { Schema, Document, Model } from "mongoose";

export type LoyaltyLevel = "bronze" | "silver" | "gold" | "platinum";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  status: "active" | "inactive" | "suspended";
  totalSpend: number;
  avatar?: string;
  loginTokens?: string[]; // For session management (optional)
  damruBalance: number;
  damruTotalEarned: number;
  damruTotalRedeemed: number;
  loyaltyLevel: LoyaltyLevel;
  loyaltyTierId?: mongoose.Types.ObjectId;
  loyaltyTierCode?: string;
  loyaltyTierUpdatedAt?: Date;
  dateOfBirth?: Date;
  dobLocked: boolean;
  marriageAnniversary?: Date;
  anniversaryLocked: boolean;
  currentStreak: number;
  longestStreak: number;
  lastEligibleActivityDate: string | null;
  lastStreakRewardDate: string | null;
  referralCode?: string;
  notificationPreferences?: {
    orderUpdates: boolean;
    rewardUpdates: boolean;
    promotionalPush: boolean;
    promotionalEmail: boolean;
    promotionalInApp: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    totalSpend: { type: Number, default: 0 },
    avatar: { type: String },
    loginTokens: { type: [String] },
    damruBalance: { type: Number, default: 0 },
    damruTotalEarned: { type: Number, default: 0 },
    damruTotalRedeemed: { type: Number, default: 0 },
    loyaltyLevel: { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
    loyaltyTierId: { type: Schema.Types.ObjectId, ref: "LoyaltyTier", index: true },
    loyaltyTierCode: { type: String },
    loyaltyTierUpdatedAt: { type: Date },
    dateOfBirth: { type: Date },
    dobLocked: { type: Boolean, default: false },
    marriageAnniversary: { type: Date },
    anniversaryLocked: { type: Boolean, default: false },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastEligibleActivityDate: { type: String, default: null },
    lastStreakRewardDate: { type: String, default: null },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    notificationPreferences: {
      type: {
        orderUpdates: { type: Boolean, default: true },
        rewardUpdates: { type: Boolean, default: true },
        promotionalPush: { type: Boolean, default: true },
        promotionalEmail: { type: Boolean, default: true },
        promotionalInApp: { type: Boolean, default: true },
      },
      _id: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
