import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import User from "@/models/User";

const DEFAULTS = { orderUpdates: true, rewardUpdates: true, promotionalPush: true, promotionalEmail: true, promotionalInApp: true };

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const user = await User.findById(sessionUser.id).select("notificationPreferences").lean<{ notificationPreferences?: typeof DEFAULTS }>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ preferences: { ...DEFAULTS, ...user.notificationPreferences } });
  } catch (err) {
    console.error("GET user/notification-preferences error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const update: Record<string, boolean> = {};
    // Only these five fields are ever writable — critical/security notifications
    // (PASSWORD_CHANGED etc.) are never gated by any preference (section 32).
    for (const key of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      if (typeof body[key] === "boolean") update[`notificationPreferences.${key}`] = body[key];
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "No valid preference fields provided." }, { status: 400 });

    await connectDB();
    const user = await User.findByIdAndUpdate(sessionUser.id, { $set: update }, { new: true }).select("notificationPreferences").lean<{
      notificationPreferences?: typeof DEFAULTS;
    }>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ success: true, preferences: { ...DEFAULTS, ...user.notificationPreferences } });
  } catch (err) {
    console.error("PATCH user/notification-preferences error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
