import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Complaint from "@/models/Complaint";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await connectDB();
    await Complaint.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE complaint error:", err);
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}