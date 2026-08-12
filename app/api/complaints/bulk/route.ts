import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications/notificationService";
import Complaint from "@/models/Complaint";
import type { ComplaintStatus } from "@/models/Complaint";

function validIds(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 100
    && value.every((id) => typeof id === "string" && mongoose.isValidObjectId(id));
}

export async function PATCH(req: NextRequest) {
  const deny = await checkApiPerm("complaints", "edit");
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { ids?: unknown; status?: unknown };
  if (!validIds(body.ids)) {
    return NextResponse.json({ error: "Select between 1 and 100 valid complaints." }, { status: 400 });
  }
  const allowedStatuses: ComplaintStatus[] = ["in_progress", "resolved"];
  if (typeof body.status !== "string" || !allowedStatuses.includes(body.status as ComplaintStatus)) {
    return NextResponse.json({ error: "Invalid bulk complaint status." }, { status: 400 });
  }

  try {
    await connectDB();
    const uniqueIds = [...new Set(body.ids)];
    const rows = await Complaint.find({ _id: { $in: uniqueIds } }).select("_id").lean();
    const updatedIds = rows.map((row) => String(row._id));
    await Complaint.updateMany({ _id: { $in: updatedIds } }, { $set: { status: body.status } });
    return NextResponse.json({ success: true, updatedIds, updatedCount: updatedIds.length });
  } catch (error) {
    console.error("Bulk complaint status error:", error);
    return NextResponse.json({ error: "Failed to update selected complaints." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = await checkApiPerm("complaints", "delete");
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { ids?: unknown; reason?: unknown };
  if (!validIds(body.ids)) {
    return NextResponse.json({ error: "Select between 1 and 100 valid complaints." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5) {
    return NextResponse.json({ error: "Please provide a deletion reason of at least 5 characters." }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: "Deletion reason must be 500 characters or fewer." }, { status: 400 });
  }

  try {
    await connectDB();
    const uniqueIds = [...new Set(body.ids)];
    const rows = await Complaint.find({ _id: { $in: uniqueIds } }).select("_id userId subject").lean();
    const deletedIds = rows.map((row) => String(row._id));
    await Complaint.deleteMany({ _id: { $in: deletedIds } });

    const notificationResults = await Promise.allSettled(rows.map((complaint) => createNotification({
      userId: complaint.userId,
      category: "SYSTEM",
      type: "COMPLAINT_DELETED",
      title: "Complaint removed",
      message: `Your complaint "${complaint.subject}" was removed. Reason: ${reason}`,
      action: { label: "View support", route: "/my-profile" },
      data: { entityType: "complaint", entityId: String(complaint._id) },
      channels: ["IN_APP"],
      priority: "HIGH",
      dedupKey: `complaint:${complaint._id}:deleted`,
      sourceType: "Complaint",
      sourceId: String(complaint._id),
    })));
    if (notificationResults.some((result) => result.status === "rejected")) {
      console.error("One or more bulk complaint deletion notifications failed.");
    }

    return NextResponse.json({ success: true, deletedIds, deletedCount: deletedIds.length });
  } catch (error) {
    console.error("Bulk complaint deletion error:", error);
    return NextResponse.json({ error: "Failed to delete selected complaints." }, { status: 500 });
  }
}
