import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Reservation from "@/models/Reservation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();
  const valid = ["pending", "confirmed", "cancelled"];
  if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  try {
    await connectDB();
    const updated = await Reservation.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, reservation: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH reservation error:", err);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await connectDB();
    await Reservation.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE reservation error:", err);
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}