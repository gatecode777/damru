import { toDateStr } from "@/lib/dailyStreak";

export type MissionPeriodType = "ONE_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" | "CAMPAIGN";

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

/** Server-authoritative period key for a mission at a point in time (UTC day boundaries, same policy as Daily Streak). */
export function getPeriodKey(periodType: MissionPeriodType, missionId: string, date: Date): string {
  switch (periodType) {
    case "ONE_TIME": return "ONE_TIME";
    case "CAMPAIGN": return `campaign:${missionId}`;
    case "DAILY": return toDateStr(date);
    case "WEEKLY": return isoWeekKey(date);
    case "MONTHLY": return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}

/** End-of-period boundary for a recurring period key, or null when governed by the mission's own startsAt/endsAt window instead. */
export function getPeriodEnd(periodType: MissionPeriodType, periodKey: string): Date | null {
  if (periodType === "ONE_TIME" || periodType === "CAMPAIGN") return null;

  if (periodType === "DAILY") return new Date(`${periodKey}T23:59:59.999Z`);

  if (periodType === "MONTHLY") {
    const [y, m] = periodKey.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  }

  if (periodType === "WEEKLY") {
    const [y, wStr] = periodKey.split("-W");
    const monday = isoWeekMonday(Number(y), Number(wStr));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return sunday;
  }

  return null;
}
