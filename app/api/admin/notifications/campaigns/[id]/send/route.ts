import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import AdminUser from "@/models/Admin";
import { sendCampaignNow } from "@/lib/notifications/campaignService";

/** High-blast-radius action — requires explicit "send" permission distinct from "create" (section 56/57). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "edit");
  if (deny) return deny;

  try {
    const { id } = await params;
    await connectDB();
    const session = await auth();
    const adminEmail = (session?.user as { email?: string } | undefined)?.email;
    const admin = await AdminUser.findOne({ email: adminEmail }).select("_id").lean<{ _id: string }>();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const rl = await checkRateLimit(`admin-send-campaign:${admin._id}`, RATE_LIMITS.adminSendCampaign);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const result = await sendCampaignNow(id, admin._id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction("notification_campaign_sent", { targetType: "NotificationCampaign", targetId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST admin/notifications/campaigns/[id]/send error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
