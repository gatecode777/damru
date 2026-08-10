import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import AdminUser from "@/models/Admin";
import NotificationTemplate from "@/models/NotificationTemplate";
import { extractTemplateVariables, ALLOWED_VARIABLES } from "@/lib/notifications/templateRenderer";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("notifications", "edit");
  if (deny) return deny;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, category, titleTemplate, messageTemplate, emailSubjectTemplate, emailBodyTemplate, imageUrl, defaultAction, supportedChannels, isActive } = body;

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (category !== undefined) update.category = category;
    if (emailSubjectTemplate !== undefined) update.emailSubjectTemplate = emailSubjectTemplate;
    if (emailBodyTemplate !== undefined) update.emailBodyTemplate = emailBodyTemplate;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (defaultAction !== undefined) update.defaultAction = defaultAction;
    if (supportedChannels !== undefined) update.supportedChannels = supportedChannels;
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    if (titleTemplate !== undefined || messageTemplate !== undefined) {
      const existing = await NotificationTemplate.findById(id).select("titleTemplate messageTemplate").lean<{ titleTemplate: string; messageTemplate: string }>();
      if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
      const nextTitle = titleTemplate ?? existing.titleTemplate;
      const nextMessage = messageTemplate ?? existing.messageTemplate;
      const referenced = [...extractTemplateVariables(nextTitle), ...extractTemplateVariables(nextMessage)];
      const unknown = referenced.filter(v => !ALLOWED_VARIABLES.has(v));
      if (unknown.length > 0) return NextResponse.json({ error: `Unsupported template variable(s): ${unknown.join(", ")}` }, { status: 400 });
      update.titleTemplate = nextTitle;
      update.messageTemplate = nextMessage;
      update.variables = [...new Set(referenced)];
    }

    await connectDB();
    const session = await auth();
    const adminEmail = (session?.user as { email?: string } | undefined)?.email;
    const admin = await AdminUser.findOne({ email: adminEmail }).select("_id").lean<{ _id: string }>();
    if (admin) update.updatedBy = admin._id;

    const template = await NotificationTemplate.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    await logAdminAction("notification_template_updated", { targetType: "NotificationTemplate", targetId: id });

    return NextResponse.json({ success: true, template });
  } catch (err) {
    console.error("PUT admin/notifications/templates/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
