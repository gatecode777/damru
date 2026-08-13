import mongoose, { Schema, Document, Model } from "mongoose";

export type UserAchievementStatus = "IN_PROGRESS" | "COMPLETED" | "CLAIMED";

export interface IUserAchievement extends Document {
  userId: mongoose.Types.ObjectId;
  achievementId: mongoose.Types.ObjectId;
  progress: number;
  target: number;
  status: UserAchievementStatus;
  unlockedAt?: Date | null;
  rewardIssuedAt?: Date | null;
  rewardTransactionId?: mongoose.Types.ObjectId | null;
  /** Set to true when this achievement's reward is reversed because the
   *  underlying qualifying metric fell below the threshold (e.g. a refund
   *  reduces lifetime_spend). The record is NOT deleted — isRevoked allows
   *  the engine to re-award cleanly if the metric later recovers. */
  isRevoked: boolean;
  revokedAt?: Date | null;
  revokedTransactionId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", required: true },
    progress: { type: Number, default: 0, min: 0 },
    target: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["IN_PROGRESS", "COMPLETED", "CLAIMED"], default: "IN_PROGRESS" },
    unlockedAt: { type: Date, default: null },
    rewardIssuedAt: { type: Date, default: null },
    rewardTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
  },
  { timestamps: true }
);

UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, status: 1 });

const UserAchievement: Model<IUserAchievement> =
  mongoose.models.UserAchievement || mongoose.model<IUserAchievement>("UserAchievement", UserAchievementSchema);

export default UserAchievement;
