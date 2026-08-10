import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { getUnreadCount } from "@/lib/notifications/notificationService";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const count = await getUnreadCount(sessionUser.id);
    return NextResponse.json({ count });
  } catch (err) {
    console.error("GET notifications/unread-count error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
