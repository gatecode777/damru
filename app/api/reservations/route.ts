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

    const dateMatch = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
    if (!dateMatch) {
      return NextResponse.json({ error: "Please select a valid reservation date." }, { status: 400 });
    }
    const resDate = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
    if (
      resDate.getFullYear() !== Number(dateMatch[1]) ||
      resDate.getMonth() !== Number(dateMatch[2]) - 1 ||
      resDate.getDate() !== Number(dateMatch[3])
    ) {
      return NextResponse.json({ error: "Please select a valid reservation date." }, { status: 400 });
    }

    // Validate date is not in the past or unreasonably far ahead.
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    if (resDate < today) {
      return NextResponse.json({ error: "Reservation date cannot be in the past." }, { status: 400 });
    }
    const maxDate = new Date(today);
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    if (resDate > maxDate) {
      return NextResponse.json({ error: "Reservations can only be made up to 2 years in advance." }, { status: 400 });
    }

    await connectDB();

    // Fetch fresh user data for phone number
    const dbUser = await UserModel.findById(user.id).select("name email phone").lean<{ phone?: string }>();

    const reservation = await Reservation.create({
      userId:    user.id,
      userName:  user.name,
      userEmail: user.email,
      userPhone: dbUser?.phone || "",
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
