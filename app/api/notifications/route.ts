import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { listNotifications } from "@/lib/notifications/notificationService";
import type { NotificationCategory } from "@/models/Notification";

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "REWARDS", "ORDERS", "PAYMENTS", "REFUNDS", "COUPONS", "ACCOUNT", "SECURITY", "PROMOTIONS", "CAMPAIGNS", "SYSTEM", "DELIVERY",
]);

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
    const categoryParam = searchParams.get("category");
    const category = categoryParam && VALID_CATEGORIES.has(categoryParam) ? (categoryParam as NotificationCategory) : undefined;

    const result = await listNotifications(sessionUser.id, page, limit, { category });
    return NextResponse.json({ ...result, notifications: JSON.parse(JSON.stringify(result.notifications)) });
  } catch (err) {
    console.error("GET notifications error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
