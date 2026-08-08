import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One row per (mission, user, business-event) that has already moved mission
 * progress. Insert-first + unique key is the dedup gate — a repeated delivery
 * webhook or duplicate order event fails the unique insert and is skipped,
 * so increment-based mission progress (ORDER_COUNT, SPENDING_AMOUNT) can
 * never double-count the same event.
 */
export interface IMissionEvent extends Document {
  key: string;
  missionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MissionEventSchema = new Schema<IMissionEvent>(
  {
    key: { type: String, required: true, unique: true },
    missionId: { type: Schema.Types.ObjectId, ref: "Mission", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const MissionEvent: Model<IMissionEvent> =
  mongoose.models.MissionEvent || mongoose.model<IMissionEvent>("MissionEvent", MissionEventSchema);

export default MissionEvent;
