import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Complaint from "@/models/Complaint";

// ── POST /api/complaints — submit a complaint ─────────────────
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  try {
    const { issueType, subject, description, attachment } = await req.json();

    if (!issueType?.trim()) return NextResponse.json({ error: "Issue type is required." }, { status: 400 });
    if (!subject?.trim())   return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: "Description is required." }, { status: 400 });

    await connectDB();

    const complaint = await Complaint.create({
      userId:      user.id,
      userName:    user.name,
      userEmail:   user.email,
      issueType:   issueType.trim(),
      subject:     subject.trim(),
      description: description.trim(),
      attachment:  attachment || "",
    });

    return NextResponse.json({ success: true, complaint: JSON.parse(JSON.stringify(complaint)) });
  } catch (err) {
    console.error("POST complaint error:", err);
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 });
  }
}

// ── GET /api/complaints — user's own complaints ───────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ complaints: [] }, { status: 401 });

  try {
    await connectDB();
    const complaints = await Complaint.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ complaints: JSON.parse(JSON.stringify(complaints)) });
  } catch {
    return NextResponse.json({ complaints: [] }, { status: 500 });
  }
}