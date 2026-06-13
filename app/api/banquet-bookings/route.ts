import { checkApiPerm } from "@/lib/checkApiPerm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import BanquetBooking from "@/models/BanquetBooking";

// POST — public, no login required
export async function POST(req: NextRequest) {
  try {
    const { fullName, phone, email, branchSlug, branchName, eventType, eventDate, guestCount, message } = await req.json();
    if (!fullName?.trim() || !phone?.trim() || !email?.trim())
      return NextResponse.json({ error: "Name, phone and email are required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (!/^[6-9]\d{9}$/.test(phone.trim()))
      return NextResponse.json({ error: "Please enter a valid 10-digit phone number." }, { status: 400 });

    await connectDB();
    const booking = await BanquetBooking.create({
      fullName: fullName.trim(), phone: phone.trim(),
      email: email.trim().toLowerCase(),
      branchSlug: branchSlug || "", branchName: branchName || "",
      eventType: eventType || "", eventDate: eventDate || "",
      guestCount: guestCount || "", message: message || "",
    });
    return NextResponse.json({ success: true, booking: JSON.parse(JSON.stringify(booking)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to submit." }, { status: 500 });
  }
}

// GET — admin only
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const filter = status && status !== "all" ? { status } : {};
    const bookings = await BanquetBooking.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ bookings: JSON.parse(JSON.stringify(bookings)) });
  } catch {
    return NextResponse.json({ bookings: [] });
  }
}

// PATCH — admin update status / note
export async function PATCH(req: NextRequest) {
  const deny = await checkApiPerm("banquetBookings", "edit"); if (deny) return deny;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { id, status, adminNote } = await req.json();
    const updates: any = {};
    if (status)    updates.status    = status;
    if (adminNote !== undefined) updates.adminNote = adminNote;
    const booking = await BanquetBooking.findByIdAndUpdate(id, updates, { new: true }).lean();
    return NextResponse.json({ booking: JSON.parse(JSON.stringify(booking)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// DELETE — admin
export async function DELETE(req: NextRequest) {
  const deny = await checkApiPerm("banquetBookings", "delete"); if (deny) return deny;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { id } = await req.json();
    await BanquetBooking.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}