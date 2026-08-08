import mongoose, { Schema, Document, Model } from "mongoose";

export type StreakCycleBehavior = "restart" | "continue" | "weekly_cycle";

export interface IDayReward {
  day: number;
  amount: number;
}

export interface IDailyStreakConfig extends Document {
  isActive: boolean;
  dayRewards: IDayReward[];
  cycleBehavior: StreakCycleBehavior;
  allowStreakRecovery: boolean;
  gracePeriodDays: number;
  updatedAt: Date;
}

const DayRewardSchema = new Schema<IDayReward>(
  {
    day: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const DailyStreakConfigSchema = new Schema<IDailyStreakConfig>(
  {
    isActive: { type: Boolean, default: true },
    dayRewards: {
      type: [DayRewardSchema],
      default: () => [
        { day: 1, amount: 10 },
        { day: 2, amount: 10 },
        { day: 3, amount: 15 },
        { day: 4, amount: 20 },
        { day: 5, amount: 25 },
        { day: 6, amount: 30 },
        { day: 7, amount: 100 },
      ],
    },
    cycleBehavior: { type: String, enum: ["restart", "continue", "weekly_cycle"], default: "restart" },
    allowStreakRecovery: { type: Boolean, default: false },
    gracePeriodDays: { type: Number, default: 0, min: 0, max: 1 },
  },
  { timestamps: true }
);

const DailyStreakConfig: Model<IDailyStreakConfig> =
  mongoose.models.DailyStreakConfig ||
  mongoose.model<IDailyStreakConfig>("DailyStreakConfig", DailyStreakConfigSchema);

export default DailyStreakConfig;
