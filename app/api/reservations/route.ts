import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Reservation from "@/models/Reservation";
import UserModel from "@/models/User";

// ── POST /api/reservations — create a reservation ─────────────
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) {
    return NextResponse.json({ error: "Please login to make a reservation." }, { status: 401 });
  }

  try {
    const { date, time, persons, notes } = await req.json();

    if (!date || !time || !persons) {
      return NextResponse.json({ error: "Date, time, and number of persons are required." }, { status: 400 });
    }

    // Validate date is not in the past
    const resDate = new Date(date);
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    if (resDate < today) {
      return NextResponse.json({ error: "Reservation date cannot be in the past." }, { status: 400 });
    }

    await connectDB();

    // Fetch fresh user data for phone number
    const dbUser = await UserModel.findById(user.id).select("name email phone").lean();

    const reservation = await Reservation.create({
      userId:    user.id,
      userName:  user.name,
      userEmail: user.email,
      userPhone: (dbUser as any)?.phone || "",
      date,
      time,
      persons,
      notes:     notes?.trim() || "",
    });

    return NextResponse.json({ success: true, reservation: JSON.parse(JSON.stringify(reservation)) });
  } catch (err) {
    console.error("POST reservation error:", err);
    return NextResponse.json({ error: "Failed to submit reservation. Please try again." }, { status: 500 });
  }
}

// ── GET /api/reservations — user's reservations ───────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ reservations: [] }, { status: 401 });

  try {
    await connectDB();
    const reservations = await Reservation.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ reservations: JSON.parse(JSON.stringify(reservations)) });
  } catch {
    return NextResponse.json({ reservations: [] }, { status: 500 });
  }
}