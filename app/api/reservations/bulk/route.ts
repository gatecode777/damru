import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import { updateReservationStatus } from "@/lib/reservations/updateReservationStatus";
import type { ReservationStatus } from "@/models/Reservation";

export async function PATCH(req: NextRequest) {
  const deny = await checkApiPerm("reservations", "edit");
  if (deny) return deny;

  const { ids, status, declineReason = "" } = await req.json();
  const validStatuses: ReservationStatus[] = ["pending", "confirmed", "cancelled"];

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => !mongoose.isValidObjectId(id))) {
    return NextResponse.json({ error: "Select between 1 and 100 valid reservations." }, { status: 400 });
  }
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (status === "cancelled" && (typeof declineReason !== "string" || declineReason.trim().length < 5)) {
    return NextResponse.json({ error: "Please provide a decline reason of at least 5 characters." }, { status: 400 });
  }
  if (typeof declineReason === "string" && declineReason.trim().length > 500) {
    return NextResponse.json({ error: "Decline reason must be 500 characters or fewer." }, { status: 400 });
  }

  try {
    await connectDB();
    const uniqueIds = [...new Set(ids as string[])];
    const results = await Promise.all(
      uniqueIds.map((id) => updateReservationStatus({ id, status, declineReason }))
    );
    const updatedIds = results.filter(Boolean).map((reservation) => String(reservation!._id));
    return NextResponse.json({ success: true, updatedIds, updatedCount: updatedIds.length });
  } catch (error) {
    console.error("Bulk reservation update error:", error);
    return NextResponse.json({ error: "Failed to update selected reservations." }, { status: 500 });
  }
}
