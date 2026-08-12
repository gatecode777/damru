export const REWARD_ISSUE_CATEGORIES = [
  "welcome_registration", "birthday", "marriage_anniversary", "account_anniversary",
  "first_order", "daily_login", "achievement", "mission", "referral", "order_reward",
  "loyalty_tier", "admin_credit",
  "campaign",
] as const;

export const REWARD_SOURCE_LABELS: Record<string, string> = {
  welcome_registration: "Welcome", birthday: "Birthday", marriage_anniversary: "Anniversary",
  account_anniversary: "Account anniversary", first_order: "First order", daily_login: "Daily streak",
  achievement: "Achievements", mission: "Missions", referral: "Referrals", order_reward: "Orders",
  loyalty_tier: "Loyalty tier", admin_credit: "Admin credit", refund_restore: "Refund restoration",
  redemption: "Redemption", expiry: "Expiry",
  campaign: "Campaign bonuses",
  reward_reversal: "Reward reversals", reward_debt_recovery: "Reward debt recovery",
};

export type AnalyticsPreset = "today" | "7d" | "30d" | "this_month" | "3m" | "6m" | "this_year" | "custom";

const INDIA_OFFSET_MS = 330 * 60 * 1000;
const indiaParts = (date: Date) => new Date(date.getTime() + INDIA_OFFSET_MS);
const toUtcFromIndia = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) =>
  new Date(Date.UTC(year, month, day, hour, minute, second, ms) - INDIA_OFFSET_MS);

export function resolveAnalyticsRange(input: { preset?: string; start?: string | null; end?: string | null }, now = new Date()) {
  const valid: AnalyticsPreset[] = ["today", "7d", "30d", "this_month", "3m", "6m", "this_year", "custom"];
  const preset = valid.includes(input.preset as AnalyticsPreset) ? input.preset as AnalyticsPreset : "30d";
  const localNow = indiaParts(now);
  const y = localNow.getUTCFullYear(), m = localNow.getUTCMonth(), d = localNow.getUTCDate();
  let start: Date;
  let end = now;

  if (preset === "custom" && input.start && input.end) {
    const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.start);
    const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.end);
    if (!startMatch || !endMatch) throw new Error("Custom dates must use YYYY-MM-DD.");
    start = toUtcFromIndia(+startMatch[1], +startMatch[2] - 1, +startMatch[3]);
    end = toUtcFromIndia(+endMatch[1], +endMatch[2] - 1, +endMatch[3], 23, 59, 59, 999);
  } else if (preset === "today") start = toUtcFromIndia(y, m, d);
  else if (preset === "this_month") start = toUtcFromIndia(y, m, 1);
  else if (preset === "this_year") start = toUtcFromIndia(y, 0, 1);
  else {
    const days = preset === "7d" ? 7 : preset === "3m" ? 90 : preset === "6m" ? 180 : 30;
    start = toUtcFromIndia(y, m, d - days + 1);
  }
  if (start > end) throw new Error("Start date must be before end date.");
  const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return { preset, start, end, groupBy: spanDays > 120 ? "month" as const : spanDays > 45 ? "week" as const : "day" as const };
}

export function calculateLiability(outstandingDamru: number, rupeesPerDamru: number) {
  return Math.max(0, outstandingDamru) * Math.max(0, rupeesPerDamru);
}

export function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function maskEmail(email?: string | null) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, Math.min(name.length - 2, 5)))}@${domain}`;
}
