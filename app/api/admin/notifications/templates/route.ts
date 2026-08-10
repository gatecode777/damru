import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import AdminUser from "@/models/Admin";
import NotificationTemplate from "@/models/NotificationTemplate";
import { extractTemplateVariables, ALLOWED_VARIABLES } from "@/lib/notifications/templateRenderer";

export async function GET() {
  const deny = await checkApiPerm("notifications", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const templates = await NotificationTemplate.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ templates: JSON.parse(JSON.stringify(templates)) });
  } catch (err) {
    console.error("GET admin/notifications/templates error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("notifications", "create");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { name, code, category, titleTemplate, messageTemplate, emailSubjectTemplate, emailBodyTemplate, imageUrl, defaultAction, supportedChannels } = body;

    if (!name?.trim() || !code?.trim()) return NextResponse.json({ error: "Name and code are required." }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    if (!titleTemplate?.trim() || !messageTemplate?.trim()) return NextResponse.json({ error: "Title and message templates are required." }, { status: 400 });

    // Reject unknown variables at save time (section 12) — never let a
    // broken template reach a campaign send where it would silently omit content.
    const referenced = [...extractTemplateVariables(titleTemplate), ...extractTemplateVariables(messageTemplate)];
    const unknown = referenced.filter(v => !ALLOWED_VARIABLES.has(v));
    if (unknown.length > 0) return NextResponse.json({ error: `Unsupported template variable(s): ${unknown.join(", ")}` }, { status: 400 });

    await connectDB();
    const session = await auth();
    const adminEmail = (session?.user as { email?: string } | undefined)?.email;
    const admin = await AdminUser.findOne({ email: adminEmail }).select("_id").lean<{ _id: string }>();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const template = await NotificationTemplate.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      type: "PROMOTIONAL_CAMPAIGN",
      titleTemplate,
      messageTemplate,
      emailSubjectTemplate,
      emailBodyTemplate,
      imageUrl,
      defaultAction,
      supportedChannels: supportedChannels?.length ? supportedChannels : ["IN_APP"],
      variables: [...new Set(referenced)],
      createdBy: admin._id,
    });

    await logAdminAction("notification_template_created", { targetType: "NotificationTemplate", targetId: String(template._id), details: { code: template.code } });

    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return NextResponse.json({ error: "A template with this code already exists." }, { status: 409 });
    }
    console.error("POST admin/notifications/templates error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
