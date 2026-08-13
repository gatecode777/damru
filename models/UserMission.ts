import mongoose, { Schema, Document, Model } from "mongoose";

export type UserMissionStatus = "IN_PROGRESS" | "COMPLETED" | "CLAIMED" | "EXPIRED";

export interface IUserMission extends Document {
  userId: mongoose.Types.ObjectId;
  missionId: mongoose.Types.ObjectId;
  periodKey: string;
  progress: number;
  target: number;
  status: UserMissionStatus;
  startedAt: Date;
  completedAt?: Date | null;
  rewardIssuedAt?: Date | null;
  rewardTransactionId?: mongoose.Types.ObjectId | null;
  /** Set to true when the mission's reward is reversed because its ORDER_COUNT
   *  or SPENDING_AMOUNT progress dropped below target after a refund/cancellation.
   *  The record is preserved for audit; a later requalification re-awards with a
   *  new idempotency key. */
  isRevoked: boolean;
  revokedAt?: Date | null;
  revokedTransactionId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserMissionSchema = new Schema<IUserMission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    missionId: { type: Schema.Types.ObjectId, ref: "Mission", required: true },
    periodKey: { type: String, required: true },
    progress: { type: Number, default: 0, min: 0 },
    target: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["IN_PROGRESS", "COMPLETED", "CLAIMED", "EXPIRED"], default: "IN_PROGRESS" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    rewardIssuedAt: { type: Date, default: null },
    rewardTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
  },
  { timestamps: true }
);

UserMissionSchema.index({ userId: 1, missionId: 1, periodKey: 1 }, { unique: true });
UserMissionSchema.index({ userId: 1, status: 1 });

const UserMission: Model<IUserMission> =
  mongoose.models.UserMission || mongoose.model<IUserMission>("UserMission", UserMissionSchema);

export default UserMission;
