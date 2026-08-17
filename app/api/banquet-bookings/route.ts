import { checkApiPerm } from "@/lib/checkApiPerm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import BanquetBooking from "@/models/BanquetBooking";
import Branch from "@/models/Branch";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from "@/lib/rateLimit";

const EVENT_TYPES = new Set([
  "", "Birthday Party", "Wedding / Pre-Wedding", "Corporate Event",
  "Anniversary", "Baby Shower", "Cultural Event", "Social Gathering", "Other",
]);
const GUEST_COUNTS = new Set(["", "Upto 25", "25 – 50", "50 – 100", "100 – 200", "200 – 500", "500+"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function invalid(error: string, field?: string) {
  return NextResponse.json(
    field ? { error, fieldErrors: { [field]: error } } : { error },
    { status: 400 },
  );
}

function isValidEventDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;

  const indiaDateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const indiaPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(indiaDateParts.find(part => part.type === type)?.value);
  const today = Date.UTC(indiaPart("year"), indiaPart("month") - 1, indiaPart("day"));
  const latest = new Date(today);
  latest.setUTCFullYear(latest.getUTCFullYear() + 2);
  return date.getTime() >= today && date.getTime() <= latest.getTime();
}

// POST — public, no login required
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(`banquet-booking:${getClientIp(req)}`, RATE_LIMITS.banquetBooking);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    if (!req.headers.get("content-type")?.toLowerCase().includes("application/json"))
      return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 16_384)
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request body.");
    const data = body as Record<string, unknown>;
    const fullName = text(data.fullName);
    const phone = text(data.phone);
    const email = text(data.email)?.toLowerCase() ?? null;
    const branchSlug = text(data.branchSlug);
    const eventType = text(data.eventType);
    const eventDate = text(data.eventDate);
    const guestCount = text(data.guestCount);
    const message = text(data.message);

    const fieldErrors: Record<string, string> = {};
    if (!fullName) fieldErrors.fullName = "Full name is required.";
    else if (fullName.length < 2 || fullName.length > 100 || !NAME_RE.test(fullName))
      fieldErrors.fullName = "Enter a valid name (2–100 characters).";
    if (!phone) fieldErrors.phone = "Phone number is required.";
    else if (!PHONE_RE.test(phone)) fieldErrors.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!email) fieldErrors.email = "Email address is required.";
    else if (email.length > 254 || !EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
    if (eventType === null || !EVENT_TYPES.has(eventType)) fieldErrors.eventType = "Select a valid event type.";
    if (guestCount === null || !GUEST_COUNTS.has(guestCount)) fieldErrors.guestCount = "Select a valid guest count.";
    if (eventDate === null || (eventDate && !isValidEventDate(eventDate)))
      fieldErrors.eventDate = "Choose a date between today and two years from today.";
    if (message === null || message.length > 1000) fieldErrors.message = "Message cannot exceed 1,000 characters.";
    if (Object.keys(fieldErrors).length > 0)
      return NextResponse.json({ error: "Please correct the highlighted fields.", fieldErrors }, { status: 400 });
    if (fullName === null || phone === null || email === null || eventType === null ||
        eventDate === null || guestCount === null || message === null)
      return invalid("Invalid booking details.");

    if (!branchSlug || branchSlug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchSlug))
      return invalid("Please select a valid branch.");

    await connectDB();
    const branch = await Branch.findOne({ slug: branchSlug, isActive: true }).select("name slug").lean();
    if (!branch) return invalid("The selected branch is unavailable.");

    const booking = await BanquetBooking.create({
      fullName, phone, email,
      branchSlug: branch.slug, branchName: branch.name,
      eventType, eventDate, guestCount, message,
    });
    return NextResponse.json({ success: true, booking: JSON.parse(JSON.stringify(booking)) });
  } catch (e: unknown) {
    if (e instanceof SyntaxError) return invalid("Invalid JSON request body.");
    console.error("POST banquet-bookings error:", e);
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 });
  }
}

// GET — admin only
export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("banquetBookings", "view"); if (deny) return deny;
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
    const updates: { status?: string; adminNote?: unknown } = {};
    if (status)    updates.status    = status;
    if (adminNote !== undefined) updates.adminNote = adminNote;
    const booking = await BanquetBooking.findByIdAndUpdate(id, updates, { new: true }).lean();
    return NextResponse.json({ booking: JSON.parse(JSON.stringify(booking)) });
  } catch (e) {
    console.error("PATCH banquet-bookings error:", e);
    return NextResponse.json({ error: "Failed to update booking." }, { status: 400 });
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
