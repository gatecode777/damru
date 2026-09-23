/**
 * lib/rewards/damruValue.ts — the ONLY place Damru is converted to or from
 * money. Pure and integer-only: Damru are whole numbers and money is integer
 * paise. Callers pass the rate they read from DamruConfig (getDamruConfig());
 * nothing in here knows a default rate, so there is no second source of truth.
 */

/** A valid Damru amount: a finite, non-negative whole number. */
export function isWholeDamru(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** A valid configured rate: a positive whole number of paise per Damru. */
export function isValidPaisePerDamru(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10_000;
}

/** Parses a client-supplied Damru amount. Returns null for anything that is not a whole number ≥ 0. */
export function parseWholeDamru(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return isWholeDamru(n) ? n : null;
}

/** Value of `damru` in paise at `paisePerDamru`. */
export function damruToPaise(damru: number, paisePerDamru: number): number {
  return damru * paisePerDamru;
}

/** The most Damru whose value fits inside `paise` (never exceeds it). */
export function maxDamruForPaise(paise: number, paisePerDamru: number): number {
  if (paise <= 0) return 0;
  return Math.floor(paise / paisePerDamru);
}

/** "Damru per ₹1" for display (may be fractional when the rate does not divide ₹1). */
export function damruPerRupee(paisePerDamru: number): number {
  return 100 / paisePerDamru;
}

/** Historical value snapshot stored on every ledger row so later rate changes never re-value history. */
export function valueSnapshot(amount: number, paisePerDamru: number): { paisePerDamru: number; valuePaise: number } {
  return { paisePerDamru, valuePaise: damruToPaise(amount, paisePerDamru) };
}

/** Base order earning: one Damru per `rupeesPerDamru` rupees of eligible spend, floored. */
export function baseEarnDamru(eligiblePaise: number, rupeesPerDamru: number): number {
  if (eligiblePaise <= 0 || !Number.isInteger(rupeesPerDamru) || rupeesPerDamru < 1) return 0;
  return Math.floor(eligiblePaise / (rupeesPerDamru * 100));
}
