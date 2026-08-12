import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import Complaint from "@/models/Complaint";
import mongoose from "mongoose";
import { createNotification } from "@/lib/notifications/notificationService";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("complaints", "edit");
  if (deny) return deny;

  const { id } = await params;
  const { status, adminNote } = await req.json();

  const valid = ["open", "in_progress", "resolved", "closed"];
  if (status && !valid.includes(status))
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  try {
    await connectDB();
    const updates: Record<string, string> = {};
    if (status)    updates.status    = status;
    if (adminNote !== undefined) updates.adminNote = adminNote;

    const updated = await Complaint.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, complaint: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH complaint error:", err);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("complaints", "delete");
  if (deny) return deny;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid complaint." }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5) {
    return NextResponse.json({ error: "Please provide a deletion reason of at least 5 characters." }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: "Deletion reason must be 500 characters or fewer." }, { status: 400 });
  }
  try {
    await connectDB();
    const deleted = await Complaint.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    try {
      await createNotification({
        userId: deleted.userId,
        category: "SYSTEM",
        type: "COMPLAINT_DELETED",
        title: "Complaint removed",
        message: `Your complaint "${deleted.subject}" was removed. Reason: ${reason}`,
        action: { label: "View support", route: "/my-profile" },
        data: { entityType: "complaint", entityId: String(deleted._id) },
        channels: ["IN_APP"],
        priority: "HIGH",
        dedupKey: `complaint:${deleted._id}:deleted`,
        sourceType: "Complaint",
        sourceId: String(deleted._id),
      });
    } catch (notificationError) {
      console.error("Complaint deletion notification error:", notificationError);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE complaint error:", err);
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}
