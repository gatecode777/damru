import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { markRead } from "@/lib/notifications/notificationService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`notif-read:${sessionUser.id}`, RATE_LIMITS.notificationMarkRead);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const { id } = await params;
    // Ownership enforced inside markRead — always the AUTHENTICATED user, never a body/param userId.
    const updated = await markRead(sessionUser.id, id);
    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error("PATCH notifications/[id]/read error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
