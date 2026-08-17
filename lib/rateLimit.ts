import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import RateLimit from "@/models/RateLimit";

/**
 * Central, minimal rate-limit primitive for high-risk endpoints only — not a
 * blanket per-route guard. Backed by a single TTL-indexed Mongo collection
 * (no Redis/Upstash in this stack). Fixed-window counting: the window
 * boundary is baked into the document key so `$inc` is naturally atomic
 * across concurrent requests, and expired windows self-clean via the TTL
 * index — no separate sweep job needed.
 */
export const RATE_LIMITS = {
  login:          { limit: 10, windowSeconds: 600 },  // per IP+email
  register:       { limit: 5,  windowSeconds: 3600 }, // per IP
  sendOtp:        { limit: 5,  windowSeconds: 600 },  // per IP+email
  verifyOtp:      { limit: 10, windowSeconds: 600 },  // per IP
  resetPassword:  { limit: 10, windowSeconds: 600 },  // per IP
  redeemDamru:    { limit: 10, windowSeconds: 600 },  // per user
  adminAdjust:    { limit: 30, windowSeconds: 600 },  // per admin
  couponValidate: { limit: 30, windowSeconds: 600 },  // per IP
  search:         { limit: 60, windowSeconds: 600 },  // per IP
  razorpayOrder:  { limit: 20, windowSeconds: 600 },  // per user — order creation/reuse
  razorpayVerify: { limit: 20, windowSeconds: 600 },  // per user
  adminRefund:    { limit: 20, windowSeconds: 600 },  // per admin
  paymentRecheck: { limit: 30, windowSeconds: 600 },  // per admin — manual "Recheck Payment"
  notificationMarkRead: { limit: 60, windowSeconds: 600 }, // per user — mark read / mark all read
  notificationDelete:   { limit: 30, windowSeconds: 600 }, // per user — delete one or many notifications
  adminSendCampaign:    { limit: 10, windowSeconds: 600 }, // per admin — high-blast-radius bulk send
} as const;

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  await connectDB();

  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const windowKey = `${key}:${windowStart}`;

  let count: number;
  try {
    const doc = await RateLimit.findOneAndUpdate(
      { key: windowKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true }
    ).lean();
    count = doc?.count ?? 1;
  } catch (err: unknown) {
    // Two requests raced the upsert for the same new window — the loser
    // hits a duplicate-key error; the document now exists, so just increment it.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      const doc = await RateLimit.findOneAndUpdate(
        { key: windowKey },
        { $inc: { count: 1 } },
        { new: true }
      ).lean();
      count = doc?.count ?? 1;
    } else {
      throw err;
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
  return { allowed: count <= limit, retryAfterSeconds };
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  const res = NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}
