import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Reservation from "@/models/Reservation";
import UserModel from "@/models/User";

const RESERVATION_TIMES = new Set([
  "11:00 am", "11:30 am", "12:00 pm", "12:30 pm", "1:00 pm", "1:30 pm",
  "2:00 pm", "2:30 pm", "3:00 pm", "3:30 pm", "4:00 pm", "4:30 pm",
  "5:00 pm", "5:30 pm", "6:00 pm", "6:30 pm", "7:00 pm", "7:30 pm",
  "8:00 pm", "8:30 pm", "9:00 pm", "9:30 pm", "10:00 pm",
]);
const RESERVATION_PERSONS = new Set([
  "1 Person", "2 Persons", "3 Persons", "4 Persons", "5 Persons", "6 Persons",
  "7 Persons", "8 Persons", "9 Persons", "10 Persons", "10+ Persons",
]);

function indiaNowParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s(am|pm)$/.exec(value);
  if (!match) return -1;
  let hour = Number(match[1]) % 12;
  if (match[3] === "pm") hour += 12;
  return hour * 60 + Number(match[2]);
}

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
    if (typeof time !== "string" || !RESERVATION_TIMES.has(time))
      return NextResponse.json({ error: "Please select a valid reservation time." }, { status: 400 });
    if (typeof persons !== "string" || !RESERVATION_PERSONS.has(persons))
      return NextResponse.json({ error: "Please select a valid number of guests." }, { status: 400 });

    const dateMatch = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
    if (!dateMatch) {
      return NextResponse.json({ error: "Please select a valid reservation date." }, { status: 400 });
    }
    const resDate = new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
    if (
      resDate.getUTCFullYear() !== Number(dateMatch[1]) ||
      resDate.getUTCMonth() !== Number(dateMatch[2]) - 1 ||
      resDate.getUTCDate() !== Number(dateMatch[3])
    ) {
      return NextResponse.json({ error: "Please select a valid reservation date." }, { status: 400 });
    }

    // Validate date is not in the past or unreasonably far ahead.
    const indiaNow = indiaNowParts();
    const today = new Date(Date.UTC(indiaNow.year, indiaNow.month - 1, indiaNow.day));
    if (resDate < today) {
      return NextResponse.json({ error: "Reservation date cannot be in the past." }, { status: 400 });
    }
    const maxDate = new Date(today);
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    if (resDate > maxDate) {
      return NextResponse.json({ error: "Reservations can only be made up to 2 years in advance." }, { status: 400 });
    }
    if (resDate.getTime() === today.getTime() && timeToMinutes(time) <= indiaNow.hour * 60 + indiaNow.minute) {
      return NextResponse.json({ error: "This reservation time has already passed. Please choose a later time." }, { status: 400 });
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
