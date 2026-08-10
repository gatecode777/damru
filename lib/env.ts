/**
 * Central secret/config accessor. A missing production secret must never
 * silently downgrade to a predictable fallback — call this lazily, at the
 * point of actual use (not at module import time), so a missing var fails
 * the specific request that needed it rather than the whole build.
 */

const isProduction = process.env.NODE_ENV === "production";
const warned = new Set<string>();

export function getRequiredSecret(name: string): string {
  const value = process.env[name];
  if (value) return value;

  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}. Configure it before serving requests.`);
  }

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[env] ${name} is not set — using an insecure development-only placeholder. Set ${name} in .env.local before deploying.`);
  }
  return `dev-only-insecure-${name.toLowerCase()}`;
}

/** Use a dedicated JWT secret when configured, otherwise the required auth secret. */
export function getJwtSecret(): string {
  return process.env.JWT_SECRET || getRequiredSecret("AUTH_SECRET");
}

// Vars required for every production deployment.
const REQUIRED_PRODUCTION_ENV = [
  "MONGODB_URI",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
];

// Razorpay vars are conditionally required: only once online payment is
// actually being turned on. If NONE of the three are set, the site is
// intentionally still COD-only and startup must not fail over it. If ANY
// one is set, all three become required — a half-configured gateway is
// worse than none (e.g. a key with no way to verify its webhooks).
const RAZORPAY_ENV = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];

/**
 * Central production startup check. Returns only the names of missing
 * variables — never values — so it's safe to log directly. Call once at
 * server startup (see instrumentation.ts); a no-op outside production.
 */
export function validateProductionEnv(): string[] {
  if (!isProduction) return [];
  const missing = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]);

  const razorpayEnabled = RAZORPAY_ENV.some((name) => process.env[name]);
  if (razorpayEnabled) {
    missing.push(...RAZORPAY_ENV.filter((name) => !process.env[name]));
  }

  return missing;
}
