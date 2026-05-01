import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// GET — load settings (creates default doc if none exists)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    let settings = await SiteSettings.findOne().lean();
    if (!settings) {
      settings = await SiteSettings.create({});
      settings = await SiteSettings.findOne().lean();
    }
    return NextResponse.json({ settings: JSON.parse(JSON.stringify(settings)) });
  } catch (err) {
    console.error("GET settings error:", err);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

// PATCH — update settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    await connectDB();
    const updated = await SiteSettings.findOneAndUpdate(
      {},
      { $set: body },
      { new: true, upsert: true }
    ).lean();
    return NextResponse.json({ success: true, settings: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH settings error:", err);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}