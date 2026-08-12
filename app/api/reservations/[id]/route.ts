import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import Reservation from "@/models/Reservation";
import mongoose from "mongoose";
import { updateReservationStatus } from "@/lib/reservations/updateReservationStatus";
import { createNotification } from "@/lib/notifications/notificationService";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("reservations", "edit");
  if (deny) return deny;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid reservation." }, { status: 400 });
  const { status, declineReason = "" } = await req.json();
  const valid = ["pending", "confirmed", "cancelled"];
  if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  if (status === "cancelled" && (typeof declineReason !== "string" || declineReason.trim().length < 5)) {
    return NextResponse.json({ error: "Please provide a decline reason of at least 5 characters." }, { status: 400 });
  }
  if (typeof declineReason === "string" && declineReason.trim().length > 500) {
    return NextResponse.json({ error: "Decline reason must be 500 characters or fewer." }, { status: 400 });
  }

  try {
    await connectDB();
    const updated = await updateReservationStatus({ id, status, declineReason });
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, reservation: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH reservation error:", err);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("reservations", "delete");
  if (deny) return deny;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid reservation." }, { status: 400 });
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
    const deleted = await Reservation.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    try {
      await createNotification({
        userId: deleted.userId,
        category: "SYSTEM",
        type: "RESERVATION_DELETED",
        title: "Reservation removed",
        message: `Your reservation request was removed. Reason: ${reason}`,
        action: { label: "View reservations", route: "/my-profile" },
        data: { entityType: "reservation", entityId: String(deleted._id) },
        channels: ["IN_APP"],
        priority: "HIGH",
        dedupKey: `reservation:${deleted._id}:deleted`,
        sourceType: "Reservation",
        sourceId: String(deleted._id),
      });
    } catch (notificationError) {
      console.error("Reservation deletion notification error:", notificationError);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE reservation error:", err);
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}
