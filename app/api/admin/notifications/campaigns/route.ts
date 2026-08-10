import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import AdminUser from "@/models/Admin";
import NotificationCampaign from "@/models/NotificationCampaign";
import { createCampaign } from "@/lib/notifications/campaignService";

export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("notifications", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationCampaign.countDocuments(query),
    ]);

    return NextResponse.json({ campaigns: JSON.parse(JSON.stringify(campaigns)), page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET admin/notifications/campaigns error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("notifications", "create");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { name, templateId, audience, channels, title, message, imageUrl, action, scheduledAt } = body;

    await connectDB();
    const session = await auth();
    const adminEmail = (session?.user as { email?: string } | undefined)?.email;
    const admin = await AdminUser.findOne({ email: adminEmail }).select("_id").lean<{ _id: string }>();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const result = await createCampaign({
      name, templateId, audience, channels, title, message, imageUrl, action,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: admin._id,
    });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction("notification_campaign_created", {
      targetType: "NotificationCampaign",
      targetId: String(result.campaign!._id),
      details: { audience: audience.segment, estimatedRecipients: result.campaign!.estimatedRecipients },
    });

    return NextResponse.json({ success: true, campaign: result.campaign });
  } catch (err) {
    console.error("POST admin/notifications/campaigns error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
