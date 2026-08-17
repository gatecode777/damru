import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { deleteNotifications } from "@/lib/notifications/notificationService";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

function validIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every((id) => typeof id === "string");
}

export async function DELETE(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`notif-delete:${sessionUser.id}`, RATE_LIMITS.notificationDelete);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => ({})) as { ids?: unknown };
  if (!validIds(body.ids)) {
    return NextResponse.json({ error: "Select between 1 and 50 valid notifications." }, { status: 400 });
  }

  try {
    // Ownership enforced inside deleteNotifications — always the AUTHENTICATED user, never a body userId.
    const deletedCount = await deleteNotifications(sessionUser.id, [...new Set(body.ids)]);
    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    console.error("DELETE notifications/bulk-delete error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
