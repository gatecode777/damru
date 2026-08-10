import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { markAllRead } from "@/lib/notifications/notificationService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export async function PATCH(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`notif-read-all:${sessionUser.id}`, RATE_LIMITS.notificationMarkRead);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const count = await markAllRead(sessionUser.id);
    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error("PATCH notifications/read-all error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
