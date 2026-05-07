/**
 * Safe date formatting utilities that produce identical output
 * on both server (Node.js) and client (browser) by always
 * using explicit locale + timezone options.
 *
 * Never use new Date().toLocaleDateString() without explicit locale
 * in SSR components — the server locale (UTC/en-US) differs from
 * the user's browser locale, causing React hydration mismatches.
 */

/** "29 Apr 2026" */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch { return ""; }
}

/** "29 Apr 2026, 11:30 AM" */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  } catch { return ""; }
}

/** "April 29, 2026" */
export function fmtDateLong(d: string | Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch { return ""; }
}

/** "29 April 2026" — for reservation display */
export function fmtDateFull(d: string | Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch { return ""; }
}

/** Today's date as YYYY-MM-DD (for date input min attribute) */
export function todayISO(): string {
  // Use a fixed calculation to avoid server/client mismatch
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).toISOString().split("T")[0];
}

/** ₹1,23,456 — number formatting safe for SSR */
export function fmtINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}