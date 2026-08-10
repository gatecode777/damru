import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { cancelCampaign } from "@/lib/notifications/campaignService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "edit");
  if (deny) return deny;

  try {
    const { id } = await params;
    const result = await cancelCampaign(id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction("notification_campaign_cancelled", { targetType: "NotificationCampaign", targetId: id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST admin/notifications/campaigns/[id]/cancel error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
