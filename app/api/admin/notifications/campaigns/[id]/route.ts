import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import NotificationCampaign from "@/models/NotificationCampaign";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "view");
  if (deny) return deny;

  try {
    const { id } = await params;
    await connectDB();
    const campaign = await NotificationCampaign.findById(id).lean();
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ campaign: JSON.parse(JSON.stringify(campaign)) });
  } catch (err) {
    console.error("GET admin/notifications/campaigns/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

/** Only a DRAFT campaign's content may be edited — a scheduled/sent one is immutable (section 49). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "edit");
  if (deny) return deny;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, title, message, imageUrl, action, channels } = body;

    await connectDB();
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (title !== undefined) update.title = title;
    if (message !== undefined) update.message = message;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (action !== undefined) update.action = action;
    if (channels !== undefined) update.channels = channels;

    const campaign = await NotificationCampaign.findOneAndUpdate({ _id: id, status: "DRAFT" }, { $set: update }, { new: true });
    if (!campaign) return NextResponse.json({ error: "Only a draft campaign can be edited." }, { status: 400 });

    await logAdminAction("notification_campaign_updated", { targetType: "NotificationCampaign", targetId: id });

    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error("PUT admin/notifications/campaigns/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
