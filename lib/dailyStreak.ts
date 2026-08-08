export interface DayReward { day: number; amount: number }
export type StreakCycleBehavior = "restart" | "continue" | "weekly_cycle";

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Given the user's stored streak state, determine what streak count applies for "today". */
export function projectNextStreak(
  currentStreak: number,
  lastEligibleActivityDate: string | null,
  today: Date,
  recovery: { allowStreakRecovery: boolean; gracePeriodDays: number }
): { newStreak: number; alreadyClaimedToday: boolean } {
  const todayStr = toDateStr(today);
  if (lastEligibleActivityDate === todayStr) {
    return { newStreak: currentStreak, alreadyClaimedToday: true };
  }

  const yesterdayStr = toDateStr(addDays(today, -1));
  if (lastEligibleActivityDate === yesterdayStr) {
    return { newStreak: currentStreak + 1, alreadyClaimedToday: false };
  }

  if (recovery.allowStreakRecovery && recovery.gracePeriodDays >= 1) {
    const dayBeforeStr = toDateStr(addDays(today, -2));
    if (lastEligibleActivityDate === dayBeforeStr) {
      return { newStreak: currentStreak + 1, alreadyClaimedToday: false };
    }
  }

  return { newStreak: 1, alreadyClaimedToday: false };
}

/** Map a streak count to its reward-cycle day, applying the configured cycle behaviour. */
export function rewardDayForStreak(
  streak: number,
  dayRewards: DayReward[],
  cycleBehavior: StreakCycleBehavior
): { rewardDay: number; storedStreak: number } {
  const cycleLen = dayRewards.length;
  if (cycleLen === 0) return { rewardDay: 0, storedStreak: streak };

  if (cycleBehavior === "restart" && streak > cycleLen) {
    return { rewardDay: 1, storedStreak: 1 };
  }
  if (cycleBehavior === "weekly_cycle") {
    return { rewardDay: ((streak - 1) % cycleLen) + 1, storedStreak: streak };
  }
  // "continue" — streak keeps counting, reward caps at the last configured day.
  return { rewardDay: Math.min(streak, cycleLen), storedStreak: streak };
}

export function amountForDay(dayRewards: DayReward[], day: number): number {
  return dayRewards.find(d => d.day === day)?.amount ?? 0;
}
