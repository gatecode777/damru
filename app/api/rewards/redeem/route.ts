import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { redeemDamru } from "@/lib/rewardEngine";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`redeem:${sessionUser.id}`, RATE_LIMITS.redeemDamru);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const { amount, orderId } = await req.json();
    if (!amount || amount <= 0) return NextResponse.json({ error: "Enter a valid Damru amount." }, { status: 400 });
    if (!orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

    const result = await redeemDamru(sessionUser.id, Number(amount), orderId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, discount: result.discount, newBalance: result.newBalance });
  } catch (err) {
    console.error("POST rewards/redeem error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
