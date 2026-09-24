import type { DamruConfigValues } from "@/lib/getDamruConfig";
import { validateExpiryConfig } from "@/lib/rewards/damruAllocation";
import { isValidPaisePerDamru } from "@/lib/rewards/damruValue";

const isWhole = (v: unknown, min: number) => typeof v === "number" && Number.isInteger(v) && v >= min;

/** Validates the fields present in `body` against the effective post-update config. Pure. */
export function validateDamruConfigUpdate(body: Record<string, unknown>, current: DamruConfigValues): { next?: DamruConfigValues; error?: string } {
  const next: DamruConfigValues = JSON.parse(JSON.stringify(current));

  if (body.paisePerDamru !== undefined) {
    if (!isValidPaisePerDamru(body.paisePerDamru)) return { error: "Damru value must be a whole number of paise per Damru (1 – 10,000)." };
    next.paisePerDamru = body.paisePerDamru;
  }
  if (body.orderEarn !== undefined) {
    const oe = (body.orderEarn ?? {}) as Record<string, unknown>;
    if (oe.rupeesPerDamru !== undefined) {
      if (!isWhole(oe.rupeesPerDamru, 1) || (oe.rupeesPerDamru as number) > 100_000) return { error: "Order earning must be a whole rupee amount of at least ₹1 per Damru." };
      next.orderEarn.rupeesPerDamru = oe.rupeesPerDamru as number;
    }
    if (oe.enabled !== undefined) {
      if (typeof oe.enabled !== "boolean") return { error: "Order earning on/off must be true or false." };
      next.orderEarn.enabled = oe.enabled;
    }
    if (oe.dishRewardBaseBehavior !== undefined) {
      if (oe.dishRewardBaseBehavior !== "ADD" && oe.dishRewardBaseBehavior !== "REPLACE") return { error: "Choose whether dish rewards add to or replace the base order reward." };
      next.orderEarn.dishRewardBaseBehavior = oe.dishRewardBaseBehavior;
    }
  }
  if (body.minRedemption !== undefined) {
    if (!isWhole(body.minRedemption, 0)) return { error: "Minimum redemption must be a whole number of Damru." };
    next.minRedemption = body.minRedemption as number;
  }
  if (body.maxRedemptionPerOrder !== undefined) {
    if (!isWhole(body.maxRedemptionPerOrder, 1)) return { error: "Maximum redemption per order must be a whole number of at least 1." };
    next.maxRedemptionPerOrder = body.maxRedemptionPerOrder as number;
  }
  if (next.minRedemption > next.maxRedemptionPerOrder) return { error: "Minimum redemption cannot exceed maximum redemption." };
  if (body.dailyEarnLimit !== undefined) {
    if (body.dailyEarnLimit !== null && !isWhole(body.dailyEarnLimit, 1)) return { error: "Daily earn limit must be a whole number of at least 1, or empty for no limit." };
    next.dailyEarnLimit = body.dailyEarnLimit as number | null;
  }
  if (body.expiryEnabled !== undefined) next.expiryEnabled = Boolean(body.expiryEnabled);
  if (body.expiryDays !== undefined) next.expiryDays = body.expiryDays as number | null;
  if (body.expiryWarningDays !== undefined) next.expiryWarningDays = body.expiryWarningDays as number;
  const expiryError = validateExpiryConfig({ expiryEnabled: next.expiryEnabled, expiryDays: next.expiryDays, expiryWarningDays: next.expiryWarningDays });
  if (expiryError) return { error: expiryError };
  if (body.loyaltyThresholds !== undefined) {
    const lt = (body.loyaltyThresholds ?? {}) as Record<string, unknown>;
    for (const key of ["silver", "gold", "platinum"] as const) {
      if (lt[key] === undefined) continue;
      if (!isWhole(lt[key], 0)) return { error: `The ${key} threshold must be a whole number.` };
      next.loyaltyThresholds[key] = lt[key] as number;
    }
  }
  return { next };
}

