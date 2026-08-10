import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { scheduleCampaign } from "@/lib/notifications/campaignService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "edit");
  if (deny) return deny;

  try {
    const { id } = await params;
    const { scheduledAt } = await req.json();
    if (!scheduledAt) return NextResponse.json({ error: "scheduledAt is required." }, { status: 400 });

    const result = await scheduleCampaign(id, new Date(scheduledAt));
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction("notification_campaign_scheduled", { targetType: "NotificationCampaign", targetId: id, details: { scheduledAt } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST admin/notifications/campaigns/[id]/schedule error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
