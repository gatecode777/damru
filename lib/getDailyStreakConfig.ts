import { connectDB } from "@/lib/mongodb";
import DailyStreakConfig, { IDailyStreakConfig, StreakCycleBehavior } from "@/models/DailyStreakConfig";

export type DailyStreakConfigValues = {
  isActive: boolean;
  dayRewards: { day: number; amount: number }[];
  cycleBehavior: StreakCycleBehavior;
  allowStreakRecovery: boolean;
  gracePeriodDays: number;
};

const DEFAULTS: DailyStreakConfigValues = {
  isActive: true,
  dayRewards: [
    { day: 1, amount: 10 },
    { day: 2, amount: 10 },
    { day: 3, amount: 15 },
    { day: 4, amount: 20 },
    { day: 5, amount: 25 },
    { day: 6, amount: 30 },
    { day: 7, amount: 100 },
  ],
  cycleBehavior: "restart",
  allowStreakRecovery: false,
  gracePeriodDays: 0,
};

export async function getDailyStreakConfig(): Promise<DailyStreakConfigValues> {
  await connectDB();
  const doc = await DailyStreakConfig.findOne().lean<IDailyStreakConfig>();
  if (!doc) return DEFAULTS;
  return {
    isActive: doc.isActive,
    dayRewards: doc.dayRewards.map(d => ({ day: d.day, amount: d.amount })).sort((a, b) => a.day - b.day),
    cycleBehavior: doc.cycleBehavior,
    allowStreakRecovery: doc.allowStreakRecovery,
    gracePeriodDays: doc.gracePeriodDays,
  };
}

export async function getOrCreateDailyStreakConfig() {
  await connectDB();
  let doc = await DailyStreakConfig.findOne();
  if (!doc) doc = await DailyStreakConfig.create({});
  return doc;
}
